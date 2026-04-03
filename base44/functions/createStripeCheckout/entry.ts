import Stripe from 'npm:stripe@18.1.1';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const TIER_PRICE_IDS = {
  tier1: 'price_1THYLAD8slkoqOiBqzij9LlB',
  tier2: 'price_1THYLAD8slkoqOiBI0rA7cCR',
  tier3: 'price_1THYLAD8slkoqOiBQCaKAj2z',
};

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { priceId, tier } = body || {};

    if (!priceId || !tier) {
      return Response.json({ error: 'Missing checkout details' }, { status: 400 });
    }

    const expectedPriceId = TIER_PRICE_IDS[tier];
    if (!expectedPriceId || priceId !== expectedPriceId) {
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
      success_url: `${origin}/Settings?stripe=success&tier=${tier}`,
      cancel_url: `${origin}/Settings?stripe=cancelled`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        tier,
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createStripeCheckout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});