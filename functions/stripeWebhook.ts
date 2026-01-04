import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    const base44 = createClientFromRequest(req);
    
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // Verify webhook signature (async for Deno)
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
        const additionalUsers = parseInt(session.metadata.additional_users || '0');

        console.log(`🔔 Processing checkout completion for user ${userEmail}`);

        // Calculate subscription end date (1 year from now)
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        // Check if user already has a school (for existing schools)
        const users = await base44.asServiceRole.entities.User.filter({ id: userId });
        const user = users[0];
        
        let school;
        if (user?.school_id) {
          // User already has a school - update its Stripe info
          console.log(`✅ User already has school ${user.school_id}, updating Stripe info`);
          school = await base44.asServiceRole.entities.School.update(user.school_id, {
            subscription_status: 'active',
            subscription_plan: 'yearly',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_start_date: new Date().toISOString(),
            subscription_end_date: endDate.toISOString(),
            max_additional_users: additionalUsers,
          });
          console.log(`✅ School ${school.id} updated with Stripe info`);
        } else {
          // No school yet - create new one
          try {
            school = await base44.asServiceRole.entities.School.create({
              name: `${userName}'s School`,
              code: `SCH-${Date.now()}`,
              subscription_status: 'active',
              subscription_plan: 'yearly',
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              subscription_start_date: new Date().toISOString(),
              subscription_end_date: endDate.toISOString(),
              max_additional_users: additionalUsers,
            });
            console.log(`✅ School ${school.id} created successfully`);
          } catch (error) {
            console.error(`❌ Failed to create school:`, error);
            throw error;
          }

          // Assign school to user
          try {
            await base44.asServiceRole.entities.User.update(userId, {
              school_id: school.id
            });
            console.log(`✅ User ${userEmail} (${userId}) assigned to school ${school.id}`);
          } catch (error) {
            console.error(`❌ Failed to update user ${userEmail}:`, error);
            throw error;
          }
        }

        console.log(`✅ Subscription activated for school ${school.id}`);
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