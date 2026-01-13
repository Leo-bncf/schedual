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
        const userId = session.metadata.user_id;
        const userEmail = session.metadata.user_email;
        const userName = session.metadata.user_name;
        const plan = session.metadata.plan;

        console.log(`🔔 Processing checkout completion for user ${userEmail}`);

        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Check if user already has a school
        const users = await base44.asServiceRole.entities.User.filter({ id: userId });
        const user = users[0];
        
        let school;
        if (user?.school_id) {
          // Update existing school
          console.log(`✅ User already has school ${user.school_id}, updating subscription`);
          school = await base44.asServiceRole.entities.School.update(user.school_id, {
            subscription_status: subscription.status,
            subscription_plan: plan,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
            subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          });
        } else {
          // Create new school
          school = await base44.asServiceRole.entities.School.create({
            name: `${userName}'s School`,
            code: `SCH-${Date.now()}`,
            subscription_status: subscription.status,
            subscription_plan: plan,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
            subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            max_admin_seats: 3,
          });
          console.log(`✅ School ${school.id} created`);

          // Assign school to user
          await base44.asServiceRole.entities.User.update(userId, {
            school_id: school.id
          });
          console.log(`✅ User ${userEmail} assigned to school ${school.id}`);
        }

        console.log(`✅ Subscription activated for school ${school.id}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const schools = await base44.asServiceRole.entities.School.filter({
          stripe_customer_id: customerId
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
          stripe_customer_id: customerId
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
          stripe_customer_id: customerId
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
          stripe_customer_id: customerId
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