import React from 'react';

export default function TenantNotFoundError() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Domínio não encontrado</h1>
        <p className="text-slate-600">
          Não encontramos nenhuma organização vinculada a este domínio/subdomínio.
        </p>
        <p className="text-sm text-slate-500">
          Verifique a URL ou entre em contato com o suporte para confirmar a configuração do tenant.
        </p>
      </div>
    </div>
  );
}
