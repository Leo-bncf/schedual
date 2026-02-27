import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    const base44 = createClientFromRequest(req);

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // Verify webhook signature
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        Deno.env.get("STRIPE_WEBHOOK_SECRET")
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscriptionTier = session.metadata?.subscription_tier;
        const addOns = JSON.parse(session.metadata?.add_ons || '[]');

        // Prefer customer_details email/name from the checkout
        const userEmail = session.customer_details?.email || session.customer_email || null;
        const userName = session.customer_details?.name || session.metadata?.user_name || (userEmail ? userEmail.split('@')[0] : 'New');

        console.log(`🔔 Processing checkout: email=${userEmail || 'unknown'}, Tier=${subscriptionTier}, Add-ons=${addOns.length}`);

        // Retrieve subscription details for period dates/status
        const subscriptionId = session.subscription;
        const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;

        // Try to find an existing user by email (public app may not be logged in at checkout)
        let user = null;
        if (userEmail) {
          const usersByEmail = await base44.asServiceRole.entities.User.filter({ email: userEmail });
          user = usersByEmail[0] || null;
        }

        let school;
        const maxAdminSeats = addOns.includes('unlimited_admin_users') ? 999 : (addOns.includes('extra_admin_user') ? 4 : 3);
        const campusCount = addOns.includes('unlimited_campuses') ? 999 : (addOns.includes('additional_campus') ? 2 : 1);

        if (user?.school_id) {
          // Update existing school for this user
          console.log(`✅ User already has school ${user.school_id}, updating subscription`);
          school = await base44.asServiceRole.entities.School.update(user.school_id, {
            subscription_status: subscription?.status || 'active',
            subscription_tier: subscriptionTier,
            active_add_ons: addOns,
            stripe_customer_id: session.customer,
            stripe_subscription_id: subscriptionId,
            subscription_start_date: subscription ? new Date(subscription.current_period_start * 1000).toISOString() : new Date().toISOString(),
            subscription_current_period_end: subscription ? new Date(subscription.current_period_end * 1000).toISOString() : null,
            max_admin_seats: maxAdminSeats,
            campus_count: campusCount,
          });
        } else {
          // Create a new school record
          school = await base44.asServiceRole.entities.School.create({
            name: `${userName}'s School`,
            code: `SCH-${Date.now()}`,
            subscription_status: subscription?.status || 'active',
            subscription_tier: subscriptionTier,
            active_add_ons: addOns,
            stripe_customer_id: session.customer,
            stripe_subscription_id: subscriptionId,
            subscription_start_date: subscription ? new Date(subscription.current_period_start * 1000).toISOString() : new Date().toISOString(),
            subscription_current_period_end: subscription ? new Date(subscription.current_period_end * 1000).toISOString() : null,
            max_admin_seats: maxAdminSeats,
            campus_count: campusCount,
          });
          console.log(`✅ School ${school.id} created with tier: ${subscriptionTier}`);

          if (user) {
            // Assign existing user to school
            await base44.asServiceRole.entities.User.update(user.id, { school_id: school.id });
            console.log(`✅ User ${user.email} assigned to school ${school.id}`);
          } else if (userEmail) {
            // No user yet — create a PendingInvitation so that when they sign up, they'll be assigned automatically
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await base44.asServiceRole.entities.PendingInvitation.create({
              email: userEmail,
              school_id: school.id,
              invited_by: 'stripe_checkout',
              expires_at: expiresAt,
            });
            console.log(`📨 PendingInvitation created for ${userEmail} -> school ${school.id}`);
          } else {
            console.warn('⚠️ No email found on checkout.session; cannot pre-link user.');
          }
        }

        console.log(`✅ Subscription activated for school ${school.id}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const schools = await base44.asServiceRole.entities.School.filter({
          stripe_customer_id: customerId,
        });

        if (schools.length > 0) {
          const school = schools[0];
          await base44.asServiceRole.entities.School.update(school.id, {
            subscription_status: subscription.status,
            subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          });

          console.log(`✅ Subscription updated for school ${school.id}: ${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const schools = await base44.asServiceRole.entities.School.filter({
          stripe_customer_id: customerId,
        });

        if (schools.length > 0) {
          const school = schools[0];
          await base44.asServiceRole.entities.School.update(school.id, {
            subscription_status: 'canceled',
          });

          console.log(`✅ Subscription cancelled for school ${school.id}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const schools = await base44.asServiceRole.entities.School.filter({
          stripe_customer_id: customerId,
        });

        if (schools.length > 0 && invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const school = schools[0];
          await base44.asServiceRole.entities.School.update(school.id, {
            subscription_status: subscription.status,
            subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          });

          console.log(`✅ Payment succeeded for school ${school.id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const schools = await base44.asServiceRole.entities.School.filter({
          stripe_customer_id: customerId,
        });

        if (schools.length > 0) {
          const school = schools[0];
          await base44.asServiceRole.entities.School.update(school.id, {
            subscription_status: 'past_due',
          });

          console.log(`⚠️ Payment failed for school ${school.id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});