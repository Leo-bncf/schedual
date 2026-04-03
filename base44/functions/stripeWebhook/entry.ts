import Stripe from 'npm:stripe@18.1.1';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const TIER_LIMITS = {
  tier1: { max_admin_seats: 1 },
  tier2: { max_admin_seats: 3 },
  tier3: { max_admin_seats: 9999 },
};

function buildSchoolCode(email) {
  const prefix = (email || 'SCH').split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'SCH';
  return `${prefix}-${Date.now().toString().slice(-4)}`;
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
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.tier2;
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
    });

    if (user.school_id !== matchingSchool.id) {
      await base44.asServiceRole.entities.User.update(user.id, { school_id: matchingSchool.id });
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
      });
      return { linkedUser: true, schoolId: userSchool.id };
    }
  }

  const createdSchool = await base44.asServiceRole.entities.School.create({
    name: session.customer_details?.name || `${customerEmail.split('@')[0]}'s School`,
    code: buildSchoolCode(customerEmail),
    timezone: 'UTC',
    academic_year: '2026-2027',
    subscription_status: 'active',
    subscription_tier: tier,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    subscription_start_date: new Date().toISOString(),
    subscription_current_period_end: periodEnd,
    max_admin_seats: limits.max_admin_seats,
  });

  await base44.asServiceRole.entities.User.update(user.id, { school_id: createdSchool.id });

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