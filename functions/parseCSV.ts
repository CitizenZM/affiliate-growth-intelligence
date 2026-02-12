import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, parsed_rows, parsed_headers, dataset_id, field_mapping, cleaning_options } = await req.json();

    // Update job status
    await base44.asServiceRole.entities.Job.create({
      dataset_id,
      job_type: 'parse_csv',
      status: 'running',
      progress: 0,
      started_at: new Date().toISOString(),
    });

    let headers = [];
    let rows = [];

    if (Array.isArray(parsed_rows) && parsed_rows.length > 0) {
      // Preferred fallback path when remote file storage is unavailable.
      rows = parsed_rows;
      headers = Array.isArray(parsed_headers) && parsed_headers.length > 0
        ? parsed_headers
        : Object.keys(parsed_rows[0] || {});
    } else {
      if (!file_url) {
        return Response.json({ error: 'Missing file_url or parsed_rows' }, { status: 400 });
      }

      // Fetch CSV file
      const response = await fetch(file_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch uploaded file: ${response.status} ${response.statusText}`);
      }
      const csvText = await response.text();

      // Parse CSV (handle quoted fields with commas)
      const lines = csvText.trim().split('\n');
      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] ? values[idx].replace(/^"|"$/g, '') : null;
        });
        rows.push(row);
      }
    }

    // Use provided field mapping or auto-detect
    let fieldMapping = field_mapping || {};
    if (Object.keys(fieldMapping).length === 0) {
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
    }

    // Save Publisher rows with cleaning
    const publishers = [];
    const seen = new Set();
    const cleanOpts = cleaning_options || {};
    
    for (const row of rows) {
      const publisher = { dataset_id };
      
      // Map fields
      let hasRequiredFields = false;
      for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
        if (!targetField) continue;
        
        let value = row[sourceField];
        
        // Handle missing values
        if (!value || value === '') {
          if (cleanOpts.handleMissing) {
            if (['total_revenue', 'total_commission', 'clicks', 'orders', 'approved_revenue', 'pending_revenue', 'declined_revenue', 'aov', 'cvr'].includes(targetField)) {
              value = cleanOpts.missingNumeric === 'zero' ? 0 : null;
            } else {
              value = cleanOpts.missingText === 'unknown' ? 'Unknown' : null;
            }
          }
        }
        
        // Convert numeric fields
        if (['total_revenue', 'total_commission', 'clicks', 'orders', 'approved_revenue', 'pending_revenue', 'declined_revenue', 'aov', 'cvr'].includes(targetField)) {
          value = value ? parseFloat(String(value).replace(/[$,]/g, '')) : 0;
        }
        
        publisher[targetField] = value;
        
        if (targetField === 'publisher_name' && value) {
          hasRequiredFields = true;
        }
      }
      
      // Skip rows without required fields
      if (!hasRequiredFields) continue;

      // Normalize publisher_id
      const pubKey = publisher.publisher_id || publisher.publisher_name?.toLowerCase().replace(/\s+/g, '_');
      publisher.publisher_id_norm = pubKey;
      
      // Remove duplicates
      if (cleanOpts.removeDuplicates && seen.has(pubKey)) {
        continue;
      }
      seen.add(pubKey);
      
      // Filter low GMV
      if (cleanOpts.filterLowGMV && (publisher.total_revenue || 0) < (cleanOpts.minGMV || 0)) {
        continue;
      }
      
      publishers.push(publisher);
    }

    // Bulk create publishers (use bulkCreate if available, otherwise batch)
    if (publishers.length > 0) {
      try {
        // Try bulk create (may not be available in all SDK versions)
        await base44.asServiceRole.entities.Publisher.bulkCreate(publishers);
      } catch (bulkError) {
        // Fall back to individual creates in batches
        const batchSize = 10;
        for (let i = 0; i < publishers.length; i += batchSize) {
          const batch = publishers.slice(i, i + batchSize);
          await Promise.all(batch.map(pub => 
            base44.asServiceRole.entities.Publisher.create(pub).catch(e => {
              console.error('Failed to create publisher:', pub.publisher_name, e);
              return null;
            })
          ));
        }
      }
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
