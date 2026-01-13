import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

// Stripe Price IDs for Tiers (must match your Stripe catalog)
const TIER_PRICES = {
  tier1: 'price_1Sp7sSBg94UIyRz5aR82NG1w',
  tier2: 'price_1Sp7sTBg94UIyRz5ZESEurY5',
  tier3: 'price_1Sp7sTBg94UIyRz5cgiWKA3k',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Superadmin check via env list
    const superAdminEmailsStr = Deno.env.get('SUPER_ADMIN_EMAILS') || '';
    const SUPER_ADMIN_EMAILS = superAdminEmailsStr
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!SUPER_ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden: Superadmin only' }, { status: 403 });
    }

    const { school_id, tier } = await req.json();
    if (!school_id || !tier || !TIER_PRICES[tier]) {
      return Response.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    const schools = await base44.asServiceRole.entities.School.filter({ id: school_id });
    if (schools.length === 0) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }
    const school = schools[0];

    let updatedSubscriptionEnd = school.subscription_current_period_end || null;

    if (school.stripe_subscription_id) {
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
      const sub = await stripe.subscriptions.retrieve(school.stripe_subscription_id, { expand: ['items'] });

      // Find existing tier item in subscription
      const tierPriceIds = Object.values(TIER_PRICES);
      const tierItem = sub.items.data.find((it) => tierPriceIds.includes(it.price.id));

      if (tierItem && tierItem.price.id === TIER_PRICES[tier]) {
        // No change needed
      } else if (tierItem) {
        await stripe.subscriptions.update(sub.id, {
          items: [{ id: tierItem.id, price: TIER_PRICES[tier] }],
          proration_behavior: 'create_prorations',
        });
      } else {
        // No tier item found - add one
        await stripe.subscriptions.update(sub.id, {
          items: [{ price: TIER_PRICES[tier], quantity: 1 }],
          proration_behavior: 'create_prorations',
        });
      }

      const refreshed = await stripe.subscriptions.retrieve(sub.id);
      updatedSubscriptionEnd = new Date(refreshed.current_period_end * 1000).toISOString();
    }

    const updated = await base44.asServiceRole.entities.School.update(school_id, {
      subscription_tier: tier,
      subscription_current_period_end: updatedSubscriptionEnd,
    });

    return Response.json({ success: true, school: updated });
  } catch (error) {
    console.error('updateSchoolTier error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});