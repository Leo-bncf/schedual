import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';


// Stripe Price IDs for Tiers
const TIER_PRICES = {
  yearly: {
    tier1: 'price_1T5PS4Bg94UIyRz5AOiMVMd0',
    tier2: 'price_1T5PS3Bg94UIyRz5kv8hajb4',
    tier3: 'price_1T5PS4Bg94UIyRz5LABgkbSp',
  },
  monthly: {
    tier1: 'price_1T5PS4Bg94UIyRz5IQmSUnsb',
    tier2: 'price_1T5PS4Bg94UIyRz5wE4V2Ijd',
    tier3: 'price_1T5PS4Bg94UIyRz5E7Nucqve',
  }
};

// Add-on Price IDs
const ADDON_PRICES = {
  yearly: {
    extra_admin_user: 'price_1T5PS4Bg94UIyRz5KYMqHML5',
    unlimited_admin_users: 'price_1T5PS4Bg94UIyRz5x2PKE060',
    additional_campus: 'price_1T5PS4Bg94UIyRz5kNdxbiPO',
    unlimited_campuses: 'price_1T5PS4Bg94UIyRz5N61IuJ1G',
    multiple_timetable_scenarios: 'price_1T5PS4Bg94UIyRz5e42GQGvG',
    priority_support: 'price_1T5PS4Bg94UIyRz5U5Ct0chF',
    onboarding_setup: 'price_1T5PS4Bg94UIyRz5Tkzo4puP',
  },
  monthly: {
    extra_admin_user: 'price_1T5PS4Bg94UIyRz58jzHqKkN',
    unlimited_admin_users: 'price_1T5PS4Bg94UIyRz5u6e52a8b',
    additional_campus: 'price_1T5PS4Bg94UIyRz5j0aQRguF',
    unlimited_campuses: 'price_1T5PS4Bg94UIyRz5O595f0j5',
    multiple_timetable_scenarios: 'price_1T5PS4Bg94UIyRz58nh8SDYL',
    priority_support: 'price_1T5PS4Bg94UIyRz52IluR5tD',
    onboarding_setup: 'price_1T5PS4Bg94UIyRz5Tkzo4puP',
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