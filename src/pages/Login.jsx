import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { pagesConfig } from '@/pages.config';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const defaultRedirect = `/${pagesConfig.mainPage || 'Dashboard'}`;
  const redirect = searchParams.get('redirect') ? decodeURIComponent(searchParams.get('redirect')) : defaultRedirect;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupSuccessMessage, setSignupSuccessMessage] = useState('');
  const [authTab, setAuthTab] = useState('login');

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

  const signupErrorMessage = (err) => {
    const code = err?.code;
    const msg = err?.message || '';

    if (code === 'user_already_exists' || /already registered/i.test(msg)) {
      return 'Este e-mail já está cadastrado. Faça login ou use outro endereço.';
    }
    if (code === 'weak_password' || /password/i.test(msg) && /short|weak|least/i.test(msg)) {
      return 'Senha muito fraca. Use mais caracteres ou combine letras e números.';
    }
    if (code === 'email_address_invalid' || code === 'invalid_email') {
      return 'E-mail inválido.';
    }
    if (code === 'captcha_failed' || /captcha/i.test(msg)) {
      return 'CAPTCHA obrigatório no cadastro. Ajuste em Supabase → Authentication → Attack Protection.';
    }

    const extra = code ? ` (${code})` : err?.status ? ` (HTTP ${err.status})` : '';
    return (msg || 'Não foi possível criar a conta') + extra;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSignupSuccessMessage('');
    setLoading(true);

    const emailNorm = email.trim().toLowerCase();

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailNorm,
        password,
      });
      if (signInError) throw signInError;

      if (signInData?.user?.id) navigate(redirect);
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSignupSuccessMessage('');

    if (confirmPassword !== password) {
      setError('As senhas não coincidem.');
      return;
    }

    const orgTrim = organizationName.trim();
    const nameTrim = fullName.trim();
    if (!orgTrim) {
      setError('Informe o nome da sua empresa ou equipe (será o nome do seu espaço de trabalho).');
      return;
    }

    setLoading(true);
    const emailNorm = email.trim().toLowerCase();

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailNorm,
        password,
        options: {
          data: {
            full_name: nameTrim || emailNorm,
            organization_name: orgTrim,
            user_type: 'admin',
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (signUpError) throw signUpError;

      if (data.session?.user?.id) {
        navigate(redirect);
        return;
      }

      setSignupSuccessMessage(
        'Conta criada. Enviamos um link de confirmação para o seu e-mail — após confirmar, você poderá entrar com trial de 7 dias no novo espaço.'
      );
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(signupErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <Tabs
            value={authTab}
            onValueChange={(v) => {
              setAuthTab(v);
              setError('');
              setSignupSuccessMessage('');
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastre-se</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4 space-y-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-slate-900">Login</h1>
                <p className="text-sm text-slate-600">
                  Acesse com seu e-mail e senha
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
                </div>

                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password" />
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
            </TabsContent>

            <TabsContent value="signup" className="mt-4 space-y-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-slate-900">Criar conta</h1>
                <p className="text-sm text-slate-600">
                  Novo espaço de trabalho com trial de 7 dias. Você será administrador do tenant.
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSignup}>
                <div className="space-y-2">
                  <Label>Nome da empresa ou equipe</Label>
                  <Input
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="Ex.: Consultoria Silva"
                    required
                    autoComplete="organization"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Seu nome</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nome completo"
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
                </div>

                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="new-password" minLength={6} />
                </div>

                <div className="space-y-2">
                  <Label>Confirmar senha</Label>
                  <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" required autoComplete="new-password" minLength={6} />
                </div>

                {error && (
                  <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                    {error}
                  </div>
                )}

                {signupSuccessMessage && (
                  <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                    {signupSuccessMessage}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                >
                  {loading ? 'Criando conta...' : 'Criar conta e começar trial'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
