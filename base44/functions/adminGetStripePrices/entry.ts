import Stripe from 'npm:stripe@18.1.1';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const superAdmins = (Deno.env.get('SUPER_ADMIN_EMAILS') || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!superAdmins.includes((user.email || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const priceIds: Record<string, string | undefined> = {
      tier1: Deno.env.get('STRIPE_PRICE_ID_TIER1'),
      tier2: Deno.env.get('STRIPE_PRICE_ID_TIER2'),
      tier3: Deno.env.get('STRIPE_PRICE_ID_TIER3'),
    };

    const prices: Record<string, { amount_cents: number; monthly_cents: number; currency: string; interval: string }> = {};

    await Promise.all(
      Object.entries(priceIds).map(async ([tier, priceId]) => {
        if (!priceId) return;
        try {
          const price = await stripe.prices.retrieve(priceId);
          const amount = price.unit_amount ?? 0;
          const interval = price.recurring?.interval ?? 'month';
          prices[tier] = {
            amount_cents: amount,
            // Normalise annual prices to monthly for MRR display
            monthly_cents: interval === 'year' ? Math.round(amount / 12) : amount,
            currency: price.currency,
            interval,
          };
        } catch (e) {
          console.warn(`[adminGetStripePrices] Failed to fetch ${tier} (${priceId}):`, e.message);
        }
      })
    );

    return Response.json({ success: true, prices });
  } catch (error) {
    console.error('[adminGetStripePrices] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
