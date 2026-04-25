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

async function ensureSchoolForUser(base44, user, session) {
  const customerEmail = session.customer_details?.email || session.customer_email || user.email;
  const tier = session.metadata?.tier;
  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!tier || !stripeCustomerId) {
    throw new Error('Missing tier or Stripe customer id');
  }

  const limits = getTierDefinition(tier);
  const periodEnd = session.subscription_details?.current_period_end
    ? new Date(session.subscription_details.current_period_end * 1000).toISOString()
    : null;

  const userSchoolId = user.school_id || user.data?.school_id;

  if (userSchoolId) {
    const userSchools = await base44.asServiceRole.entities.School.filter({ id: userSchoolId });
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

      if (user.role !== 'user') {
        await base44.asServiceRole.entities.User.update(user.id, { role: 'user' });
      }

      return { schoolId: userSchool.id, created: false };
    }
  }

  const existingSchools = await base44.asServiceRole.entities.School.filter({ stripe_customer_id: stripeCustomerId });
  const matchingSchool = existingSchools[0];

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

    await base44.asServiceRole.entities.User.update(user.id, { school_id: matchingSchool.id, role: 'user' });
    return { schoolId: matchingSchool.id, created: false };
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

  await base44.asServiceRole.entities.User.update(user.id, { school_id: createdSchool.id, role: 'user' });
  return { schoolId: createdSchool.id, created: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { sessionId } = await req.json();
    if (!sessionId) {
      return Response.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return Response.json({ error: 'Stripe session is not paid yet' }, { status: 400 });
    }

    const sessionEmail = session.customer_details?.email || session.customer_email || session.metadata?.user_email || null;
    if (!sessionEmail) {
      return Response.json({ error: 'Missing customer email on Stripe session' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: sessionEmail.toLowerCase() });
    const user = users[0];
    if (!user) {
      return Response.json({ error: 'No user found for this payment email' }, { status: 404 });
    }

    const result = await ensureSchoolForUser(base44, user, session);

    return Response.json({
      success: true,
      schoolId: result.schoolId,
      created: result.created,
    });
  } catch (error) {
    console.error('confirmStripeCheckout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});