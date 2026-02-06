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

    // Fetch all report sections
    const sections = await base44.asServiceRole.entities.ReportSection.filter({ dataset_id });
    
    // Sort by section_id
    sections.sort((a, b) => a.section_id - b.section_id);

    // Fetch dataset metadata
    const dataset = await base44.asServiceRole.entities.DataUpload.get(dataset_id);

    if (format === 'pdf') {
      return await generatePDF(sections, dataset);
    } else if (format === 'markdown') {
      return generateMarkdown(sections, dataset);
    } else if (format === 'json') {
      return Response.json({ sections, dataset });
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

async function generatePDF(sections, dataset) {
  const doc = new jsPDF();
  let y = 20;

  // Cover page
  doc.setFontSize(24);
  doc.text('Affiliate Growth Intelligence Report', 20, y);
  y += 15;
  
  doc.setFontSize(12);
  doc.text(`Dataset: ${dataset.file_name}`, 20, y);
  y += 8;
  doc.text(`Version: ${dataset.version_label || 'N/A'}`, 20, y);
  y += 8;
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
  
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

function generateMarkdown(sections, dataset) {
  let markdown = `# Affiliate Growth Intelligence Report\n\n`;
  markdown += `**Dataset:** ${dataset.file_name}\n`;
  markdown += `**Version:** ${dataset.version_label || 'N/A'}\n`;
  markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
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