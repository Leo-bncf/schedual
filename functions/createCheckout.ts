import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized or no school assigned' }, { status: 401 });
    }

    const { additionalUsers = 0 } = await req.json();

    // Get school details
    const schools = await base44.entities.School.filter({ id: user.school_id });
    const school = schools[0];

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    // Calculate pricing
    const BASE_PRICE = 1999;
    const STORAGE_PRICE = 240;
    const ADDITIONAL_USER_PRICE = 200;
    const totalAmount = BASE_PRICE + STORAGE_PRICE + (additionalUsers * ADDITIONAL_USER_PRICE);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Schedual Yearly Subscription',
              description: `Base platform (€${BASE_PRICE}) + Secure storage (€${STORAGE_PRICE})${additionalUsers > 0 ? ` + ${additionalUsers} additional users (€${additionalUsers * ADDITIONAL_USER_PRICE})` : ''}`,
            },
            unit_amount: totalAmount * 100,
            recurring: {
              interval: 'year',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        school_id: school.id,
        school_name: school.name,
        additional_users: String(additionalUsers),
        user_email: user.email,
      },
      customer_email: user.email,
      success_url: `${req.headers.get('origin')}/Dashboard?subscription=success`,
      cancel_url: `${req.headers.get('origin')}/Subscription?subscription=cancelled`,
    });

    return Response.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout creation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});