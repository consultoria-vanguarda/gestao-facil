import Stripe from 'https://esm.sh/stripe@16.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ACTIVE_STATUSES = new Set(['trialing', 'active']);

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecret = requiredEnv('STRIPE_SECRET_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Não autenticado.' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const planKey = String(body?.plan_key ?? '').trim();
    const successUrl = String(body?.success_url ?? '').trim();
    const cancelUrl = String(body?.cancel_url ?? '').trim();

    if (!planKey || !successUrl || !cancelUrl) {
      return Response.json({ error: 'Informe plan_key, success_url e cancel_url.' }, { status: 400, headers: corsHeaders });
    }

    const priceId = Deno.env.get(`STRIPE_PRICE_${planKey.toUpperCase()}`)?.trim();
    if (!priceId) {
      return Response.json({ error: `Plano "${planKey}" não configurado no servidor.` }, { status: 400, headers: corsHeaders });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const {
      data: { user: caller },
      error: callerErr,
    } = await anonClient.auth.getUser(token);
    if (callerErr || !caller?.id) {
      return Response.json({ error: 'Sessão inválida.' }, { status: 401, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('organization_id, email')
      .eq('id', caller.id)
      .maybeSingle();
    if (profileErr || !profile?.organization_id) {
      return Response.json({ error: 'Perfil sem organização vinculada.' }, { status: 400, headers: corsHeaders });
    }

    const orgId = profile.organization_id;
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('id, name, stripe_customer_id, stripe_subscription_id, subscription_status, billing_email')
      .eq('id', orgId)
      .maybeSingle();
    if (orgErr || !org) {
      return Response.json({ error: 'Organização não encontrada.' }, { status: 404, headers: corsHeaders });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.billing_email || profile.email || caller.email || undefined,
        name: org.name || undefined,
        metadata: { organization_id: org.id },
      });
      customerId = customer.id;
      await admin
        .from('organizations')
        .update({ stripe_customer_id: customerId, stripe_synced_at: new Date().toISOString() })
        .eq('id', org.id);
    }

    const hasActiveSubscription = ACTIVE_STATUSES.has(String(org.subscription_status || '').toLowerCase());
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { organization_id: org.id, plan_key: planKey },
      },
      metadata: {
        organization_id: org.id,
        plan_key: planKey,
        flow: hasActiveSubscription ? 'upgrade_or_change' : 'new_purchase',
      },
    });

    return Response.json(
      {
        success: true,
        checkout_url: session.url,
        session_id: session.id,
      },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error('billing-create-checkout-session:', e);
    return Response.json(
      { error: e instanceof Error ? e.message : 'Erro inesperado.' },
      { status: 500, headers: corsHeaders }
    );
  }
});
