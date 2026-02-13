import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dataset_id } = await req.json();

    // Create job
    await base44.asServiceRole.entities.Job.create({
      dataset_id,
      job_type: 'compute_metrics',
      status: 'running',
      progress: 0,
      started_at: new Date().toISOString(),
    });

    // Get all publishers for this dataset and deduplicate by normalized id/name.
    const rawPublishers = await base44.asServiceRole.entities.Publisher.filter({ dataset_id });
    const publisherByKey = new Map<string, any>();
    for (const pub of rawPublishers) {
      const dedupeKey = pub.publisher_id_norm || pub.publisher_id || pub.publisher_name || pub.id;
      if (!dedupeKey) continue;
      // Keep the latest record for repeated imports of the same dataset.
      publisherByKey.set(dedupeKey, pub);
    }
    const publishers = Array.from(publisherByKey.values());

    if (publishers.length === 0) {
      throw new Error('No publishers found for dataset');
    }

    const calc_version = new Date().toISOString();

    // ============ MODULE 0 & 1: Activation Metrics ============
    const total_publishers = publishers.length;
    const active_publishers = publishers.filter(p => (p.total_revenue || 0) > 0);
    const active_count = active_publishers.length;
    const active_ratio = total_publishers > 0 ? active_count / total_publishers : 0;
    
    const total_gmv = publishers.reduce((sum, p) => sum + (p.total_revenue || 0), 0);
    const gmv_per_active = active_count > 0 ? total_gmv / active_count : 0;

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'total_publishers',
      value_num: total_publishers,
      calc_version,
      module_id: 0,
    });

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'active_publishers',
      value_num: active_count,
      calc_version,
      module_id: 1,
    });

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'active_ratio',
      value_num: active_ratio,
      calc_version,
      module_id: 1,
    });

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'total_gmv',
      value_num: total_gmv,
      calc_version,
      module_id: 0,
    });

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'gmv_per_active',
      value_num: gmv_per_active,
      calc_version,
      module_id: 0,
    });

    // Activation Evidence Table
    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'activation_summary',
      data_json: [
        { label: 'Total Publishers', value: total_publishers },
        { label: 'Active Publishers', value: active_count },
        { label: 'Active Ratio', value: `${(active_ratio * 100).toFixed(1)}%` },
        { label: 'GMV per Active', value: `$${gmv_per_active.toFixed(0)}` },
      ],
      module_id: 1,
      row_count: 4,
    });

    const activationDetail = active_publishers
      .map((p) => {
        const orders = p.orders || 0;
        const commission = p.total_commission || 0;
        const cpa = orders > 0 ? commission / orders : 0;
        return {
          name: p.publisher_name || p.publisher_id || 'Unknown',
          type: p.publisher_type || 'other',
          gmv: p.total_revenue || 0,
          cpa: cpa,
          status: 'Active',
        };
      })
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 100);

    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'activation_publishers',
      data_json: activationDetail,
      module_id: 1,
      row_count: activationDetail.length,
    });

    // ============ MODULE 2: Concentration ============
    const sorted = [...active_publishers].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));
    
    const top1_gmv = sorted[0]?.total_revenue || 0;
    const top3_gmv = sorted.slice(0, 3).reduce((sum, p) => sum + (p.total_revenue || 0), 0);
    const top10_gmv = sorted.slice(0, 10).reduce((sum, p) => sum + (p.total_revenue || 0), 0);

    const top1_share = total_gmv > 0 ? top1_gmv / total_gmv : 0;
    const top3_share = total_gmv > 0 ? top3_gmv / total_gmv : 0;
    const top10_share = total_gmv > 0 ? top10_gmv / total_gmv : 0;

    // Find publishers to 50% GMV
    let cumulative = 0;
    let publishers_to_50pct = 0;
    for (const pub of sorted) {
      cumulative += pub.total_revenue || 0;
      publishers_to_50pct++;
      if (cumulative >= total_gmv * 0.5) break;
    }

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'top1_share',
      value_num: top1_share,
      calc_version,
      module_id: 2,
    });

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'top10_share',
      value_num: top10_share,
      calc_version,
      module_id: 2,
    });

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'publishers_to_50pct',
      value_num: publishers_to_50pct,
      calc_version,
      module_id: 2,
    });

    // TopN Evidence Table
    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'topn_table',
      data_json: sorted.slice(0, 20).map((p, i) => {
        const cumPct = sorted.slice(0, i + 1).reduce((s, pub) => s + (pub.total_revenue || 0), 0) / total_gmv;
        return {
          rank: i + 1,
          name: p.publisher_name || p.publisher_id,
          gmv: `$${((p.total_revenue || 0) / 1000).toFixed(1)}K`,
          pct: `${(total_gmv > 0 ? ((p.total_revenue || 0) / total_gmv * 100) : 0).toFixed(1)}%`,
          cumPct: `${(cumPct * 100).toFixed(1)}%`,
        };
      }),
      module_id: 2,
      row_count: Math.min(20, sorted.length),
    });

    // Pareto curve points
    const paretoPoints = [];
    let cum = 0;
    sorted.forEach((p, i) => {
      cum += p.total_revenue || 0;
      const pubPct = ((i + 1) / sorted.length) * 100;
      const gmvPct = total_gmv > 0 ? (cum / total_gmv) * 100 : 0;
      if (i % Math.ceil(sorted.length / 20) === 0 || i === sorted.length - 1) {
        paretoPoints.push({ pubPct: pubPct.toFixed(1), gmvPct: gmvPct.toFixed(1) });
      }
    });

    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'pareto_points',
      data_json: paretoPoints,
      module_id: 2,
      row_count: paretoPoints.length,
    });

    // ============ MODULE 3: Mix Health ============
    const typeBuckets = {};
    active_publishers.forEach(p => {
      const bucket = p.publisher_type || 'other';
      if (!typeBuckets[bucket]) {
        typeBuckets[bucket] = { count: 0, gmv: 0 };
      }
      typeBuckets[bucket].count++;
      typeBuckets[bucket].gmv += p.total_revenue || 0;
    });

    const mixData = Object.entries(typeBuckets).map(([type, data]) => ({
      type,
      count: data.count,
      gmv: data.gmv,
      count_share: (active_count > 0 ? (data.count / active_count * 100) : 0).toFixed(1) + '%',
      gmv_share: (total_gmv > 0 ? (data.gmv / total_gmv * 100) : 0).toFixed(1) + '%',
    }));

    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'mix_health_table',
      data_json: mixData,
      module_id: 3,
      row_count: mixData.length,
    });

    // Store type shares as metrics
    for (const item of mixData) {
      await base44.asServiceRole.entities.MetricSnapshot.create({
        dataset_id,
        metric_key: `${item.type}_share`,
        value_num: total_gmv > 0 ? item.gmv / total_gmv : 0,
        calc_version,
        module_id: 3,
      });
    }

    // ============ MODULE 5: Approval ============
    const total_approved = publishers.reduce((sum, p) => sum + (p.approved_revenue || 0), 0);
    const total_pending = publishers.reduce((sum, p) => sum + (p.pending_revenue || 0), 0);
    const total_declined = publishers.reduce((sum, p) => sum + (p.declined_revenue || 0), 0);
    const approval_rate = total_gmv > 0 ? total_approved / total_gmv : 0;

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'approval_rate',
      value_num: approval_rate,
      calc_version,
      module_id: 5,
    });

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'total_approved_gmv',
      value_num: total_approved,
      calc_version,
      module_id: 5,
    });

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'total_pending_gmv',
      value_num: total_pending,
      calc_version,
      module_id: 5,
    });

    await base44.asServiceRole.entities.MetricSnapshot.create({
      dataset_id,
      metric_key: 'total_declined_gmv',
      value_num: total_declined,
      calc_version,
      module_id: 5,
    });

    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'approval_waterfall',
      data_json: [
        { name: 'Total GMV', value: total_gmv, label: `$${(total_gmv / 1000).toFixed(0)}K` },
        { name: 'Approved', value: total_approved, label: `$${(total_approved / 1000).toFixed(0)}K` },
        { name: 'Pending', value: total_pending, label: `$${(total_pending / 1000).toFixed(0)}K` },
        { name: 'Declined', value: total_declined, label: `$${(total_declined / 1000).toFixed(0)}K` },
      ],
      module_id: 5,
      row_count: 4,
    });

    // Approval detail table - sort by decline rate descending
    const approvalDetail = publishers
      .filter(p => (p.total_revenue || 0) > 0)
      .map(p => ({
        publisher_name: p.publisher_name || p.publisher_id || 'Unknown',
        total_revenue: p.total_revenue || 0,
        approved_revenue: p.approved_revenue || 0,
        pending_revenue: p.pending_revenue || 0,
        declined_revenue: p.declined_revenue || 0,
        approval_rate: (p.total_revenue || 0) > 0 ? (p.approved_revenue || 0) / (p.total_revenue || 0) : 0,
        decline_rate: (p.total_revenue || 0) > 0 ? (p.declined_revenue || 0) / (p.total_revenue || 0) : 0,
      }))
      .sort((a, b) => b.decline_rate - a.decline_rate);

    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'approval_table',
      data_json: approvalDetail,
      module_id: 5,
      row_count: approvalDetail.length,
    });

    // ============ MODULE 4: Efficiency ============
    const efficiencyRows = publishers
      .filter((p) => (p.total_revenue || 0) > 0)
      .map((p) => {
        const orders = p.orders || 0;
        const revenue = p.total_revenue || 0;
        const commission = p.total_commission || 0;
        const cpa = orders > 0 ? commission / orders : 0;
        const aov = orders > 0 ? revenue / orders : 0;
        const roi = commission > 0 ? revenue / commission : 0;
        return {
          name: p.publisher_name || p.publisher_id || 'Unknown',
          type: p.publisher_type || 'other',
          cpa: Number(cpa.toFixed(2)),
          aov: Number(aov.toFixed(2)),
          roi: Number(roi.toFixed(2)),
          gmv: revenue,
        };
      });

    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'efficiency_scatter',
      data_json: efficiencyRows,
      module_id: 4,
      row_count: efficiencyRows.length,
    });

    // ============ MODULE 6: Operating System ============
    const tierBase = [...publishers].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));
    const tierRows = tierBase.map((p, idx) => {
      const rank = idx + 1;
      let tier = 'Tier 3';
      if ((p.total_revenue || 0) <= 0) tier = 'Tier 4';
      else if (rank <= 10) tier = 'Tier 1';
      else if (rank <= 50) tier = 'Tier 2';
      return {
        publisher_name: p.publisher_name || p.publisher_id || 'Unknown',
        total_revenue: p.total_revenue || 0,
        tier,
      };
    });

    const tierSummary = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'].map((tier) => {
      const list = tierRows.filter((row) => row.tier === tier);
      const tierGMV = list.reduce((sum, row) => sum + row.total_revenue, 0);
      return {
        tier,
        count: list.length,
        gmv: tierGMV,
        gmv_share: total_gmv > 0 ? tierGMV / total_gmv : 0,
        top_publishers: list
          .sort((a, b) => b.total_revenue - a.total_revenue)
          .slice(0, 5)
          .map((row) => row.publisher_name),
      };
    });

    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'tier_summary',
      data_json: tierSummary,
      module_id: 6,
      row_count: tierSummary.length,
    });

    // ============ MODULE 8: Timeline ============
    const timelineTasks = [
      {
        name: `激活提升计划（目标活跃率 ${(Math.max(active_ratio, 0.4) * 100).toFixed(0)}%）`,
        month_start: 1,
        duration: 3,
        priority: active_ratio < 0.4 ? 'high' : 'medium',
      },
      {
        name: `去集中化计划（Top10 ${(top10_share * 100).toFixed(0)}%）`,
        month_start: 2,
        duration: 4,
        priority: top10_share > 0.5 ? 'high' : 'medium',
      },
      {
        name: `审批治理（Approval ${(approval_rate * 100).toFixed(0)}%）`,
        month_start: 3,
        duration: 2,
        priority: approval_rate < 0.85 ? 'high' : 'medium',
      },
      {
        name: '结构优化与季度复盘',
        month_start: 6,
        duration: 3,
        priority: 'medium',
      },
    ];

    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'timeline_tasks',
      data_json: timelineTasks,
      module_id: 8,
      row_count: timelineTasks.length,
    });

    // Complete job
    const jobs = await base44.asServiceRole.entities.Job.filter({ dataset_id, job_type: 'compute_metrics' });
    if (jobs.length > 0) {
      await base44.asServiceRole.entities.Job.update(jobs[0].id, {
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, calc_version });

  } catch (error) {
    console.error('Compute metrics error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
