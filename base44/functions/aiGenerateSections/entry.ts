import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dataset_id, section_ids } = await req.json();
    const requestedSections = section_ids || [0, 1, 2, 3, 5]; // Default: core modules

    // Create job
    await base44.asServiceRole.entities.Job.create({
      dataset_id,
      job_type: 'ai_generate',
      status: 'running',
      progress: 0,
      started_at: new Date().toISOString(),
    });

    // Get all metrics and evidence tables
    const metrics = await base44.asServiceRole.entities.MetricSnapshot.filter({ dataset_id });
    const evidenceTables = await base44.asServiceRole.entities.EvidenceTable.filter({ dataset_id });
    const dataset = await base44.asServiceRole.entities.DataUpload.get(dataset_id);
    const capabilities = dataset?.capabilities || {};
    const datasetWarnings = Array.isArray(dataset?.processing_warnings) ? dataset.processing_warnings : [];

    // Build context for AI
    const metricsContext = metrics.map(m => `${m.metric_key}: ${m.value_num}`).join('\n');
    const evidenceContext = evidenceTables.map(t => 
      `${t.table_key}:\n${JSON.stringify(t.data_json, null, 2)}`
    ).join('\n\n');
    const brandContext = dataset?.website_scrape_data
      ? JSON.stringify(dataset.website_scrape_data, null, 2)
      : 'No website brand context available.';

    const sectionSupport = {
      0: true,
      1: true,
      2: true,
      3: !!capabilities.has_publisher_type,
      4: !!capabilities.has_commission,
      5: !!capabilities.has_approval_breakdown,
      6: !!capabilities.has_publisher_type,
      7: true,
      8: true,
      9: true,
      10: true,
    };
    const sectionsToGenerate = requestedSections.filter((sectionId) => sectionSupport[sectionId] !== false);
    const unsupportedSections = requestedSections.filter((sectionId) => sectionSupport[sectionId] === false);

    const sectionConfigs = {
      0: {
        title: "Executive Summary - KPI Cockpit",
        prompt: "Generate an executive summary analyzing the key KPIs. Focus on active ratio, concentration risk, and structural health. Identify top 3 risks and top 3 opportunities based on the metrics.",
      },
      1: {
        title: "Activation Funnel",
        prompt: "Analyze the publisher activation funnel from Total to Active to Core Drivers. Explain the conversion gaps and suggest activation strategies.",
      },
      2: {
        title: "Revenue Concentration Analysis",
        prompt: "Analyze revenue concentration using the TopN data. Explain the risks of high concentration and suggest de-concentration strategies.",
      },
      3: {
        title: "Mix Health - Publisher Type Distribution",
        prompt: "Analyze the publisher type mix (Content, Deal/Coupon, Loyalty, etc.). Identify structural imbalances and recommend optimization.",
      },
      4: {
        title: "Efficiency Quadrant",
        prompt: "Analyze publisher efficiency by ROI and scale. Identify stars, growth opportunities, and underperformers.",
      },
      5: {
        title: "Approval & Transaction Quality",
        prompt: "Analyze the approval/pending/declined waterfall. Identify quality issues and suggest governance improvements.",
      },
      6: {
        title: "Tier Management",
        prompt: "Analyze publisher tier distribution and performance. Recommend tier optimization strategies.",
      },
      7: {
        title: "Action Plan Recommendations",
        prompt: "Based on all previous analysis, recommend specific action items with priority and expected impact.",
      },
      8: {
        title: "Timeline & Roadmap",
        prompt: "Create a quarterly roadmap for implementing the recommended actions.",
      },
      9: {
        title: "Data Quality Assessment",
        prompt: "Assess data completeness and quality. Identify gaps and suggest improvements.",
      },
      10: {
        title: "Appendix - Methodology",
        prompt: "Explain the calculation methodology and data sources used in this analysis.",
      },
    };

    const generatedSections = [];
    const totalSections = sectionsToGenerate.length;

    for (let idx = 0; idx < sectionsToGenerate.length; idx++) {
      const sectionId = sectionsToGenerate[idx];
      const config = sectionConfigs[sectionId];
      if (!config) continue;

      // Update progress
      const progress = 55 + Math.round((idx / totalSections) * 45);
      await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
        processing_progress: progress,
        processing_step: `AI 生成章节 ${idx + 1}/${totalSections}...`,
      });

      const systemPrompt = `You are an expert affiliate marketing analyst. Analyze the provided metrics, evidence tables, and brand context to generate insights.

CRITICAL RULES:
1. NEVER invent numbers - only use values from the metrics and evidence tables provided
2. Reference specific metrics by their exact names (e.g., "active_ratio: 0.32")
3. Keep conclusions data-driven and actionable
4. Output must be in Chinese (Simplified)
5. If brand context exists, connect recommendations to the brand's products, positioning, and promotions without inventing business facts
6. Respect data limitations and explicitly mention when a conclusion is based on incomplete source data

Metrics:
${metricsContext}

Evidence Tables:
${evidenceContext}

Dataset Warnings:
${datasetWarnings.join('\n') || 'None'}

Brand Context:
${brandContext}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: config.prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content);

      // Determine conclusion status based on metrics
      let conclusionStatus = 'neutral';
      if (sectionId === 1) {
        const activeRatio = metrics.find(m => m.metric_key === 'active_ratio')?.value_num || 0;
        conclusionStatus = activeRatio < 0.4 ? 'warning' : activeRatio >= 0.5 ? 'good' : 'neutral';
      } else if (sectionId === 2) {
        const top10Share = metrics.find(m => m.metric_key === 'top10_share')?.value_num || 0;
        conclusionStatus = top10Share > 0.7 ? 'bad' : top10Share > 0.5 ? 'warning' : 'good';
      } else if (sectionId === 5) {
        const approvalRate = metrics.find(m => m.metric_key === 'approval_rate')?.value_num || 0;
        conclusionStatus = approvalRate < 0.75 ? 'bad' : approvalRate < 0.85 ? 'warning' : 'good';
      }

      await base44.asServiceRole.entities.ReportSection.create({
        dataset_id,
        section_id: sectionId,
        title: config.title,
        content_md: result.content || result.analysis || '',
        conclusion: result.conclusion || result.summary || '',
        conclusion_status: conclusionStatus,
        key_findings: result.key_findings || result.findings || [],
        derivation_notes: result.derivation_notes || [],
        ai_generated: true,
      });

      generatedSections.push(sectionId);
    }

    for (const sectionId of unsupportedSections) {
      const config = sectionConfigs[sectionId];
      if (!config) continue;
      await base44.asServiceRole.entities.ReportSection.create({
        dataset_id,
        section_id: sectionId,
        title: config.title,
        content_md: '当前数据源缺少支撑该章节所需字段，因此该模块被标记为部分可用。',
        conclusion: sectionId === 5
          ? '审批拆分数据缺失，无法生成交易质量分析。'
          : '当前数据不足以支持该章节的完整分析。',
        conclusion_status: 'neutral',
        key_findings: [],
        derivation_notes: datasetWarnings,
        ai_generated: false,
      });
    }

    // Complete job
    const jobs = await base44.asServiceRole.entities.Job.filter({ dataset_id, job_type: 'ai_generate' });
    if (jobs.length > 0) {
      await base44.asServiceRole.entities.Job.update(jobs[0].id, {
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        result: { generated_sections: generatedSections },
      });
    }

    try {
      await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
        sections_ready: [...generatedSections, ...unsupportedSections],
      });
    } catch (updateError) {
      console.error('Failed to update sections_ready:', updateError);
    }

    return Response.json({ 
      success: true, 
      generated_sections: generatedSections,
      skipped_sections: unsupportedSections,
    });

  } catch (error) {
    console.error('AI Generate error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
