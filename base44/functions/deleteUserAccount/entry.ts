import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { confirmPassword } = await req.json();
        
        if (!confirmPassword) {
            return Response.json({ error: 'Password confirmation required' }, { status: 400 });
        }

        return Response.json({ error: 'Account deletion is not supported through simple password confirmation and requires a dedicated re-authentication flow.' }, { status: 400 });
    } catch (error) {
        console.error('Delete account error:', error);
        return Response.json({ 
            error: error.message || 'Failed to delete account' 
        }, { status: 500 });
    }
});