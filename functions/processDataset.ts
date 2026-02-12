import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  let requestBody: {
    dataset_id?: string;
    file_url?: string;
    parsed_rows?: Array<Record<string, unknown>>;
    parsed_headers?: string[];
    field_mapping?: Record<string, string>;
    cleaning_options?: Record<string, unknown>;
  } = {};

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requestBody = await req.json();
    const { dataset_id, file_url, parsed_rows, parsed_headers, field_mapping, cleaning_options } = requestBody;

    if (!dataset_id || (!file_url && !(parsed_rows && parsed_rows.length > 0))) {
      return Response.json({ error: 'Missing dataset_id and input data (file_url or parsed_rows)' }, { status: 400 });
    }

    // Update dataset status with start time
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      status: 'processing',
      processing_progress: 0,
      processing_step: 'Parsing CSV',
      processing_started_at: new Date().toISOString(),
      sections_ready: [],
    });

    // Step 1: Parse CSV (0-25%)
    console.log('Step 1: Parsing CSV...');
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      processing_progress: 10,
      processing_step: 'Parsing CSV...',
    });

    const parseResult = await base44.functions.invoke('parseCSV', { 
      dataset_id, 
      file_url,
      parsed_rows,
      parsed_headers,
      field_mapping,
      cleaning_options,
    });

    console.log('Parse result:', parseResult.data);
    if (!parseResult.data?.success) {
      throw new Error('Failed to parse CSV: ' + (parseResult.data?.error || 'Unknown error'));
    }

    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      processing_progress: 25,
      processing_step: 'CSV parsed successfully',
    });

    // Step 2: Compute Metrics (25-50%)
    console.log('Step 2: Computing metrics...');
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      processing_progress: 30,
      processing_step: 'Computing metrics...',
    });

    const computeResult = await base44.functions.invoke('computeMetrics', { 
      dataset_id 
    });

    console.log('Compute result:', computeResult.data);
    if (!computeResult.data?.success) {
      throw new Error('Failed to compute metrics: ' + (computeResult.data?.error || 'Unknown error'));
    }

    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      processing_progress: 50,
      processing_step: 'Metrics computed',
    });

    // Step 3: AI Generate ALL Sections (50-100%)
    console.log('Step 3: Generating ALL AI sections...');
    const allSections = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      processing_progress: 55,
      processing_step: 'Generating AI reports...',
    });

    const aiResult = await base44.functions.invoke('aiGenerateSections', { 
      dataset_id,
      section_ids: allSections,
    });

    console.log('AI result:', aiResult.data);
    if (!aiResult.data?.success) {
      throw new Error('Failed to generate AI sections: ' + (aiResult.data?.error || 'Unknown error'));
    }

    // Update dataset to ready with completion time
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      status: 'completed',
      processing_progress: 100,
      processing_step: 'Completed',
      processing_completed_at: new Date().toISOString(),
      sections_ready: allSections,
    });

    return Response.json({ 
      success: true, 
      message: 'Dataset processed successfully',
      steps: {
        parse: parseResult.data,
        compute: computeResult.data,
        ai_generate: aiResult.data,
      }
    });

  } catch (error) {
    console.error('Process dataset error:', error);
    
    // Update dataset status to error.
    try {
      const base44 = createClientFromRequest(req);
      const dataset_id = requestBody.dataset_id;
      
      if (dataset_id) {
        await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
          status: 'error',
          processing_step: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    } catch (updateError) {
      console.error('Failed to update dataset status:', updateError);
    }

    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
