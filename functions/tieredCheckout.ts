import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';


// Stripe Price IDs for Tiers
const TIER_PRICES = {
  yearly: {
    tier1: 'price_1Sp8n9BSrrEzDDMYT2rMz4gt',
    tier2: 'price_1Sp8n9BSrrEzDDMYhd3bxTWY',
    tier3: 'price_1Sp8n9BSrrEzDDMY5KQsLjdU',
  },
  monthly: {
    tier1: 'price_1T5OhnBg94UIyRz5rMoxLvfs',
    tier2: 'price_1T5OhnBg94UIyRz5t8TggLA3',
    tier3: 'price_1T5OhnBg94UIyRz5FjJJV2MA',
  }
};

// Add-on Price IDs
const ADDON_PRICES = {
  yearly: {
    extra_admin_user: 'price_1Sp7sTBg94UIyRz5yhWAjB7w',
    unlimited_admin_users: 'price_1Sp7sTBg94UIyRz54p7fg05F',
    additional_campus: 'price_1Sp7sTBg94UIyRz5wSmD65KQ',
    unlimited_campuses: 'price_1Sp7sTBg94UIyRz5QPatOiNv',
    multiple_timetable_scenarios: 'price_1Sp7sTBg94UIyRz5Scam19c4',
    managebac_integration: 'price_1Sp7sTBg94UIyRz5C3TLD51g',
    custom_sis_integration_yearly: 'price_1Sp7sTBg94UIyRz53iv5qtif',
    custom_sis_integration_onetime: 'price_1Sp7sTBg94UIyRz5koYvxU95',

    priority_support: 'price_1Sp7sTBg94UIyRz59DpBNEKB',
    dedicated_account_manager: 'price_1Sp7sTBg94UIyRz5taDoIsST',
    onboarding_setup: 'price_1Sp7sTBg94UIyRz5tyz6y98R',
  },
  monthly: {
    extra_admin_user: 'price_1T5OhnBg94UIyRz54nGunyYC',
    unlimited_admin_users: 'price_1T5OhnBg94UIyRz5jhT6x0N8',
    additional_campus: 'price_1T5OhnBg94UIyRz5itBvA1Ge',
    unlimited_campuses: 'price_1T5OhnBg94UIyRz5MFwq05JD',
    multiple_timetable_scenarios: 'price_1T5OhnBg94UIyRz5ZUyfFIgb',
    managebac_integration: 'price_1T5OhnBg94UIyRz5lP3MVuXf',
    custom_sis_integration_yearly: 'price_1T5OhnBg94UIyRz5oxSEhgmp',
    custom_sis_integration_onetime: 'price_1Sp7sTBg94UIyRz5koYvxU95',
    priority_support: 'price_1T5OhnBg94UIyRz5H6pS58qQ',
    dedicated_account_manager: 'price_1T5OhnBg94UIyRz59WWoGi0N',
    onboarding_setup: 'price_1Sp7sTBg94UIyRz5tyz6y98R',
  }
};

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    const origin = req.headers.get('origin') || ('https://' + req.headers.get('host'));

    const body = await req.json().catch(() => ({}));
    const { tier, add_ons = [], customer_email: customerEmail, billing_interval = 'yearly' } = body || {};

    // Validate tier
    if (!tier || !['tier1', 'tier2', 'tier3'].includes(tier)) {
      return Response.json({ error: 'Invalid tier selected' }, { status: 400 });
    }

    const interval = billing_interval === 'monthly' ? 'monthly' : 'yearly';

    // Build line items: tier + add-ons
    const lineItems = [
      { price: TIER_PRICES[interval][tier], quantity: 1 },
    ];

    for (const addonKey of add_ons) {
      if (ADDON_PRICES[interval][addonKey]) {
        lineItems.push({ price: ADDON_PRICES[interval][addonKey], quantity: 1 });
      }
    }

    // Create Stripe checkout session (public app - no auth required)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      // Bind checkout to the email used in the app when available
      customer_email: customerEmail || undefined,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        subscription_tier: tier,
        add_ons: JSON.stringify(add_ons),
        user_email: customerEmail || '',
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