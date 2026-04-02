import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dataset_id, format = 'pdf' } = await req.json();
    if (!dataset_id) return Response.json({ error: 'dataset_id is required' }, { status: 400 });

    const [sections, metrics, publishers, evidenceTables] = await Promise.all([
      base44.asServiceRole.entities.ReportSection.filter({ dataset_id }),
      base44.asServiceRole.entities.MetricSnapshot.filter({ dataset_id }),
      base44.asServiceRole.entities.Publisher.filter({ dataset_id }),
      base44.asServiceRole.entities.EvidenceTable.filter({ dataset_id }),
    ]);

    sections.sort((a, b) => a.section_id - b.section_id);
    const dataset = await base44.asServiceRole.entities.DataUpload.get(dataset_id);

    const getMetric = (key) => metrics.find(m => m.metric_key === key)?.value_num || 0;
    const getTable = (key) => evidenceTables.find(t => t.table_key === key)?.data_json || [];

    const totalPublishers = publishers.length;
    const activePublishers = publishers.filter(p => (p.total_revenue || 0) > 0).length;
    const totalGMV = publishers.reduce((sum, p) => sum + (p.total_revenue || 0), 0);
    const activeRatio = getMetric('active_ratio');
    const top10Share = getMetric('top10_share');
    const approvalRate = getMetric('approval_rate');

    if (format === 'markdown') {
      return generateMarkdown(sections, dataset, { totalPublishers, activePublishers, totalGMV, activeRatio, top10Share, approvalRate });
    }

    // Generate PDF as base64 so it works through axios/json
    const pdfBase64 = await generatePDFBase64(sections, dataset, {
      totalPublishers, activePublishers, totalGMV, activeRatio, top10Share, approvalRate,
      getMetric, getTable,
    });

    return Response.json({ 
      success: true, 
      format: 'pdf',
      filename: `Affiliate-Report-${dataset.version_label || 'latest'}.pdf`,
      pdf_base64: pdfBase64,
    });

  } catch (error) {
    console.error('Report generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function generatePDFBase64(sections, dataset, analytics) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 18;
  const contentW = W - margin * 2;

  const addPage = () => { doc.addPage(); return margin; };

  const checkY = (y, needed = 15) => {
    if (y + needed > 272) return addPage();
    return y;
  };

  // ─── COVER PAGE ──────────────────────────────────────────────────────────────
  // Background header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 80, 'F');

  doc.setFillColor(219, 234, 254);
  doc.rect(0, 78, W, 3, 'F');

  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Affiliate Growth', margin, 32);
  doc.text('Intelligence Report', margin, 44);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(191, 219, 254);
  doc.text('Comprehensive Channel Performance & Strategic Analysis', margin, 56);

  // Meta info
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  let y = 96;
  doc.setFont('helvetica', 'bold');
  doc.text('Dataset:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dataset.file_name || 'N/A', margin + 20, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Version:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dataset.version_label || 'Latest', margin + 20, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Generated:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), margin + 25, y);
  y += 16;

  // KPI Cards row
  const kpis = [
    { label: 'Total Publishers', value: analytics.totalPublishers.toString(), color: [37, 99, 235] },
    { label: 'Active Publishers', value: analytics.activePublishers.toString(), color: [16, 185, 129] },
    { label: 'Active Ratio', value: `${(analytics.activeRatio * 100).toFixed(1)}%`, color: [139, 92, 246] },
    { label: 'Total GMV', value: `$${(analytics.totalGMV / 1000).toFixed(0)}K`, color: [245, 158, 11] },
    { label: 'Top10 Share', value: `${(analytics.top10Share * 100).toFixed(1)}%`, color: analytics.top10Share > 0.6 ? [220, 38, 38] : [16, 185, 129] },
    { label: 'Approval Rate', value: `${(analytics.approvalRate * 100).toFixed(1)}%`, color: analytics.approvalRate < 0.75 ? [220, 38, 38] : [16, 185, 129] },
  ];

  const cardW = (contentW - 5 * 4) / 6;
  kpis.forEach((kpi, i) => {
    const x = margin + i * (cardW + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...kpi.color);
    doc.roundedRect(x, y, cardW, 24, 2, 2, 'FD');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + cardW / 2, y + 10, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const labelLines = doc.splitTextToSize(kpi.label, cardW - 2);
    labelLines.forEach((l, li) => doc.text(l, x + cardW / 2, y + 16 + li * 4, { align: 'center' }));
  });
  y += 34;

  // Top publishers table
  const topN = analytics.getTable('topn_table').slice(0, 10);
  if (topN.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Top 10 Publishers by Revenue', margin, y);
    y += 5;

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('#', margin + 2, y + 5);
    doc.text('Publisher', margin + 10, y + 5);
    doc.text('GMV', margin + 110, y + 5);
    doc.text('Share', margin + 135, y + 5);
    doc.text('Cumulative', margin + 155, y + 5);
    y += 7;

    topN.forEach((row, i) => {
      y = checkY(y, 7);
      doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
      doc.rect(margin, y, contentW, 7, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(String(row.rank || i + 1), margin + 2, y + 5);
      const nameText = doc.splitTextToSize(String(row.name || ''), 95);
      doc.text(nameText[0], margin + 10, y + 5);
      doc.text(String(row.gmv || ''), margin + 110, y + 5);
      doc.text(String(row.pct || ''), margin + 135, y + 5);
      doc.text(String(row.cumPct || ''), margin + 155, y + 5);
      y += 7;
    });
    y += 8;
  }

  // ─── TABLE OF CONTENTS ─────────────────────────────────────────────────────
  y = addPage();
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Table of Contents', margin, y);
  y += 3;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, W - margin, y);
  y += 8;

  sections.forEach((section, i) => {
    y = checkY(y, 8);
    const statusColors = {
      good: [16, 185, 129], neutral: [100, 116, 139],
      warning: [245, 158, 11], bad: [220, 38, 38],
    };
    const sc = statusColors[section.conclusion_status] || statusColors.neutral;
    doc.setFillColor(...sc);
    doc.circle(margin + 2, y - 1.5, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${section.section_id}. ${section.title || `Chapter ${section.section_id}`}`, margin + 7, y);

    // Dotted line
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(margin + 120, y - 1, W - margin - 12, y - 1);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`pg.${i + 3}`, W - margin - 10, y);
    y += 8;
  });

  // ─── CONTENT SECTIONS ──────────────────────────────────────────────────────
  sections.forEach((section) => {
    y = addPage();

    // Chapter header bar
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, W, 18, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(191, 219, 254);
    doc.text('AFFILIATE GROWTH INTELLIGENCE REPORT', margin, 7);
    doc.text(`Chapter ${section.section_id}`, W - margin, 7, { align: 'right' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`${section.section_id}. ${section.title || `Chapter ${section.section_id}`}`, margin, 14);

    y = 26;

    // Conclusion banner
    if (section.conclusion) {
      const statusMap = {
        good: { fill: [220, 252, 231], border: [16, 185, 129], text: [6, 95, 70], label: '✓ CONCLUSION' },
        neutral: { fill: [241, 245, 249], border: [100, 116, 139], text: [51, 65, 85], label: '● CONCLUSION' },
        warning: { fill: [255, 251, 235], border: [245, 158, 11], text: [120, 53, 15], label: '⚠ CONCLUSION' },
        bad: { fill: [254, 242, 242], border: [220, 38, 38], text: [127, 29, 29], label: '✕ CONCLUSION' },
      };
      const sm = statusMap[section.conclusion_status] || statusMap.neutral;
      const conclusionLines = doc.splitTextToSize(section.conclusion, contentW - 8);
      const bannerH = 12 + conclusionLines.length * 5;
      doc.setFillColor(...sm.fill);
      doc.setDrawColor(...sm.border);
      doc.roundedRect(margin, y, contentW, bannerH, 2, 2, 'FD');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...sm.border);
      doc.text(sm.label, margin + 4, y + 5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...sm.text);
      conclusionLines.forEach((line, li) => doc.text(line, margin + 4, y + 10 + li * 5));
      y += bannerH + 6;
    }

    // Content body
    if (section.content_md) {
      const lines = section.content_md.split('\n');
      for (const rawLine of lines) {
        y = checkY(y, 8);
        const trimmed = rawLine.trim();
        if (!trimmed) { y += 2; continue; }

        if (trimmed.startsWith('# ')) {
          y += 2;
          doc.setFontSize(13);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          const wrapped = doc.splitTextToSize(trimmed.replace(/^#+\s/, ''), contentW);
          wrapped.forEach(l => { y = checkY(y, 7); doc.text(l, margin, y); y += 7; });
          y += 2;
        } else if (trimmed.startsWith('## ')) {
          y += 2;
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(37, 99, 235);
          const wrapped = doc.splitTextToSize(trimmed.replace(/^#+\s/, ''), contentW);
          wrapped.forEach(l => { y = checkY(y, 6); doc.text(l, margin, y); y += 6; });
          y += 1;
        } else if (trimmed.startsWith('### ')) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(51, 65, 85);
          const wrapped = doc.splitTextToSize(trimmed.replace(/^#+\s/, ''), contentW);
          wrapped.forEach(l => { y = checkY(y, 6); doc.text(l, margin, y); y += 6; });
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(51, 65, 85);
          const text = trimmed.replace(/^[-*]\s/, '').replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(text, contentW - 8);
          doc.setFillColor(37, 99, 235);
          doc.circle(margin + 2, y - 1.5, 1.2, 'F');
          wrapped.forEach((l, li) => { 
            y = checkY(y, 5); 
            doc.text(l, margin + 6, y); 
            y += 5; 
          });
        } else {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          const cleaned = trimmed.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
          const wrapped = doc.splitTextToSize(cleaned, contentW);
          wrapped.forEach(l => { y = checkY(y, 5); doc.text(l, margin, y); y += 5; });
          y += 1;
        }
      }
    }

    // Key findings
    if (section.key_findings && section.key_findings.length > 0) {
      y = checkY(y, 20);
      y += 4;
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(245, 158, 11);
      const findingsH = 14 + section.key_findings.slice(0, 6).reduce((acc, f) => {
        const text = typeof f === 'string' ? f : (f.text || JSON.stringify(f));
        return acc + doc.splitTextToSize(text, contentW - 12).length * 5 + 2;
      }, 0);
      doc.roundedRect(margin, y, contentW, findingsH, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text('KEY FINDINGS', margin + 4, y + 6);
      y += 11;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      section.key_findings.slice(0, 6).forEach((finding) => {
        y = checkY(y, 6);
        const text = typeof finding === 'string' ? finding : (finding.text || JSON.stringify(finding));
        const lines = doc.splitTextToSize(`→ ${text}`, contentW - 12);
        doc.setTextColor(120, 53, 15);
        lines.forEach(l => { doc.text(l, margin + 6, y); y += 5; });
        y += 2;
      });
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('Affiliate Growth Intelligence — Confidential', margin, 290);
    doc.text(new Date().toLocaleDateString(), W - margin, 290, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 286, W - margin, 286);
  });

  return doc.output('datauristring').split(',')[1]; // base64 only
}

function generateMarkdown(sections, dataset, analytics) {
  let md = `# Affiliate Growth Intelligence Report\n\n`;
  md += `**Dataset:** ${dataset.file_name}\n`;
  md += `**Version:** ${dataset.version_label || 'N/A'}\n`;
  md += `**Generated:** ${new Date().toLocaleDateString()}\n\n---\n\n`;
  md += `## Overview Statistics\n\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| Total Publishers | ${analytics.totalPublishers} |\n`;
  md += `| Active Publishers | ${analytics.activePublishers} |\n`;
  md += `| Active Ratio | ${(analytics.activeRatio * 100).toFixed(1)}% |\n`;
  md += `| Total GMV | $${(analytics.totalGMV / 1000).toFixed(0)}K |\n`;
  md += `| Top10 Concentration | ${(analytics.top10Share * 100).toFixed(1)}% |\n`;
  md += `| Approval Rate | ${(analytics.approvalRate * 100).toFixed(1)}% |\n\n---\n\n`;

  sections.forEach((section) => {
    md += `## Chapter ${section.section_id}: ${section.title || `Section ${section.section_id}`}\n\n`;
    if (section.conclusion) md += `> **Conclusion:** ${section.conclusion}\n\n`;
    if (section.content_md) md += section.content_md + '\n\n';
    if (section.key_findings?.length > 0) {
      md += `### Key Findings\n\n`;
      section.key_findings.forEach(f => {
        md += `- ${typeof f === 'string' ? f : (f.text || JSON.stringify(f))}\n`;
      });
      md += '\n';
    }
    md += `---\n\n`;
  });

  return new Response(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown',
      'Content-Disposition': `attachment; filename="Affiliate-Report-${dataset.version_label || 'latest'}.md"`,
    },
  });
}