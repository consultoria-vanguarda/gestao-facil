import React, { useMemo } from 'react';

export default function TenantNotFoundError() {
  const slugHint = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const p = new URLSearchParams(window.location.search || '');
    return (
      p.get('tenant') ||
      p.get('slug') ||
      p.get('organization') ||
      p.get('org') ||
      null
    );
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Domínio não encontrado</h1>
        <p className="text-slate-600">
          Não encontramos nenhuma organização vinculada a este domínio/subdomínio.
        </p>
        {slugHint ? (
          <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            Você pediu o tenant <strong>{slugHint}</strong> na URL, mas não existe uma linha em{' '}
            <code className="text-xs bg-white px-1 rounded">public.organizations</code> com esse{' '}
            <code className="text-xs bg-white px-1 rounded">slug</code>. Aplique as migrations no Supabase
            (ex.: <code className="text-xs bg-white px-1 rounded">20260417113000_create_app_saas_tenant.sql</code>)
            ou rode o SQL manual em <code className="text-xs bg-white px-1 rounded">supabase/manual_seed_app_tenant.sql</code>.
          </p>
        ) : null}
        <p className="text-sm text-slate-500">
          Verifique a URL ou entre em contato com o suporte para confirmar a configuração do tenant.
        </p>
      </div>
    </div>
  );
}
