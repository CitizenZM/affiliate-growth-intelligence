import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dataset_id } = await req.json();

    if (!dataset_id) {
      return Response.json({ error: 'dataset_id is required' }, { status: 400 });
    }

    // Fetch key metrics and all sections
    const metrics = await base44.asServiceRole.entities.MetricSnapshot.filter({ dataset_id });
    const dataset = await base44.asServiceRole.entities.DataUpload.get(dataset_id);
    const allSections = await base44.asServiceRole.entities.ReportSection.filter({ dataset_id });
    const publishers = await base44.asServiceRole.entities.Publisher.filter({ dataset_id });

    // Get key metrics
    const activeRatio = metrics.find(m => m.metric_key === 'active_ratio')?.value_num || 0;
    const coreDriverRatio = metrics.find(m => m.metric_key === 'core_driver_ratio')?.value_num || 0;
    const top10Share = metrics.find(m => m.metric_key === 'top10_share')?.value_num || 0;
    const approvalRate = metrics.find(m => m.metric_key === 'avg_approval_rate')?.value_num || 0;
    const totalGMV = publishers.reduce((sum, p) => sum + (p.total_revenue || 0), 0);

    // Get executive summary
    const execSummary = allSections.find(s => s.section_id === 0);
    
    // Collect key risks and opportunities from all sections
    const allRisks = [];
    const allOpportunities = [];
    
    allSections.forEach(section => {
      if (section.key_findings) {
        section.key_findings.forEach(finding => {
          const text = typeof finding === 'string' ? finding : (finding.text || '');
          const type = typeof finding === 'object' ? finding.type : null;
          
          if (type === 'risk') {
            allRisks.push({ text, section: section.title });
          } else if (type === 'opportunity') {
            allOpportunities.push({ text, section: section.title });
          }
        });
      }
    });

    // Generate one-page PDF
    const doc = new jsPDF();
    let y = 25;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text('Board Summary', 20, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Affiliate Growth Intelligence Dashboard - ${new Date().toLocaleDateString()}`, 20, y);
    y += 15;

    // Key Metrics Box
    doc.setFillColor(249, 250, 251);
    doc.rect(15, y, 180, 60, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, y, 180, 60, 'S');

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Core KPIs', 20, y + 8);

    // Metrics in grid
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    
    // Row 1
    y += 15;
    doc.text('Active Ratio', 20, y);
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(`${(activeRatio * 100).toFixed(1)}%`, 20, y + 8);
    
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Total GMV', 70, y);
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(`$${(totalGMV / 1000).toFixed(0)}K`, 70, y + 8);

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Top10 Share', 120, y);
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(`${(top10Share * 100).toFixed(1)}%`, 120, y + 8);

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Approval Rate', 160, y);
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(`${(approvalRate * 100).toFixed(1)}%`, 160, y + 8);

    // Status indicators
    doc.setFontSize(7);
    y += 18;
    
    const statusColor = activeRatio > 0.4 ? [34, 197, 94] : activeRatio > 0.3 ? [234, 179, 8] : [239, 68, 68];
    doc.setTextColor(...statusColor);
    doc.text(activeRatio > 0.4 ? '✓ Good' : activeRatio > 0.3 ? '⚠ Low' : '✗ Risk', 20, y);
    
    doc.setTextColor(34, 197, 94);
    doc.text('—', 70, y);
    
    const concColor = top10Share < 0.5 ? [34, 197, 94] : top10Share < 0.7 ? [234, 179, 8] : [239, 68, 68];
    doc.setTextColor(...concColor);
    doc.text(top10Share < 0.5 ? '✓ Good' : top10Share < 0.7 ? '⚠ High' : '✗ Risk', 120, y);
    
    const apprColor = approvalRate > 0.85 ? [34, 197, 94] : approvalRate > 0.75 ? [234, 179, 8] : [239, 68, 68];
    doc.setTextColor(...apprColor);
    doc.text(approvalRate > 0.85 ? '✓ Good' : approvalRate > 0.75 ? '⚠ Low' : '✗ Risk', 160, y);

    y += 20;

    // Executive Summary
    if (execSummary) {
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Executive Summary', 20, y);
      y += 7;

      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const conclusion = execSummary.conclusion || 'Overall program performance requires attention across multiple dimensions.';
      const lines = doc.splitTextToSize(conclusion, 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 8;
    }

    // Top Risks
    if (allRisks.length > 0 && y < 230) {
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text('⚠ Top Risks', 20, y);
      y += 6;

      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      allRisks.slice(0, 3).forEach((risk) => {
        if (y > 260) return;
        const lines = doc.splitTextToSize(`• ${risk.text}`, 165);
        doc.text(lines, 25, y);
        y += lines.length * 4 + 1;
      });
      y += 5;
    }

    // Top Opportunities
    if (allOpportunities.length > 0 && y < 240) {
      doc.setFontSize(10);
      doc.setTextColor(37, 99, 235);
      doc.text('✓ Key Opportunities', 20, y);
      y += 6;

      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      allOpportunities.slice(0, 3).forEach((opp) => {
        if (y > 270) return;
        const lines = doc.splitTextToSize(`• ${opp.text}`, 165);
        doc.text(lines, 25, y);
        y += lines.length * 4 + 1;
      });
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Generated by Affiliate Growth Intelligence Dashboard', 20, 285);

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Board-Summary-${dataset.version_label || 'latest'}.pdf"`
      }
    });

  } catch (error) {
    console.error('Board summary generation error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to generate board summary'
    }, { status: 500 });
  }
});