import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    const base44 = createClientFromRequest(req);
    
    let user;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      console.error('Auth error:', authError);
      return Response.json({ error: 'Authentication failed' }, { status: 401 });
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Block SuperAdmin accounts from subscribing
    const SUPER_ADMIN_EMAILS = ['leo.bancroft34@icloud.com', 'erik.gerbst@gmail.com'];
    if (SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      return Response.json({ error: 'SuperAdmin accounts cannot subscribe' }, { status: 403 });
    }

    const { additionalUsers = 0 } = await req.json();

    // Check if user already has active subscription
    if (user.school_id) {
      const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
      if (schools[0]?.subscription_status === 'active') {
        return Response.json({ error: 'Already subscribed' }, { status: 400 });
      }
    }

    // Calculate pricing
    const BASE_PRICE = 1999;
    const STORAGE_PRICE = 240;
    const ADDITIONAL_USER_PRICE = 200;
    const totalAmount = BASE_PRICE + STORAGE_PRICE + (additionalUsers * ADDITIONAL_USER_PRICE);

    // Create Stripe checkout session
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: 'Schedual Yearly Subscription',
                description: `Base platform (€${BASE_PRICE}) + Secure storage (€${STORAGE_PRICE})${additionalUsers > 0 ? ` + ${additionalUsers} additional users (€${additionalUsers * ADDITIONAL_USER_PRICE})` : ''}`,
              },
              unit_amount: totalAmount * 100,
            },
            quantity: 1,
          },
        ],
        metadata: {
          user_id: user.id,
          user_email: user.email,
          user_name: user.full_name,
          additional_users: String(additionalUsers),
        },
        customer_email: user.email,
        success_url: `${req.headers.get('origin') || 'https://' + req.headers.get('host')}/Dashboard?subscription=success`,
        cancel_url: `${req.headers.get('origin') || 'https://' + req.headers.get('host')}/Subscription?subscription=cancelled`,
      });
    } catch (stripeError) {
      console.error('Stripe API Error:', {
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
        param: stripeError.param,
        statusCode: stripeError.statusCode,
        raw: stripeError.raw
      });
      
      return Response.json({ 
        error: `Stripe API Error: ${stripeError.message}`,
        code: stripeError.code,
        type: stripeError.type,
        param: stripeError.param,
        statusCode: stripeError.statusCode
      }, { status: stripeError.statusCode || 500 });
    }

    return Response.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Unexpected Error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    
    return Response.json({ 
      error: `Unexpected error: ${error.message}`,
      name: error.name,
      stack: error.stack
    }, { status: 500 });
  }
});