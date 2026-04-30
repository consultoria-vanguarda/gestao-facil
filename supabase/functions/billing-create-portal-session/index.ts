import Stripe from 'https://esm.sh/stripe@16.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const returnUrl = String(body?.return_url ?? '').trim();
    if (!returnUrl) {
      return Response.json({ error: 'Informe return_url.' }, { status: 400, headers: corsHeaders });
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
      .select('organization_id')
      .eq('id', caller.id)
      .maybeSingle();
    if (profileErr || !profile?.organization_id) {
      return Response.json({ error: 'Perfil sem organização vinculada.' }, { status: 400, headers: corsHeaders });
    }

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', profile.organization_id)
      .maybeSingle();
    if (orgErr || !org?.stripe_customer_id) {
      return Response.json({ error: 'Cliente Stripe não encontrado para esta organização.' }, { status: 400, headers: corsHeaders });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: returnUrl,
    });

    return Response.json({ success: true, url: portalSession.url }, { headers: corsHeaders });
  } catch (e) {
    console.error('billing-create-portal-session:', e);
    return Response.json(
      { error: e instanceof Error ? e.message : 'Erro inesperado.' },
      { status: 500, headers: corsHeaders }
    );
  }
});
