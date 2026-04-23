import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { getTenantContext, storeTenantSlugForSession } from '@/lib/tenant';

const ORG_MISMATCH_MESSAGE =
  'Este usuário não pertence a esta organização. Use o slug da sua organização na URL ou outra conta.';

/**
 * Se o redirect não pede tenant, acrescenta ?slug= da organização do utilizador.
 * Se já pede outro slug (diferente do utilizador), devolve null (erro explícito).
 */
function mergeUserSlugIntoRedirect(redirectPath, userOrgSlug) {
  if (!userOrgSlug) return redirectPath || '/';
  const raw = redirectPath && String(redirectPath).trim() !== '' ? redirectPath : '/';
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  const qIdx = normalized.indexOf('?');
  const pathname = qIdx >= 0 ? normalized.slice(0, qIdx) : normalized;
  const search = qIdx >= 0 ? normalized.slice(qIdx + 1) : '';
  const params = new URLSearchParams(search);
  const existing =
    params.get('slug') ||
    params.get('tenant') ||
    params.get('organization') ||
    params.get('org');
  const want = String(userOrgSlug).trim().toLowerCase();
  if (existing && String(existing).trim().toLowerCase() !== want) {
    return null;
  }
  if (!existing) {
    params.set('slug', want);
  }
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = getTenantContext(location);

  const redirect = searchParams.get('redirect') ? decodeURIComponent(searchParams.get('redirect')) : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loginErrorMessage = (err) => {
    const code = err?.code;
    const msg = err?.message || '';

    if (code === 'email_not_confirmed') {
      return 'Confirme o e-mail antes de entrar (veja a caixa de entrada) ou desative a confirmação em Authentication → Providers → Email no Supabase.';
    }
    if (code === 'invalid_credentials' || code === 'invalid_grant' || /invalid login credential/i.test(msg)) {
      return 'E-mail ou senha incorretos, ou este login não está habilitado para o provedor Email.';
    }
    if (code === 'captcha_failed' || /captcha/i.test(msg)) {
      return 'O projeto exige CAPTCHA no login. Em Supabase: Authentication → Attack Protection — desative para testes ou integre o token (captchaToken) no signInWithPassword.';
    }
    if (code === 'user_banned') {
      return 'Esta conta foi desativada.';
    }

    const extra = code ? ` (${code})` : err?.status ? ` (HTTP ${err.status})` : '';
    return (msg || 'Falha ao fazer login') + extra;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const emailNorm = email.trim().toLowerCase();

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailNorm,
        password,
      });
      if (signInError) throw signInError;

      const userId = signInData?.user?.id;

      if (userId) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('organization_id, user_type, organization:organizations(slug)')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) throw profileError;

        const ut = String(profile?.user_type ?? '')
          .trim()
          .toLowerCase();
        if (ut === 'saas_admin') {
          navigate(redirect);
          return;
        }

        let userOrgSlug =
          profile?.organization?.slug != null
            ? String(profile.organization.slug).trim().toLowerCase()
            : '';

        if (!userOrgSlug && profile?.organization_id) {
          const { data: orgRow } = await supabase
            .from('organizations')
            .select('slug')
            .eq('id', profile.organization_id)
            .maybeSingle();
          userOrgSlug = orgRow?.slug ? String(orgRow.slug).trim().toLowerCase() : '';
        }

        const merged = mergeUserSlugIntoRedirect(redirect, userOrgSlug);
        if (merged === null) {
          await supabase.auth.signOut();
          setError(ORG_MISMATCH_MESSAGE);
          return;
        }
        if (userOrgSlug) {
          storeTenantSlugForSession(userOrgSlug);
        }
        navigate(merged);
        return;
      }

      navigate(redirect);
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900">Login</h1>
            <p className="text-sm text-slate-600">
              {tenantSlug
                ? `Acesse a organização ${tenantSlug} com seu e-mail e senha`
                : 'Acesse com seu e-mail e senha'}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>

            <div className="space-y-2">
              <Label>Senha</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </div>

            {error && (
              <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

