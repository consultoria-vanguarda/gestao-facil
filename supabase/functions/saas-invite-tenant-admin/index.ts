/**
 * Cria usuário Auth + profile (trigger) como admin do tenant.
 * Apenas profiles com user_type = 'saas_admin' podem chamar.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function slugOk(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return Response.json(
        { error: 'Configuração do servidor incompleta.' },
        { status: 500, headers: corsHeaders }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Não autenticado.' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    const organization_slug = String(body?.organization_slug ?? '').trim().toLowerCase();
    const full_name = String(body?.full_name ?? '').trim() || email;

    if (!email || !password || !organization_slug) {
      return Response.json(
        { error: 'Informe email, senha e organization_slug.' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (password.length < 6) {
      return Response.json(
        { error: 'A senha deve ter pelo menos 6 caracteres.' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!slugOk(organization_slug)) {
      return Response.json(
        { error: 'Slug inválido (apenas minúsculas, números e hífens).' },
        { status: 400, headers: corsHeaders }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await userClient.auth.getUser();

    if (callerErr || !caller?.id) {
      return Response.json({ error: 'Sessão inválida.' }, { status: 401, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('user_type')
      .eq('id', caller.id)
      .maybeSingle();

    if (profileErr) {
      console.error('saas-invite-tenant-admin profile:', profileErr);
      return Response.json({ error: 'Não foi possível validar o perfil.' }, { status: 500, headers: corsHeaders });
    }

    if (profile?.user_type !== 'saas_admin') {
      return Response.json({ error: 'Acesso negado.' }, { status: 403, headers: corsHeaders });
    }

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('id, slug')
      .eq('slug', organization_slug)
      .maybeSingle();

    if (orgErr || !org) {
      return Response.json(
        { error: `Organização "${organization_slug}" não encontrada.` },
        { status: 404, headers: corsHeaders }
      );
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        organization_slug: org.slug,
        full_name,
        user_type: 'admin',
      },
    });

    if (createErr) {
      return Response.json(
        { error: createErr.message || 'Falha ao criar usuário.' },
        { status: 400, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        user_id: created.user?.id ?? null,
        email: created.user?.email ?? email,
      },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error('saas-invite-tenant-admin:', e);
    return Response.json(
      { error: e instanceof Error ? e.message : 'Erro inesperado.' },
      { status: 500, headers: corsHeaders }
    );
  }
});
