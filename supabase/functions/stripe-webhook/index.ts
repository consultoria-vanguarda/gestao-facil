import Stripe from 'https://esm.sh/stripe@16.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

type BillingUpdate = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  subscription_plan: string | null;
  subscription_current_period_end: string | null;
  stripe_last_event_id: string;
  stripe_synced_at: string;
  read_only_reason: string | null;
};

function mapStatusToReadOnlyReason(status: string): string | null {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'trialing' || normalized === 'active') return null;
  return `subscription_${normalized || 'inactive'}`;
}

function extractPlanNickname(subscription: Stripe.Subscription): string | null {
  const firstItem = subscription.items.data[0];
  const nickname = firstItem?.price?.nickname?.trim();
  return nickname || firstItem?.price?.id || null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecret = requiredEnv('STRIPE_SECRET_KEY');
    const webhookSecret = requiredEnv('STRIPE_WEBHOOK_SECRET');

    const signature = req.headers.get('stripe-signature');
    if (!signature) return new Response('Missing stripe-signature', { status: 400 });

    const payload = await req.text();
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });
    const event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const upsertOrganizationByCustomer = async (customerId: string, update: BillingUpdate) => {
      const { data: org, error: orgErr } = await admin
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      if (orgErr || !org?.id) {
        console.error('stripe-webhook organization not found:', customerId, orgErr);
        return;
      }

      await admin.from('organizations').update(update).eq('id', org.id);
      await admin.from('organization_subscription_events').insert({
        organization_id: org.id,
        stripe_event_id: event.id,
        stripe_event_type: event.type,
        stripe_customer_id: update.stripe_customer_id,
        stripe_subscription_id: update.stripe_subscription_id,
        payload: event as unknown as Record<string, unknown>,
      });
    };

    if (event.type.startsWith('customer.subscription.')) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = String(subscription.customer || '');
      if (customerId) {
        const status = String(subscription.status || 'inactive').toLowerCase();
        await upsertOrganizationByCustomer(customerId, {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          subscription_status: status,
          subscription_plan: extractPlanNickname(subscription),
          subscription_current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          stripe_last_event_id: event.id,
          stripe_synced_at: new Date().toISOString(),
          read_only_reason: mapStatusToReadOnlyReason(status),
        });
      }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = String(session.customer || '');
      const subscriptionId = String(session.subscription || '');
      if (customerId) {
        await upsertOrganizationByCustomer(customerId, {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId || null,
          subscription_status: 'active',
          subscription_plan: null,
          subscription_current_period_end: null,
          stripe_last_event_id: event.id,
          stripe_synced_at: new Date().toISOString(),
          read_only_reason: null,
        });
      }
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('stripe-webhook:', e);
    return new Response(e instanceof Error ? e.message : 'Webhook failed', { status: 400 });
  }
});
