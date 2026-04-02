import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  let body;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    body = await req.json();
    const { dataset_id, file_url, field_mapping, cleaning_options } = body;

    if (!dataset_id || !file_url) {
      return Response.json({ error: 'Missing dataset_id or file_url' }, { status: 400 });
    }

    const dataset = await base44.asServiceRole.entities.DataUpload.get(dataset_id);
    const websiteUrl = dataset?.website_url || 'https://www.insta360.com';
    const warnings = [];
    const stepResults = {};
    const safeUpdateDataset = async (patch) => {
      try {
        await base44.asServiceRole.entities.DataUpload.update(dataset_id, patch);
      } catch (updateError) {
        console.warn('Dataset update with extended fields failed, retrying with core fields:', updateError);
        const fallbackPatch = Object.fromEntries(
          Object.entries(patch).filter(([key]) => !['capabilities', 'processing_warnings'].includes(key))
        );
        await base44.asServiceRole.entities.DataUpload.update(dataset_id, fallbackPatch);
      }
    };

    // Update dataset status with start time
    await safeUpdateDataset({
      status: 'processing',
      processing_progress: 0,
      processing_step: '开始处理...',
      processing_started_at: new Date().toISOString(),
      sections_ready: [],
      processing_warnings: [],
    });

    // Step 1: Parse CSV (0-25%)
    console.log('Step 1: Parsing CSV...');
    await safeUpdateDataset({
      processing_progress: 10,
      processing_step: '解析数据中...',
    });

    const parseResult = await base44.functions.invoke('parseCSV', { 
      dataset_id, 
      file_url,
      field_mapping,
      cleaning_options,
    });

    console.log('Parse result:', parseResult.data);
    if (!parseResult.data?.success) {
      throw new Error('Failed to parse CSV: ' + (parseResult.data?.error || 'Unknown error'));
    }
    stepResults.parse = parseResult.data;
    if (Array.isArray(parseResult.data?.warnings)) {
      warnings.push(...parseResult.data.warnings);
    }

    await safeUpdateDataset({
      processing_progress: 25,
      processing_step: '数据解析完成',
      field_mapping: parseResult.data?.field_mapping || field_mapping,
      capabilities: parseResult.data?.capabilities || dataset?.capabilities || {},
      processing_warnings: Array.from(new Set(warnings)),
    });

    // Step 1.5: Brand enrichment (25-35%)
    console.log('Step 1.5: Scraping brand website...');
    await safeUpdateDataset({
      processing_progress: 28,
      processing_step: '抓取品牌上下文中...',
    });

    try {
      const scrapeResult = await base44.functions.invoke('scrapeWebsite', {
        website_url: websiteUrl,
        dataset_id,
      });
      stepResults.scrape = scrapeResult.data;
    } catch (scrapeError) {
      const warning = `Brand enrichment failed: ${scrapeError.message}`;
      warnings.push(warning);
      console.error(warning);
    }

    // Step 2: Compute Metrics (25-50%)
    console.log('Step 2: Computing metrics...');
    await safeUpdateDataset({
      processing_progress: 35,
      processing_step: '计算指标中...',
      processing_warnings: Array.from(new Set(warnings)),
    });

    const computeResult = await base44.functions.invoke('computeMetrics', { 
      dataset_id 
    });

    console.log('Compute result:', computeResult.data);
    if (!computeResult.data?.success) {
      throw new Error('Failed to compute metrics: ' + (computeResult.data?.error || 'Unknown error'));
    }
    stepResults.compute = computeResult.data;
    if (Array.isArray(computeResult.data?.warnings)) {
      warnings.push(...computeResult.data.warnings);
    }

    await safeUpdateDataset({
      processing_progress: 50,
      processing_step: '指标计算完成',
      processing_warnings: Array.from(new Set(warnings)),
    });

    // Step 3: AI Generate ALL Sections (50-100%)
    console.log('Step 3: Generating ALL AI sections...');
    const allSections = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    await safeUpdateDataset({
      processing_progress: 55,
      processing_step: 'AI 生成报告中...',
    });

    const aiResult = await base44.functions.invoke('aiGenerateSections', { 
      dataset_id,
      section_ids: allSections,
    });

    console.log('AI result:', aiResult.data);
    if (!aiResult.data?.success) {
      throw new Error('Failed to generate AI sections: ' + (aiResult.data?.error || 'Unknown error'));
    }
    stepResults.ai_generate = aiResult.data;

    // Update dataset to ready with completion time
    await safeUpdateDataset({
      status: 'completed',
      processing_progress: 100,
      processing_step: '全部完成',
      processing_completed_at: new Date().toISOString(),
      sections_ready: aiResult.data?.generated_sections
        ? [...aiResult.data.generated_sections, ...(aiResult.data.skipped_sections || [])]
        : allSections,
      processing_warnings: Array.from(new Set(warnings)),
    });

    return Response.json({ 
      success: true, 
      message: 'Dataset processed successfully',
      warnings: Array.from(new Set(warnings)),
      steps: stepResults,
    });

  } catch (error) {
    console.error('Process dataset error:', error);
    
    // Update dataset status to error
    try {
      const base44 = createClientFromRequest(req);
        const dataset_id = body.dataset_id;
      
      if (dataset_id) {
        await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
          status: 'error',
          processing_step: `Error: ${error.message}`,
        });
      }
    } catch (updateError) {
      console.error('Failed to update dataset status:', updateError);
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
});
