import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { getTenantContext } from '@/lib/tenant';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { tenantSlug } = getTenantContext();

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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailNorm,
        password,
      });
      if (signInError) throw signInError;

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

