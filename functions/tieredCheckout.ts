import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';


// Stripe Price IDs for Tiers
const TIER_PRICES = {
  tier1: 'price_1Sp8n9BSrrEzDDMYT2rMz4gt',
  tier2: 'price_1Sp8n9BSrrEzDDMYhd3bxTWY',
  tier3: 'price_1Sp8n9BSrrEzDDMY5KQsLjdU',
};

// Add-on Price IDs (all recurring yearly except noted)
const ADDON_PRICES = {
  extra_admin_user: 'price_1Sp7sTBg94UIyRz5yhWAjB7w',
  unlimited_admin_users: 'price_1Sp7sTBg94UIyRz54p7fg05F',
  additional_campus: 'price_1Sp7sTBg94UIyRz5wSmD65KQ',
  unlimited_campuses: 'price_1Sp7sTBg94UIyRz5QPatOiNv',
  multiple_timetable_scenarios: 'price_1Sp7sTBg94UIyRz5Scam19c4',
  managebac_integration: 'price_1Sp7sTBg94UIyRz5C3TLD51g',
  custom_sis_integration_yearly: 'price_1Sp7sTBg94UIyRz53iv5qtif',
  custom_sis_integration_onetime: 'price_1Sp7sTBg94UIyRz5koYvxU95',
  advanced_constraint_engine: 'price_1Sp7sSBg94UIyRz5sPqlx1wt',
  dp_advanced_logic: 'price_1Sp7sTBg94UIyRz5coslgXS7',
  priority_support: 'price_1Sp7sTBg94UIyRz59DpBNEKB',
  dedicated_account_manager: 'price_1Sp7sTBg94UIyRz5taDoIsST',
  onboarding_setup: 'price_1Sp7sTBg94UIyRz5tyz6y98R',
};

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    const origin = req.headers.get('origin') || ('https://' + req.headers.get('host'));

    const body = await req.json().catch(() => ({}));
    const { tier, add_ons = [] } = body || {};

    // Validate tier
    if (!tier || !['tier1', 'tier2', 'tier3'].includes(tier)) {
      return Response.json({ error: 'Invalid tier selected' }, { status: 400 });
    }

    // Build line items: tier + add-ons
    const lineItems = [
      { price: TIER_PRICES[tier], quantity: 1 },
    ];

    for (const addonKey of add_ons) {
      if (ADDON_PRICES[addonKey]) {
        lineItems.push({ price: ADDON_PRICES[addonKey], quantity: 1 });
      }
    }

    // Create Stripe checkout session (public app - no auth required)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        subscription_tier: tier,
        add_ons: JSON.stringify(add_ons),
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      success_url: `${origin}/SubscriptionTiered?subscription=success`,
      cancel_url: `${origin}/SubscriptionTiered?subscription=cancelled`,
    });

    return Response.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout Error:', error);
    return Response.json({ error: `Error: ${error.message}` }, { status: 500 });
  }
});