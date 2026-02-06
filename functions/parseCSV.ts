import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, dataset_id } = await req.json();

    // Update job status
    await base44.asServiceRole.entities.Job.create({
      dataset_id,
      job_type: 'parse_csv',
      status: 'running',
      progress: 0,
      started_at: new Date().toISOString(),
    });

    // Fetch CSV file
    const response = await fetch(file_url);
    const csvText = await response.text();

    // Parse CSV
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || null;
      });
      rows.push(row);
    }

    // Detect field mappings
    const fieldMapping = {};
    const knownFields = {
      'publisher_id': ['publisher_id', 'publisherid', 'pub_id', 'id'],
      'publisher_name': ['publisher_name', 'publishername', 'name', 'publisher'],
      'total_revenue': ['total_revenue', 'revenue', 'gmv', 'total_gmv', 'sales'],
      'total_commission': ['total_commission', 'commission', 'payout'],
      'clicks': ['clicks', 'num_clicks', 'click_count'],
      'orders': ['orders', 'num_orders', 'transactions', 'conversions'],
      'approved_revenue': ['approved_revenue', 'approved', 'approved_sales'],
      'pending_revenue': ['pending_revenue', 'pending'],
      'declined_revenue': ['declined_revenue', 'declined', 'reversed_revenue'],
      'publisher_type': ['publisher_type', 'type', 'category', 'publisher_category'],
      'aov': ['aov', 'avg_order_value', 'average_order_value'],
      'cvr': ['cvr', 'conversion_rate', 'cr'],
    };

    for (const [targetField, possibleNames] of Object.entries(knownFields)) {
      for (const header of headers) {
        if (possibleNames.includes(header.toLowerCase())) {
          fieldMapping[header] = targetField;
          break;
        }
      }
    }

    // Save Publisher rows
    const publishers = [];
    for (const row of rows) {
      const publisher = { dataset_id };
      
      // Map fields
      for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
        let value = row[sourceField];
        
        // Convert numeric fields
        if (['total_revenue', 'total_commission', 'clicks', 'orders', 'approved_revenue', 'pending_revenue', 'declined_revenue', 'aov', 'cvr'].includes(targetField)) {
          value = value ? parseFloat(value.replace(/[$,]/g, '')) : 0;
        }
        
        publisher[targetField] = value;
      }

      // Normalize publisher_id
      publisher.publisher_id_norm = publisher.publisher_id || publisher.publisher_name?.toLowerCase().replace(/\s+/g, '_');
      
      publishers.push(publisher);
    }

    // Bulk create publishers
    for (const pub of publishers) {
      await base44.asServiceRole.entities.Publisher.create(pub);
    }

    // Update dataset
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      status: 'processing',
      row_count: rows.length,
      field_mapping: fieldMapping,
    });

    // Complete job
    const jobs = await base44.asServiceRole.entities.Job.filter({ dataset_id, job_type: 'parse_csv' });
    if (jobs.length > 0) {
      await base44.asServiceRole.entities.Job.update(jobs[0].id, {
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        result: { row_count: rows.length, field_mapping: fieldMapping },
      });
    }

    return Response.json({ 
      success: true, 
      row_count: rows.length,
      field_mapping: fieldMapping,
    });

  } catch (error) {
    console.error('Parse CSV error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});