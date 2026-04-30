import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CreditCard, CircleCheck, CircleAlert } from 'lucide-react';
import { api } from '@/api/appApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const PLANS = [
  { key: 'basic', label: 'Basic' },
  { key: 'pro', label: 'Pro' },
  { key: 'enterprise', label: 'Enterprise' },
];

function statusLabel(status) {
  const map = {
    active: 'Ativa',
    trialing: 'Trial',
    past_due: 'Pagamento pendente',
    unpaid: 'Inadimplente',
    canceled: 'Cancelada',
    inactive: 'Sem assinatura',
    incomplete: 'Incompleta',
    incomplete_expired: 'Expirada',
    paused: 'Pausada',
  };
  return map[String(status || '').toLowerCase()] || status || 'Desconhecido';
}

export default function MySubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'my-subscription'],
    queryFn: () => api.billing.getMySubscription(),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planKey) => {
      const successUrl = `${window.location.origin}/MySubscription?checkout=success`;
      const cancelUrl = `${window.location.origin}/MySubscription?checkout=cancel`;
      return api.billing.createCheckoutSession({ planKey, successUrl, cancelUrl });
    },
    onSuccess: (result) => {
      const url = result?.checkout_url || result?.data?.checkout_url;
      if (!url) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Checkout não retornou URL.' });
        return;
      }
      window.location.assign(url);
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Falha no checkout', description: error?.message || 'Tente novamente.' });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => api.billing.createPortalSession({ returnUrl: currentUrl }),
    onSuccess: (result) => {
      const url = result?.url || result?.data?.url;
      if (!url) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Portal não retornou URL.' });
        return;
      }
      window.location.assign(url);
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Falha ao abrir portal', description: error?.message || 'Tente novamente.' });
    },
  });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search || '');
    const checkout = params.get('checkout');
    if (checkout === 'success') {
      queryClient.invalidateQueries({ queryKey: ['billing', 'my-subscription'] });
      toast({ title: 'Assinatura atualizada', description: 'Seu plano foi processado com sucesso.' });
      params.delete('checkout');
      const next = params.toString();
      window.history.replaceState({}, '', next ? `${window.location.pathname}?${next}` : window.location.pathname);
    }
  }, [queryClient, toast]);

  const isActive = ['active', 'trialing'].includes(String(data?.subscription_status || '').toLowerCase());

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Minha assinatura</h1>
        <p className="text-slate-500 mt-1">Gerencie compra, upgrade e cobrança do seu tenant.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Status atual
          </CardTitle>
          <CardDescription>Assinatura vinculada a toda sua organização.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando assinatura...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge variant={isActive ? 'default' : 'secondary'}>{statusLabel(data?.subscription_status)}</Badge>
                {isActive ? (
                  <span className="text-emerald-700 inline-flex items-center gap-1 text-sm">
                    <CircleCheck className="w-4 h-4" />
                    Escrita liberada
                  </span>
                ) : (
                  <span className="text-amber-700 inline-flex items-center gap-1 text-sm">
                    <CircleAlert className="w-4 h-4" />
                    Tenant em modo somente leitura
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700">Plano: <strong>{data?.subscription_plan || 'Não contratado'}</strong></p>
              <p className="text-sm text-slate-700">
                Próxima renovação:{' '}
                <strong>
                  {data?.subscription_current_period_end
                    ? new Date(data.subscription_current_period_end).toLocaleDateString('pt-BR')
                    : '—'}
                </strong>
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planos</CardTitle>
          <CardDescription>Escolha um plano para comprar ou fazer upgrade/downgrade.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <Button
              key={plan.key}
              variant="outline"
              className="justify-center"
              disabled={checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate(plan.key)}
            >
              {checkoutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {data?.subscription_status ? `Trocar para ${plan.label}` : `Assinar ${plan.label}`}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
          {portalMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Gerenciar no Stripe
        </Button>
      </div>
    </div>
  );
}
