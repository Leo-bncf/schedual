import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

// Map tier/add-on price IDs to keys
const TIER_PRICES = {
  tier1: 'price_1Sp8n9BSrrEzDDMYT2rMz4gt',
  tier2: 'price_1Sp8n9BSrrEzDDMYhd3bxTWY',
  tier3: 'price_1Sp8n9BSrrEzDDMY5KQsLjdU',
};

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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.school_id) {
      return Response.json({ assigned: false, reason: 'already_assigned' });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (!customers.data || customers.data.length === 0) {
      console.log(`Reconcile: no customer for ${user.email}`);
      return Response.json({ assigned: false, reason: 'no_customer' });
    }

    const customer = customers.data[0];

    // Get latest active/trialing subscription
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 10 });
    const activeSub = subs.data.find(s => ['active', 'trialing'].includes(s.status));
    if (!activeSub) {
      console.log(`Reconcile: no active subscription for ${user.email}`);
      return Response.json({ assigned: false, reason: 'no_active_subscription' });
    }

    // Determine tier and add-ons by matching price IDs
    const itemPriceIds = activeSub.items.data.map(i => i.price.id);

    const tierEntry = Object.entries(TIER_PRICES).find(([key, priceId]) => itemPriceIds.includes(priceId));
    const subscriptionTier = tierEntry ? tierEntry[0] : null;

    const addOns = Object.entries(ADDON_PRICES)
      .filter(([, priceId]) => itemPriceIds.includes(priceId))
      .map(([key]) => key);

    // Check if there's already a school for this Stripe customer
    const schools = await base44.asServiceRole.entities.School.filter({ stripe_customer_id: customer.id });

    let school;
    if (schools.length > 0) {
      school = await base44.asServiceRole.entities.School.update(schools[0].id, {
        subscription_status: activeSub.status,
        subscription_tier: subscriptionTier,
        active_add_ons: addOns,
        stripe_customer_id: customer.id,
        stripe_subscription_id: activeSub.id,
        subscription_start_date: new Date(activeSub.current_period_start * 1000).toISOString(),
        subscription_current_period_end: new Date(activeSub.current_period_end * 1000).toISOString(),
        max_admin_seats: addOns.includes('unlimited_admin_users') ? 999 : (schools[0].max_admin_seats || 3),
        campus_count: addOns.includes('unlimited_campuses') ? 999 : (schools[0].campus_count || 1),
      });
    } else {
      const userName = user.full_name || (user.email ? user.email.split('@')[0] : 'New');
      school = await base44.asServiceRole.entities.School.create({
        name: `${userName}'s School`,
        code: `SCH-${Date.now()}`,
        subscription_status: activeSub.status,
        subscription_tier: subscriptionTier,
        active_add_ons: addOns,
        stripe_customer_id: customer.id,
        stripe_subscription_id: activeSub.id,
        subscription_start_date: new Date(activeSub.current_period_start * 1000).toISOString(),
        subscription_current_period_end: new Date(activeSub.current_period_end * 1000).toISOString(),
        max_admin_seats: addOns.includes('unlimited_admin_users') ? 999 : 3,
        campus_count: addOns.includes('unlimited_campuses') ? 999 : 1,
      });
    }

    await base44.asServiceRole.entities.User.update(user.id, { school_id: school.id });

    console.log(`Reconcile: linked user ${user.email} to school ${school.id}`);

    return Response.json({ assigned: true, schoolId: school.id, subscriptionTier, addOns });
  } catch (error) {
    console.error('Reconcile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});