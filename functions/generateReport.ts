import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dataset_id, format = 'pdf' } = await req.json();

    if (!dataset_id) {
      return Response.json({ error: 'dataset_id is required' }, { status: 400 });
    }

    // Fetch all report sections and metrics
    const sections = await base44.asServiceRole.entities.ReportSection.filter({ dataset_id });
    const metrics = await base44.asServiceRole.entities.MetricSnapshot.filter({ dataset_id });
    const publishers = await base44.asServiceRole.entities.Publisher.filter({ dataset_id });
    
    // Sort by section_id
    sections.sort((a, b) => a.section_id - b.section_id);

    // Fetch dataset metadata
    const dataset = await base44.asServiceRole.entities.DataUpload.get(dataset_id);

    // Prepare analytics data
    const analyticsData = {
      metrics,
      publishers,
      totalPublishers: publishers.length,
      activePublishers: publishers.filter(p => (p.total_revenue || 0) > 0).length,
      totalGMV: publishers.reduce((sum, p) => sum + (p.total_revenue || 0), 0),
    };

    if (format === 'pdf') {
      return await generatePDF(sections, dataset, analyticsData);
    } else if (format === 'markdown') {
      return generateMarkdown(sections, dataset, analyticsData);
    } else if (format === 'json') {
      return Response.json({ sections, dataset, analyticsData });
    }

    return Response.json({ error: 'Unsupported format' }, { status: 400 });

  } catch (error) {
    console.error('Report generation error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to generate report'
    }, { status: 500 });
  }
});

async function generatePDF(sections, dataset, analyticsData) {
  const doc = new jsPDF();
  let y = 20;

  // Cover page
  doc.setFontSize(24);
  doc.setTextColor(37, 99, 235);
  doc.text('Affiliate Growth Intelligence', 20, y);
  y += 10;
  doc.text('Complete Report', 20, y);
  y += 20;
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Dataset: ${dataset.file_name}`, 20, y);
  y += 8;
  doc.text(`Version: ${dataset.version_label || 'N/A'}`, 20, y);
  y += 8;
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, y);
  y += 20;

  // Key statistics
  doc.setFillColor(249, 250, 251);
  doc.rect(15, y, 180, 60, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, y, 180, 60, 'S');

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Overview Statistics', 20, y + 8);
  y += 15;

  doc.setFontSize(9);
  const activeRatio = analyticsData.metrics.find(m => m.metric_key === 'active_ratio')?.value_num || 0;
  const top10Share = analyticsData.metrics.find(m => m.metric_key === 'top10_share')?.value_num || 0;
  const approvalRate = analyticsData.metrics.find(m => m.metric_key === 'approval_rate')?.value_num || 0;
  
  doc.text(`Total Publishers: ${analyticsData.totalPublishers}`, 20, y);
  doc.text(`Active Publishers: ${analyticsData.activePublishers}`, 80, y);
  y += 6;
  doc.text(`Active Ratio: ${(activeRatio * 100).toFixed(1)}%`, 20, y);
  doc.text(`Total GMV: $${(analyticsData.totalGMV / 1000).toFixed(0)}K`, 80, y);
  y += 6;
  doc.text(`Top10 Concentration: ${(top10Share * 100).toFixed(1)}%`, 20, y);
  doc.text(`Approval Rate: ${(approvalRate * 100).toFixed(1)}%`, 80, y);
  
  doc.addPage();
  y = 20;

  // Table of contents
  doc.setFontSize(16);
  doc.text('Table of Contents', 20, y);
  y += 12;
  
  doc.setFontSize(10);
  sections.forEach((section, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(`${section.section_id}. ${section.title || `Chapter ${section.section_id}`}`, 25, y);
    y += 7;
  });

  // Content sections
  sections.forEach((section) => {
    doc.addPage();
    y = 20;
    
    // Section title
    doc.setFontSize(16);
    doc.text(`Chapter ${section.section_id}: ${section.title || `Section ${section.section_id}`}`, 20, y);
    y += 12;

    // Conclusion bar
    if (section.conclusion) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Conclusion:', 20, y);
      y += 6;
      
      doc.setFontSize(9);
      const conclusionLines = doc.splitTextToSize(section.conclusion, 170);
      doc.text(conclusionLines, 20, y);
      y += conclusionLines.length * 5 + 8;
    }

    // Content
    if (section.content_md) {
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      
      // Simple markdown to text conversion
      const textContent = section.content_md
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`/g, '');
      
      const contentLines = doc.splitTextToSize(textContent, 170);
      
      contentLines.forEach((line) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 5;
      });
    }

    // Key findings
    if (section.key_findings && section.key_findings.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Key Findings:', 20, y);
      y += 6;
      
      doc.setFontSize(9);
      section.key_findings.slice(0, 5).forEach((finding) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const findingText = typeof finding === 'string' ? finding : (finding.text || JSON.stringify(finding));
        const lines = doc.splitTextToSize(`• ${findingText}`, 165);
        doc.text(lines, 25, y);
        y += lines.length * 5 + 2;
      });
    }
  });

  const pdfBytes = doc.output('arraybuffer');

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Affiliate-Report-${dataset.version_label || 'latest'}.pdf"`
    }
  });
}

function generateMarkdown(sections, dataset, analyticsData) {
  let markdown = `# Affiliate Growth Intelligence Report\n\n`;
  markdown += `**Dataset:** ${dataset.file_name}\n`;
  markdown += `**Version:** ${dataset.version_label || 'N/A'}\n`;
  markdown += `**Generated:** ${new Date().toLocaleDateString()}\n\n`;
  markdown += `---\n\n`;

  // Overview statistics
  markdown += `## Overview Statistics\n\n`;
  const activeRatio = analyticsData.metrics.find(m => m.metric_key === 'active_ratio')?.value_num || 0;
  const top10Share = analyticsData.metrics.find(m => m.metric_key === 'top10_share')?.value_num || 0;
  const approvalRate = analyticsData.metrics.find(m => m.metric_key === 'approval_rate')?.value_num || 0;
  
  markdown += `- **Total Publishers:** ${analyticsData.totalPublishers}\n`;
  markdown += `- **Active Publishers:** ${analyticsData.activePublishers}\n`;
  markdown += `- **Active Ratio:** ${(activeRatio * 100).toFixed(1)}%\n`;
  markdown += `- **Total GMV:** $${(analyticsData.totalGMV / 1000).toFixed(0)}K\n`;
  markdown += `- **Top10 Concentration:** ${(top10Share * 100).toFixed(1)}%\n`;
  markdown += `- **Approval Rate:** ${(approvalRate * 100).toFixed(1)}%\n\n`;
  markdown += `---\n\n`;

  // Table of contents
  markdown += `## Table of Contents\n\n`;
  sections.forEach((section) => {
    markdown += `${section.section_id}. [${section.title || `Chapter ${section.section_id}`}](#chapter-${section.section_id})\n`;
  });
  markdown += `\n---\n\n`;

  // Content
  sections.forEach((section) => {
    markdown += `## Chapter ${section.section_id}: ${section.title || `Section ${section.section_id}`}\n\n`;
    
    if (section.conclusion) {
      markdown += `> **Conclusion:** ${section.conclusion}\n\n`;
    }
    
    if (section.content_md) {
      markdown += section.content_md + '\n\n';
    }

    if (section.key_findings && section.key_findings.length > 0) {
      markdown += `### Key Findings\n\n`;
      section.key_findings.forEach((finding) => {
        const text = typeof finding === 'string' ? finding : (finding.text || JSON.stringify(finding));
        markdown += `- ${text}\n`;
      });
      markdown += `\n`;
    }

    markdown += `---\n\n`;
  });

  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown',
      'Content-Disposition': `attachment; filename="Affiliate-Report-${dataset.version_label || 'latest'}.md"`
    }
  });
}
