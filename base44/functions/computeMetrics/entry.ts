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

    // Get all publishers for this dataset
    const publishers = await base44.asServiceRole.entities.Publisher.filter({ dataset_id });
    const dataset = await base44.asServiceRole.entities.DataUpload.get(dataset_id);
    const capabilities = dataset?.capabilities || {};
    const warnings = Array.isArray(dataset?.processing_warnings) ? [...dataset.processing_warnings] : [];

    if (publishers.length === 0) {
      throw new Error('No publishers found for dataset');
    }

    const calc_version = new Date().toISOString();
    const createMetric = (metric_key, value_num, module_id) =>
      base44.asServiceRole.entities.MetricSnapshot.create({
        dataset_id,
        metric_key,
        value_num,
        calc_version,
        module_id,
      });

    // ============ MODULE 0 & 1: Activation Metrics ============
    const total_publishers = publishers.length;
    const active_publishers = publishers.filter(p => (p.total_revenue || 0) > 0);
    const active_count = active_publishers.length;
    const active_ratio = active_count / total_publishers;
    
    const total_gmv = publishers.reduce((sum, p) => sum + (p.total_revenue || 0), 0);
    const gmv_per_active = active_count > 0 ? total_gmv / active_count : 0;
    const total_clicks = publishers.reduce((sum, p) => sum + (p.clicks || 0), 0);
    const total_orders = publishers.reduce((sum, p) => sum + (p.orders || 0), 0);
    const total_commission = publishers.reduce((sum, p) => sum + (p.total_commission || 0), 0);

    await createMetric('total_publishers', total_publishers, 0);
    await createMetric('active_publishers', active_count, 1);
    await createMetric('active_ratio', active_ratio, 1);
    await createMetric('total_gmv', total_gmv, 0);
    await createMetric('gmv_per_active', gmv_per_active, 0);
    await createMetric('total_clicks', total_clicks, 0);
    await createMetric('total_orders', total_orders, 0);
    await createMetric('total_commission', total_commission, 0);

    // Activation Evidence Table
    await base44.asServiceRole.entities.EvidenceTable.create({
      dataset_id,
      table_key: 'activation_summary',
      data_json: [
        { label: 'Total Publishers', value: total_publishers },
        { label: 'Active Publishers', value: active_count },
        { label: 'Active Ratio', value: `${(active_ratio * 100).toFixed(1)}%` },
        { label: 'GMV per Active', value: `$${gmv_per_active.toFixed(0)}` },
        { label: 'Clicks', value: total_clicks },
        { label: 'Orders', value: total_orders },
        { label: 'Commission / Action Cost', value: `$${total_commission.toFixed(2)}` },
      ],
      module_id: 1,
      row_count: 7,
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

    await createMetric('top1_share', top1_share, 2);
    await createMetric('top10_share', top10_share, 2);
    await createMetric('publishers_to_50pct', publishers_to_50pct, 2);

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
          pct: `${((p.total_revenue || 0) / total_gmv * 100).toFixed(1)}%`,
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
      const gmvPct = (cum / total_gmv) * 100;
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
    if (capabilities.has_publisher_type) {
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
        count_share: (data.count / active_count * 100).toFixed(1),
        gmv_share: (data.gmv / total_gmv * 100).toFixed(1),
      }));

      await base44.asServiceRole.entities.EvidenceTable.create({
        dataset_id,
        table_key: 'mix_health_table',
        data_json: mixData,
        module_id: 3,
        row_count: mixData.length,
      });

      for (const item of mixData) {
        await createMetric(`${item.type}_share`, item.gmv / total_gmv, 3);
      }
    } else {
      await base44.asServiceRole.entities.EvidenceTable.create({
        dataset_id,
        table_key: 'mix_health_table',
        data_json: [],
        module_id: 3,
        row_count: 0,
        partial: true,
        notes: 'Publisher type data is unavailable for this dataset.',
      });
    }

    // ============ MODULE 5: Approval ============
    if (capabilities.has_approval_breakdown) {
      const total_approved = publishers.reduce((sum, p) => sum + (p.approved_revenue || 0), 0);
      const total_pending = publishers.reduce((sum, p) => sum + (p.pending_revenue || 0), 0);
      const total_declined = publishers.reduce((sum, p) => sum + (p.declined_revenue || 0), 0);
      const approval_rate = total_gmv > 0 ? total_approved / total_gmv : 0;

      await createMetric('approval_rate', approval_rate, 5);
      await createMetric('total_approved_gmv', total_approved, 5);
      await createMetric('total_pending_gmv', total_pending, 5);
      await createMetric('total_declined_gmv', total_declined, 5);

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
        .sort((a, b) => b.declined_revenue - a.declined_revenue);

      await base44.asServiceRole.entities.EvidenceTable.create({
        dataset_id,
        table_key: 'approval_table',
        data_json: approvalDetail,
        module_id: 5,
        row_count: approvalDetail.length,
      });
    } else {
      warnings.push('Approval breakdown was unavailable, so approval charts were marked partial.');
      await createMetric('approval_rate', 0, 5);
      await createMetric('total_approved_gmv', 0, 5);
      await createMetric('total_pending_gmv', 0, 5);
      await createMetric('total_declined_gmv', 0, 5);
      await base44.asServiceRole.entities.EvidenceTable.create({
        dataset_id,
        table_key: 'approval_waterfall',
        data_json: [],
        module_id: 5,
        row_count: 0,
        partial: true,
        notes: 'Approval revenue breakdown is unavailable for this dataset.',
      });
      await base44.asServiceRole.entities.EvidenceTable.create({
        dataset_id,
        table_key: 'approval_table',
        data_json: [],
        module_id: 5,
        row_count: 0,
        partial: true,
        notes: 'Approval detail rows are unavailable for this dataset.',
      });
    }

    try {
      await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
        capabilities: {
          ...capabilities,
          has_orders: capabilities.has_orders || total_orders > 0,
          has_commission: capabilities.has_commission || total_commission > 0,
          has_clicks: capabilities.has_clicks || total_clicks > 0,
        },
        processing_warnings: Array.from(new Set(warnings)),
      });
    } catch (updateError) {
      console.warn('Failed to update dataset capabilities after metrics:', updateError);
    }

    // Complete job
    const jobs = await base44.asServiceRole.entities.Job.filter({ dataset_id, job_type: 'compute_metrics' });
    if (jobs.length > 0) {
      await base44.asServiceRole.entities.Job.update(jobs[0].id, {
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      calc_version,
      metrics_summary: {
        total_publishers,
        active_publishers: active_count,
        active_ratio,
        total_gmv,
        top10_share,
        publishers_to_50pct,
        total_clicks,
        total_orders,
        total_commission,
      },
      warnings: Array.from(new Set(warnings)),
    });

  } catch (error) {
    console.error('Compute metrics error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
