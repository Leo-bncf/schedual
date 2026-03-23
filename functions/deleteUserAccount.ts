import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { validateCSRF } from './csrfHelper.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Validate CSRF
        await validateCSRF(req, base44);
        
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { confirmPassword } = await req.json();
        
        // Require password confirmation for deletion
        if (!confirmPassword) {
            return Response.json({ error: 'Password confirmation required' }, { status: 400 });
        }

        // Delete the user using service role
        await base44.asServiceRole.entities.User.delete(user.id);

        return Response.json({ 
            success: true,
            message: 'Account deleted successfully' 
        });
    } catch (error) {
        console.error('Delete account error:', error);
        return Response.json({ 
            error: error.message || 'Failed to delete account' 
        }, { status: 500 });
    }
});