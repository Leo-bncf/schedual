import Stripe from 'npm:stripe@18.1.1';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

function getTierDefinition(tierId) {
  const tierMap = {
    tier1: {
      max_admin_seats: 1,
      student_count_limit: 200,
      generation_limit: 3,
      saved_versions_limit: 3,
      support_level: 'Email support (48h)',
      onboarding_call_included: false,
    },
    tier2: {
      max_admin_seats: 3,
      student_count_limit: 600,
      generation_limit: null,
      saved_versions_limit: null,
      support_level: 'Email support (24h)',
      onboarding_call_included: false,
    },
    tier3: {
      max_admin_seats: null,
      student_count_limit: 1200,
      generation_limit: null,
      saved_versions_limit: null,
      support_level: 'Priority support (same day)',
      onboarding_call_included: true,
    },
  };

  return tierMap[tierId] || tierMap.tier2;
}

function getTierSettings(tierId, existingSettings = {}) {
  const tier = getTierDefinition(tierId);

  return {
    ...existingSettings,
    generation_limit: tier.generation_limit,
    saved_versions_limit: tier.saved_versions_limit,
    student_count_limit: tier.student_count_limit,
    support_level: tier.support_level,
    onboarding_call_included: tier.onboarding_call_included,
  };
}

function buildSchoolCode(email) {
  const prefix = (email || 'SCH').split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'SCH';
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

function buildSchoolId(stripeCustomerId) {
  const cleaned = (stripeCustomerId || 'school').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-10) || 'SCHOOL';
  return `SCH-${cleaned}`;
}

async function ensureSchoolForCustomer(base44, session) {
  const customerEmail = session.customer_details?.email || session.customer_email;
  const tier = session.metadata?.tier;
  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!customerEmail || !tier || !stripeCustomerId) {
    throw new Error('Missing customer email, tier, or Stripe customer id');
  }

  const users = await base44.asServiceRole.entities.User.filter({ email: customerEmail });
  if (users.length === 0) {
    console.error('[stripeWebhook] No Base44 user found for paid customer', customerEmail);
    return { linkedUser: false, schoolId: null };
  }

  const user = users[0];
  const existingSchools = await base44.asServiceRole.entities.School.filter({ stripe_customer_id: stripeCustomerId });
  const matchingSchool = existingSchools[0];
  const limits = getTierDefinition(tier);
  const periodEnd = session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null;

  if (matchingSchool) {
    await base44.asServiceRole.entities.School.update(matchingSchool.id, {
      subscription_status: 'active',
      subscription_tier: tier,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      subscription_start_date: matchingSchool.subscription_start_date || new Date().toISOString(),
      subscription_current_period_end: periodEnd,
      max_admin_seats: limits.max_admin_seats,
      settings: getTierSettings(tier, matchingSchool.settings),
      school_id: matchingSchool.school_id || buildSchoolId(stripeCustomerId),
    });

    if (user.school_id !== matchingSchool.id || user.role !== 'admin') {
      await base44.asServiceRole.entities.User.update(user.id, { school_id: matchingSchool.id, role: 'admin' });
    }

    return { linkedUser: true, schoolId: matchingSchool.id };
  }

  if (user.school_id) {
    const userSchools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
    const userSchool = userSchools[0];
    if (userSchool) {
      await base44.asServiceRole.entities.School.update(userSchool.id, {
        subscription_status: 'active',
        subscription_tier: tier,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_start_date: userSchool.subscription_start_date || new Date().toISOString(),
        subscription_current_period_end: periodEnd,
        max_admin_seats: limits.max_admin_seats,
        settings: getTierSettings(tier, userSchool.settings),
        school_id: userSchool.school_id || buildSchoolId(stripeCustomerId),
      });
      if (user.role !== 'admin') {
        await base44.asServiceRole.entities.User.update(user.id, { role: 'admin' });
      }
      return { linkedUser: true, schoolId: userSchool.id };
    }
  }

  const createdSchool = await base44.asServiceRole.entities.School.create({
    name: session.customer_details?.name || `${customerEmail.split('@')[0]}'s School`,
    code: buildSchoolCode(customerEmail),
    school_id: buildSchoolId(stripeCustomerId),
    timezone: 'UTC',
    academic_year: '2026-2027',
    subscription_status: 'active',
    subscription_tier: tier,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    subscription_start_date: new Date().toISOString(),
    subscription_current_period_end: periodEnd,
    max_admin_seats: limits.max_admin_seats,
    settings: getTierSettings(tier, {}),
  });

  await base44.asServiceRole.entities.User.update(user.id, { school_id: createdSchool.id, role: 'admin' });

  return { linkedUser: true, schoolId: createdSchool.id };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return Response.json({ error: 'Missing Stripe signature' }, { status: 400 });
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const result = await ensureSchoolForCustomer(base44, session);
      console.log('[stripeWebhook] checkout.session.completed processed', result);
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      if (customerId) {
        const schools = await base44.asServiceRole.entities.School.filter({ stripe_customer_id: customerId });
        const school = schools[0];
        if (school) {
          await base44.asServiceRole.entities.School.update(school.id, {
            subscription_status: subscription.status,
            stripe_subscription_id: typeof subscription.id === 'string' ? subscription.id : school.stripe_subscription_id,
            subscription_current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : school.subscription_current_period_end,
            school_id: school.school_id || buildSchoolId(customerId),
            settings: {
              ...(school.settings || {}),
              support_level: school.settings?.support_level || null,
              onboarding_call_included: school.settings?.onboarding_call_included || false,
              generation_limit: school.settings?.generation_limit ?? null,
              saved_versions_limit: school.settings?.saved_versions_limit ?? null,
              student_count_limit: school.settings?.student_count_limit ?? null,
            },
          });
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('[stripeWebhook] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});