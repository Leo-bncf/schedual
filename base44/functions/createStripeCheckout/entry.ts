import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@18.1.1';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const TIER_PRICE_IDS = {
  tier1: Deno.env.get('STRIPE_PRICE_ID_TIER1'),
  tier2: Deno.env.get('STRIPE_PRICE_ID_TIER2'),
  tier3: Deno.env.get('STRIPE_PRICE_ID_TIER3'),
};

Deno.serve(async (req) => {
  try {
    createClientFromRequest(req);
    const body = await req.json();
    const { priceId, tier, userEmail } = body || {};

    const normalizedEmail = String(userEmail || '').trim().toLowerCase();
    if (!priceId || !tier || !normalizedEmail) {
      return Response.json({ error: 'Missing checkout details' }, { status: 400 });
    }
    if (!normalizedEmail.includes('@')) {
      return Response.json({ error: 'Invalid user email' }, { status: 400 });
    }

    const expectedPriceId = TIER_PRICE_IDS[tier];
    if (!expectedPriceId) {
      return Response.json({ error: 'Stripe price is not configured for this tier' }, { status: 500 });
    }
    if (priceId !== expectedPriceId) {
      return Response.json({ error: 'Invalid tier price selection' }, { status: 400 });
    }

    const referer = req.headers.get('referer') || '';
    const originHeader = req.headers.get('origin') || '';
    const origin = originHeader || (referer ? new URL(referer).origin : '');

    if (!origin) {
      return Response.json({ error: 'Missing app origin' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: expectedPriceId, quantity: 1 }],
      success_url: `${origin}/PaymentSuccess?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/Settings?stripe=cancelled`,
      customer_email: normalizedEmail,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        tier,
        user_email: normalizedEmail,
        price_id: expectedPriceId,
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createStripeCheckout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});