import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
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