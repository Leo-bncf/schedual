import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const TIER_PRICES = {
  tier1: { label: 'Tier 1', unit_amount: 110000 },
  tier2: { label: 'Tier 2', unit_amount: 220000 },
  tier3: { label: 'Tier 3', unit_amount: 495000 },
};

const ADD_ON_PRICES = {
  multiple_timetable_scenarios: { label: 'Multiple Timetable Scenarios', unit_amount: 88000, quantity: 1 },
  priority_support: { label: 'Priority Support', unit_amount: 55000, quantity: 1 },
  unlimited_campuses: { label: 'Unlimited Campuses', unit_amount: 165000, quantity: 1 },
  unlimited_admin_users: { label: 'Unlimited Admin Users', unit_amount: 82500, quantity: 1 },
};

function getAllowedEmails() {
  return String(Deno.env.get('SUPER_ADMIN_EMAILS') || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function buildInvoiceLineItems(school) {
  const lineItems = [];
  const tier = TIER_PRICES[school.subscription_tier];
  if (tier) {
    lineItems.push({
      description: `${tier.label} annual subscription`,
      unit_amount: tier.unit_amount,
      quantity: 1,
    });
  }

  for (const addOn of school.active_add_ons || []) {
    const config = ADD_ON_PRICES[addOn];
    if (config) {
      lineItems.push({
        description: config.label,
        unit_amount: config.unit_amount,
        quantity: config.quantity,
      });
    }
  }

  if (!(school.active_add_ons || []).includes('unlimited_admin_users')) {
    const extraAdminSeats = Math.max(0, Number(school.max_admin_seats || 3) - 3);
    if (extraAdminSeats > 0) {
      lineItems.push({
        description: 'Extra Admin User',
        unit_amount: 27500,
        quantity: extraAdminSeats,
      });
    }
  }

  if (!(school.active_add_ons || []).includes('unlimited_campuses')) {
    const additionalCampuses = Math.max(0, Number(school.campus_count || 1) - 1);
    if (additionalCampuses > 0) {
      lineItems.push({
        description: 'Additional Campus',
        unit_amount: 66000,
        quantity: additionalCampuses,
      });
    }
  }

  return lineItems;
}

function mapInvoice(invoice) {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    amount_due: invoice.amount_due,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    hosted_invoice_url: invoice.hosted_invoice_url,
    invoice_pdf: invoice.invoice_pdf,
    created: invoice.created,
    dashboard_url: `https://dashboard.stripe.com/invoices/${invoice.id}`,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!getAllowedEmails().includes(String(user.email || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action = 'list', school_id } = body;

    if (!school_id) {
      return Response.json({ error: 'school_id is required' }, { status: 400 });
    }

    const schools = await base44.asServiceRole.entities.School.filter({ id: school_id });
    const school = schools[0];
    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    if (!school.stripe_customer_id) {
      return Response.json({ error: 'This school has no Stripe customer ID yet.' }, { status: 400 });
    }

    const lineItems = buildInvoiceLineItems(school);
    const preview = {
      school_id: school.id,
      school_name: school.name,
      subscription_tier: school.subscription_tier,
      line_items: lineItems,
      total_amount: lineItems.reduce((sum, item) => sum + item.unit_amount * item.quantity, 0),
    };

    if (action === 'create') {
      for (const item of lineItems) {
        await stripe.invoiceItems.create({
          customer: school.stripe_customer_id,
          currency: 'usd',
          unit_amount: item.unit_amount,
          quantity: item.quantity,
          description: item.description,
          metadata: {
            school_id: school.id,
            school_name: school.name,
            base44_app_id: Deno.env.get('BASE44_APP_ID'),
          },
        });
      }

      const draftInvoice = await stripe.invoices.create({
        customer: school.stripe_customer_id,
        collection_method: 'send_invoice',
        days_until_due: 14,
        metadata: {
          school_id: school.id,
          school_name: school.name,
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
        },
      });

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(draftInvoice.id);
      const invoiceList = await stripe.invoices.list({ customer: school.stripe_customer_id, limit: 10 });

      return Response.json({
        ok: true,
        preview,
        created_invoice: mapInvoice(finalizedInvoice),
        invoices: invoiceList.data.map(mapInvoice),
      });
    }

    const invoices = await stripe.invoices.list({ customer: school.stripe_customer_id, limit: 10 });
    return Response.json({
      ok: true,
      preview,
      invoices: invoices.data.map(mapInvoice),
    });
  } catch (error) {
    console.error('[adminSchoolInvoices] ERROR', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});