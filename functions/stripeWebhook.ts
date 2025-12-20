import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
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
        const schoolId = session.metadata.school_id;
        const additionalUsers = parseInt(session.metadata.additional_users || '0');

        // Calculate subscription end date (1 year from now)
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        // Update school with subscription info
        await base44.asServiceRole.entities.School.update(schoolId, {
          subscription_status: 'active',
          subscription_plan: 'yearly',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: endDate.toISOString(),
          max_additional_users: additionalUsers,
        });

        console.log(`✅ Subscription activated for school ${schoolId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find school by customer ID
        const schools = await base44.asServiceRole.entities.School.filter({
          stripe_customer_id: customerId
        });

        if (schools.length > 0) {
          const school = schools[0];
          const status = subscription.status === 'active' ? 'active' : 
                        subscription.status === 'past_due' ? 'past_due' : 
                        subscription.status === 'canceled' ? 'cancelled' : 'inactive';

          await base44.asServiceRole.entities.School.update(school.id, {
            subscription_status: status,
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
          });

          console.log(`✅ Subscription updated for school ${school.id}: ${status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find school by customer ID
        const schools = await base44.asServiceRole.entities.School.filter({
          stripe_customer_id: customerId
        });

        if (schools.length > 0) {
          const school = schools[0];
          await base44.asServiceRole.entities.School.update(school.id, {
            subscription_status: 'cancelled',
          });

          console.log(`✅ Subscription cancelled for school ${school.id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Find school by customer ID
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