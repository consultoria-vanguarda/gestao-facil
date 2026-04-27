import React, { useState, useMemo } from 'react';
import { api } from '@/api/appApi';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DRETab() {
  const [mode, setMode] = useState('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [projectId, setProjectId] = useState('');

  const { data: billings = [] } = useQuery({ queryKey: ['billings'], queryFn: () => api.entities.BillingEntry.list() });
  const { data: payables = [] } = useQuery({ queryKey: ['all_payables'], queryFn: () => api.entities.ProjectPayable.list() });
  const { data: taxRates = [] } = useQuery({ queryKey: ['taxRates'], queryFn: () => api.entities.TaxRate.list() });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.entities.Project.list() });

  const dre = useMemo(() => {
    let filteredBillings = billings.filter(b => b.status === 'received');
    let filteredPayables = payables.filter(p => p.status === 'paid');

    if (mode === 'project' && projectId) {
      filteredBillings = filteredBillings.filter(b => b.project_id === projectId);
      filteredPayables = filteredPayables.filter(p => p.project_id === projectId);
    } else if (mode === 'monthly') {
      const mStr = `${year}-${String(month).padStart(2, '0')}`;
      filteredBillings = filteredBillings.filter(b => (b.received_date || '').startsWith(mStr));
      filteredPayables = filteredPayables.filter(p => (p.paid_at || '').startsWith(mStr));
    } else if (mode === 'annual') {
      filteredBillings = filteredBillings.filter(b => (b.received_date || '').startsWith(String(year)));
      filteredPayables = filteredPayables.filter(p => (p.paid_at || '').startsWith(String(year)));
    }

    const grossRevenue = filteredBillings.reduce((s, b) => s + (b.amount || 0), 0);

    let taxRate = 0;
    if (mode === 'monthly') {
      const mStr = `${year}-${String(month).padStart(2, '0')}`;
      taxRate = taxRates.find(t => t.month === mStr)?.rate_percent || 0;
    } else if (mode === 'annual') {
      const yearRates = taxRates.filter(t => t.month.startsWith(String(year)));
      taxRate = yearRates.length > 0 ? yearRates.reduce((s, t) => s + t.rate_percent, 0) / yearRates.length : 0;
    }

    const tax = grossRevenue * (taxRate / 100);
    const netRevenue = grossRevenue - tax;

    const expenseByCategory = {};
    filteredPayables.forEach(p => {
      const cat = p.category || 'other';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (p.amount || 0);
    });

    const totalExpenses = filteredPayables.reduce((s, p) => s + (p.amount || 0), 0);
    const ebitda = netRevenue - totalExpenses;

    return { grossRevenue, tax, taxRate, netRevenue, expenseByCategory, totalExpenses, ebitda };
  }, [billings, payables, taxRates, mode, year, month, projectId]);

  const CATEGORY_LABELS = {
    travel: 'Deslocamento / KM', tools: 'Ferramentas', commission: 'Comissão', tax: 'Impostos',
    supplier: 'Fornecedores', consultant_fee: 'Honorários Consultor', other: 'Outras Despesas'
  };

  const periodLabel = mode === 'monthly'
    ? format(new Date(year, month - 1, 1), "MMMM 'de' yyyy", { locale: ptBR })
    : mode === 'annual' ? `Ano ${year}`
    : projects.find(p => p.id === projectId)?.name || 'Projeto';

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>DRE — Demonstração do Resultado</CardTitle>
            <div className="flex gap-2 ml-auto flex-wrap">
              <select value={mode} onChange={e => setMode(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
                <option value="project">Por Projeto</option>
              </select>
              {(mode === 'monthly' || mode === 'annual') && (
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
              {mode === 'monthly' && (
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{format(new Date(2000, m - 1, 1), 'MMMM', { locale: ptBR })}</option>
                  ))}
                </select>
              )}
              {mode === 'project' && (
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecione o projeto...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-sm font-semibold text-slate-700">Período: <span className="capitalize">{periodLabel}</span></p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição</th>
                <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
                <th className="text-right py-2 pr-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">% Receita</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t-2 border-slate-300">
                <td className="py-2 text-sm font-bold text-slate-900">(+) Receita Bruta</td>
                <td className="py-2 text-right text-sm font-bold text-emerald-700">{fmt(dre.grossRevenue)}</td>
                <td className="py-2 text-right text-xs text-slate-400 pr-2">100%</td>
              </tr>
              <tr>
                <td className="py-2 text-sm pl-8 text-slate-500">(-) Impostos ({dre.taxRate.toFixed(1)}%)</td>
                <td className="py-2 text-right text-sm font-medium text-rose-600">{fmt(-dre.tax)}</td>
                <td className="py-2 text-right text-xs text-slate-400 pr-2">{dre.grossRevenue > 0 ? `${((dre.tax / dre.grossRevenue) * 100).toFixed(1)}%` : '—'}</td>
              </tr>
              <tr className="border-t-2 border-slate-300">
                <td className="py-2 text-sm font-bold text-slate-900">(=) Receita Líquida</td>
                <td className="py-2 text-right text-sm font-bold text-slate-900">{fmt(dre.netRevenue)}</td>
                <td className="py-2 text-right text-xs text-slate-400 pr-2">{dre.grossRevenue > 0 ? `${((dre.netRevenue / dre.grossRevenue) * 100).toFixed(1)}%` : '—'}</td>
              </tr>
              <tr><td colSpan={3} className="py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Despesas</td></tr>
              {Object.entries(dre.expenseByCategory).map(([cat, val]) => (
                <tr key={cat}>
                  <td className="py-2 text-sm pl-8 text-slate-500">(-) {CATEGORY_LABELS[cat] || cat}</td>
                  <td className="py-2 text-right text-sm font-medium text-slate-700">{fmt(-val)}</td>
                  <td className="py-2 text-right text-xs text-slate-400 pr-2">{dre.grossRevenue > 0 ? `${((val / dre.grossRevenue) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
              {dre.totalExpenses > 0 && (
                <tr className="border-t border-slate-200">
                  <td className="py-2 text-sm font-bold text-slate-900">(-) Total de Despesas</td>
                  <td className="py-2 text-right text-sm font-bold text-rose-700">{fmt(-dre.totalExpenses)}</td>
                  <td className="py-2 text-right text-xs text-slate-400 pr-2">{dre.grossRevenue > 0 ? `${((dre.totalExpenses / dre.grossRevenue) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-300">
                <td className="py-2 text-sm font-bold text-slate-900">(=) Resultado Líquido (EBITDA)</td>
                <td className={`py-2 text-right text-sm font-bold ${dre.ebitda >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(dre.ebitda)}</td>
                <td className="py-2 text-right text-xs text-slate-400 pr-2">{dre.grossRevenue > 0 ? `${((dre.ebitda / dre.grossRevenue) * 100).toFixed(1)}%` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}