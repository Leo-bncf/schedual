import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';
import { validateCSRF } from './csrfHelper.js';

// Stripe Price IDs - Replace these with your actual Stripe Price IDs from the dashboard
const PRICE_IDS = {
  monthly: 'price_MONTHLY_ID', // Replace with your monthly price ID
  yearly: 'price_YEARLY_ID',   // Replace with your yearly price ID
};

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    const base44 = createClientFromRequest(req);
    
    // Validate CSRF
    await validateCSRF(req, base44);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Block SuperAdmin accounts
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const SUPER_ADMIN_EMAILS = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
    if (SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      return Response.json({ error: 'SuperAdmin accounts cannot subscribe' }, { status: 403 });
    }

    const { plan, manage_subscription = false } = await req.json();

    // Handle billing portal for existing subscriptions
    if (manage_subscription && user.school_id) {
      const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
      const school = schools[0];
      
      if (school?.stripe_customer_id) {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: school.stripe_customer_id,
          return_url: `${req.headers.get('origin') || 'https://' + req.headers.get('host')}/Subscription`,
        });
        return Response.json({ url: portalSession.url });
      }
    }

    // Validate plan
    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return Response.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    // Check if user already has active subscription
    if (user.school_id) {
      const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
      const school = schools[0];
      if (school?.subscription_status === 'active' || school?.subscription_status === 'trialing') {
        return Response.json({ error: 'Already subscribed' }, { status: 400 });
      }
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        plan: plan,
      },
      customer_email: user.email,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      success_url: `${req.headers.get('origin') || 'https://' + req.headers.get('host')}/Dashboard?subscription=success`,
      cancel_url: `${req.headers.get('origin') || 'https://' + req.headers.get('host')}/Subscription?subscription=cancelled`,
    });

    return Response.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout Error:', error);
    return Response.json({ 
      error: `Error: ${error.message}`,
    }, { status: 500 });
  }
});