import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { name, email, school, message } = await req.json();

    // Send email notification to support
    await base44.integrations.Core.SendEmail({
      to: 'support@schedual-pro.com',
      subject: `New Demo Request from ${school}`,
      body: `
        <h2>New Demo Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>School:</strong> ${school}</p>
        <p><strong>Message:</strong> ${message || 'No message provided'}</p>
        <hr>
        <p><em>Received on ${new Date().toLocaleString()}</em></p>
      `
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Demo request error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});