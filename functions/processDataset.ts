import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dataset_id, file_url } = await req.json();

    if (!dataset_id || !file_url) {
      return Response.json({ error: 'Missing dataset_id or file_url' }, { status: 400 });
    }

    // Update dataset status
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      status: 'processing',
    });

    // Step 1: Parse CSV
    const parseResult = await base44.functions.invoke('parseCSV', { 
      dataset_id, 
      file_url 
    });

    if (!parseResult.data?.success) {
      throw new Error('Failed to parse CSV: ' + (parseResult.data?.error || 'Unknown error'));
    }

    // Step 2: Compute Metrics
    const computeResult = await base44.functions.invoke('computeMetrics', { 
      dataset_id 
    });

    if (!computeResult.data?.success) {
      throw new Error('Failed to compute metrics: ' + (computeResult.data?.error || 'Unknown error'));
    }

    // Step 3: AI Generate Sections (core modules first)
    const aiResult = await base44.functions.invoke('aiGenerateSections', { 
      dataset_id,
      section_ids: [0, 1, 2, 3, 5],
    });

    if (!aiResult.data?.success) {
      throw new Error('Failed to generate AI sections: ' + (aiResult.data?.error || 'Unknown error'));
    }

    // Update dataset to ready
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      status: 'completed',
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
    
    // Update dataset status to error
    try {
      const { dataset_id } = await req.json();
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
        status: 'error',
      });
    } catch (updateError) {
      console.error('Failed to update dataset status:', updateError);
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
});