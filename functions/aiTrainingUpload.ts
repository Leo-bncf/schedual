import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const { action, ...params } = await req.json();
    
    // Check super admin for write operations only
    const { data: superAdminCheck } = await base44.functions.invoke('getSuperAdminEmails');
    const isSuperAdmin = superAdminCheck?.isSuperAdmin;
    
    if (['upload', 'updateField', 'approve'].includes(action) && !isSuperAdmin) {
      return Response.json({ error: 'Unauthorized - Super Admin access required' }, { status: 403 });
    }

    if (action === 'upload') {
      const { file_url, file_name, agent_name, extracted_data, training_feedback } = params;

      // Store in training data using service role with feedback
      const result = await base44.asServiceRole.entities.AITrainingData.create({
        agent_name,
        file_url,
        file_name,
        extracted_data,
        field_feedback: training_feedback || {},
        overall_status: 'pending_review'
      });

      return Response.json({ success: true, training: result });
    }

    if (action === 'list') {
      const { agent_name } = params;
      const data = await base44.asServiceRole.entities.AITrainingData.filter(
        { agent_name }, 
        '-created_date', 
        50
      );
      return Response.json({ success: true, data });
    }

    if (action === 'updateField') {
      const { training_id, field_path, is_correct, corrected_value, notes } = params;
      
      // Get current training
      const training = await base44.asServiceRole.entities.AITrainingData.filter({ id: training_id });
      if (!training || training.length === 0) {
        return Response.json({ error: 'Training not found' }, { status: 404 });
      }

      const current = training[0];
      const updatedFeedback = {
        ...(current.field_feedback || {}),
        [field_path]: {
          correct: is_correct,
          corrected_value: corrected_value,
          notes: notes || ''
        }
      };

      await base44.asServiceRole.entities.AITrainingData.update(training_id, {
        field_feedback: updatedFeedback
      });

      return Response.json({ success: true });
    }

    if (action === 'approve') {
      const { training_id, status, notes } = params;

      await base44.asServiceRole.entities.AITrainingData.update(training_id, {
        overall_status: status,
        training_notes: notes,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('AI Training error:', error);
    return Response.json({ 
      error: error.message || 'Failed to process request',
      details: error.toString()
    }, { status: 500 });
  }
});