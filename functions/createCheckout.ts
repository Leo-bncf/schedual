import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';
import { validateCSRF } from './csrfHelper.js';

// Stripe Price IDs
const PRICE_IDS = {
  yearly_base: 'price_1Sp7KLBg94UIyRz5TywxTYk0',
  additional_seat: 'price_1Sp7cXBg94UIyRz5V9oOMhRd',
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

    const { manage_subscription = false, additional_seats } = await req.json();

    // Handle billing portal for existing subscriptions
    if (manage_subscription && user.school_id) {
      const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
      const school = schools[0];
      
      let customerId = school?.stripe_customer_id || null;

      // Fallback 1: derive from saved subscription id
      if (!customerId && school?.stripe_subscription_id) {
        try {
          const sub = await stripe.subscriptions.retrieve(school.stripe_subscription_id);
          customerId = sub?.customer || null;
        } catch (e) {
          console.error('Failed to retrieve subscription for customer id fallback:', e?.message || e);
        }
      }

      // Fallback 2: search by user email and persist
      if (!customerId) {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data && customers.data.length > 0) {
          customerId = customers.data[0].id;
          try {
            await base44.asServiceRole.entities.School.update(school.id, { stripe_customer_id: customerId });
          } catch (e) {
            console.error('Failed to persist stripe_customer_id on school:', e?.message || e);
          }
        }
      }

      if (customerId) {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${req.headers.get('origin') || 'https://' + req.headers.get('host')}/Settings?portal=returned`,
        });
        return Response.json({ url: portalSession.url });
      }
      return Response.json({ error: 'Stripe customer not found for this account' }, { status: 404 });
    }

    // Handle additional seats purchase
    if (additional_seats) {
      if (!user.school_id) {
        return Response.json({ error: 'Must have active subscription first' }, { status: 400 });
      }

      const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
      const school = schools[0];
      
      if (!school || (school.subscription_status !== 'active' && school.subscription_status !== 'trialing')) {
        return Response.json({ error: 'Must have active subscription first' }, { status: 400 });
      }

      const quantity = parseInt(additional_seats);
      if (!quantity || quantity < 1) {
        return Response.json({ error: 'Invalid quantity' }, { status: 400 });
      }

      // Create checkout for additional seats
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: PRICE_IDS.additional_seat,
            quantity: quantity,
          },
        ],
        metadata: {
          base44_app_id: Deno.env.get("BASE44_APP_ID"),
          user_id: user.id,
          user_email: user.email,
          school_id: user.school_id,
          purchase_type: 'additional_seats',
          seats_quantity: quantity.toString(),
        },
        customer: school.stripe_customer_id,
        allow_promotion_codes: true,
        success_url: `${req.headers.get('origin') || 'https://' + req.headers.get('host')}/Subscription?seats=success`,
        cancel_url: `${req.headers.get('origin') || 'https://' + req.headers.get('host')}/Subscription?seats=cancelled`,
      });

      return Response.json({ sessionId: session.id, url: session.url });
    }

    // Check if user already has active subscription
    if (user.school_id) {
      const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
      const school = schools[0];
      if (school?.subscription_status === 'active' || school?.subscription_status === 'trialing') {
        return Response.json({ error: 'Already subscribed' }, { status: 400 });
      }
    }

    // Create Stripe checkout session for base subscription
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_IDS.yearly_base,
          quantity: 1,
        },
      ],
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        purchase_type: 'base_subscription',
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