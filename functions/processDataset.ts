import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dataset_id, file_url, field_mapping, cleaning_options } = await req.json();

    if (!dataset_id || !file_url) {
      return Response.json({ error: 'Missing dataset_id or file_url' }, { status: 400 });
    }

    // Update dataset status with start time
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      status: 'processing',
      processing_progress: 0,
      processing_step: '开始处理...',
      processing_started_at: new Date().toISOString(),
      sections_ready: [],
    });

    // Step 1: Parse CSV (0-25%)
    console.log('Step 1: Parsing CSV...');
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      processing_progress: 10,
      processing_step: '解析数据中...',
    });

    const parseResult = await base44.functions.invoke('parseCSV', { 
      dataset_id, 
      file_url,
      field_mapping,
      cleaning_options,
    });

    console.log('Parse result:', parseResult.data);
    if (!parseResult.data?.success) {
      throw new Error('Failed to parse CSV: ' + (parseResult.data?.error || 'Unknown error'));
    }

    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      processing_progress: 25,
      processing_step: '数据解析完成',
    });

    // Step 2: Compute Metrics (25-50%)
    console.log('Step 2: Computing metrics...');
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      processing_progress: 30,
      processing_step: '计算指标中...',
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
      processing_step: '指标计算完成',
    });

    // Step 3: AI Generate ALL Sections (50-100%)
    console.log('Step 3: Generating ALL AI sections...');
    const allSections = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
      processing_progress: 55,
      processing_step: 'AI 生成报告中...',
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
      processing_step: '全部完成',
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
    
    // Update dataset status to error (reparse the body if needed)
    try {
      const base44 = createClientFromRequest(req);
      const bodyText = await req.text();
      const body = JSON.parse(bodyText);
      const dataset_id = body.dataset_id;
      
      if (dataset_id) {
        await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
          status: 'error',
          processing_step: `Error: ${error.message}`,
        });
      }
    } catch (updateError) {
      console.error('Failed to update dataset status:', updateError);
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
});