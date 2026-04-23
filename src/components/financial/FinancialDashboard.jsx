import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Landmark, AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { usePeriod } from './PeriodContext';

const COLORS = ['#1e3a5f', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  return fmt(v);
};

export default function FinancialDashboard() {
  const { period } = usePeriod();
  const periodStr = `${period.year}-${String(period.month).padStart(2, '0')}`;
  const periodLabel = format(new Date(period.year, period.month - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
  const [forecastDate, setForecastDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: billings = [] } = useQuery({ queryKey: ['billings'], queryFn: () => base44.entities.BillingEntry.list() });
  const { data: payables = [] } = useQuery({ queryKey: ['all_payables'], queryFn: () => base44.entities.ProjectPayable.list() });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => base44.entities.FinancialAccount.list() });
  const { data: taxRates = [] } = useQuery({ queryKey: ['taxRates'], queryFn: () => base44.entities.TaxRate.list() });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });

  const periodTaxRate = taxRates.find(t => t.month === periodStr)?.rate_percent || 0;
  const totalBalance = accounts.reduce((s, a) => s + (a.current_balance || 0), 0);

  const toBill = billings.filter(b => b.status === 'to_bill' && (b.phase_date || b.created_date || '').startsWith(periodStr)).reduce((s, b) => s + (b.amount || 0), 0);
  const billed = billings.filter(b => b.status === 'billed' && (b.billed_date || '').startsWith(periodStr)).reduce((s, b) => s + (b.amount || 0), 0);
  const received = billings.filter(b => b.status === 'received' && (b.received_date || '').startsWith(periodStr)).reduce((s, b) => s + (b.amount || 0), 0);

  const openPayables = payables.filter(p => p.status === 'open' && (p.due_date || '').startsWith(periodStr)).reduce((s, p) => s + (p.amount || 0), 0);
  const paidPayables = payables.filter(p => p.status === 'paid' && (p.paid_at || '').startsWith(periodStr)).reduce((s, p) => s + (p.amount || 0), 0);
  const openExpenses = expenses.filter(e => e.status === 'to_pay' && (e.due_date || '').startsWith(periodStr)).reduce((s, e) => s + (e.amount || 0), 0);
  const totalOpenPayables = openPayables + openExpenses;

  const taxAmount = received * (periodTaxRate / 100);
  const resultado = received - paidPayables - taxAmount;

  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(period.year, period.month - 1, 1), 5 - i);
      const mStr = format(d, 'yyyy-MM');
      const mLabel = format(d, "MMM/yy", { locale: ptBR });
      const rec = billings.filter(b => b.status === 'received' && (b.received_date || '').startsWith(mStr)).reduce((s, b) => s + (b.amount || 0), 0);
      const exp = payables.filter(p => p.status === 'paid' && (p.paid_at || '').startsWith(mStr)).reduce((s, p) => s + (p.amount || 0), 0);
      const taxR = taxRates.find(t => t.month === mStr)?.rate_percent || 0;
      const tax = rec * (taxR / 100);
      return { month: mLabel, receitas: rec, despesas: exp, impostos: tax, resultado: rec - exp - tax };
    });
  }, [billings, payables, taxRates, period]);

  const statusCount = useMemo(() => {
    const map = {};
    projects.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
    const labels = { planning: 'Planejamento', in_progress: 'Em Execução', completed: 'Concluído' };
    return Object.entries(map).map(([k, v]) => ({ name: labels[k] || k, value: v }));
  }, [projects]);

  const ResultIcon = resultado > 0 ? ArrowUpRight : resultado < 0 ? ArrowDownRight : Minus;
  const resultColor = resultado > 0 ? 'text-emerald-600' : resultado < 0 ? 'text-rose-600' : 'text-slate-500';
  const resultBg = resultado > 0 ? 'bg-emerald-50' : resultado < 0 ? 'bg-rose-50' : 'bg-slate-50';

  const cashForecast = useMemo(() => {
    const baseBalance = totalBalance || 0;
    const target = String(forecastDate || '').trim();

    if (!target) {
      return {
        baseBalance,
        receivablesToDate: 0,
        payablesToDate: 0,
        projectedBalance: baseBalance,
      };
    }

    // Considera apenas o que está pendente e com vencimento até a data-alvo.
    const receivablesToDate = billings
      .filter((b) => b.status === 'billed' && b.due_date && b.due_date <= target)
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const projectPayablesToDate = payables
      .filter((p) => p.status === 'open' && p.due_date && p.due_date <= target)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const expensesToDate = expenses
      .filter((e) => e.status === 'to_pay' && e.due_date && e.due_date <= target)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const payablesToDate = projectPayablesToDate + expensesToDate;
    const projectedBalance = baseBalance + receivablesToDate - payablesToDate;

    return {
      baseBalance,
      receivablesToDate,
      payablesToDate,
      projectedBalance,
    };
  }, [billings, payables, expenses, totalBalance, forecastDate]);

  return (
    <div className="space-y-6">

      {/* Linha 1: Card Hero do Resultado + Saldo em Contas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Hero card: Resultado */}
        <Card className="border-0 shadow-md lg:col-span-1 bg-gradient-to-br from-[#1e3a5f] to-[#2d5280] text-white">
          <CardContent className="p-6">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Resultado Líquido</p>
            <p className="text-white/80 text-sm mb-3 capitalize">{periodLabel}</p>
            <p className={`text-3xl font-bold ${resultado >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmt(resultado)}</p>
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <p className="text-white/50">Recebido</p>
                <p className="text-emerald-300 font-semibold">{fmtShort(received)}</p>
              </div>
              <div>
                <p className="text-white/50">Despesas</p>
                <p className="text-rose-300 font-semibold">{fmtShort(paidPayables)}</p>
              </div>
              <div>
                <p className="text-white/50">Impostos</p>
                <p className="text-amber-300 font-semibold">{fmtShort(taxAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo total + contas */}
        <Card className="border-0 shadow-md lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Saldo Total em Contas</p>
                <p className={`text-3xl font-bold mt-1 ${totalBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{fmt(totalBalance)}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl"><Landmark className="w-6 h-6 text-blue-600" /></div>
            </div>
            {accounts.filter(a => a.active).length === 0 ? (
              <p className="text-slate-400 text-sm">Nenhuma conta ativa cadastrada</p>
            ) : (
              <div className="space-y-2">
                {accounts.filter(a => a.active).map(a => (
                  <div key={a.id} className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <div>
                        <p className="font-medium text-sm text-slate-900">{a.name}</p>
                        {a.bank && <p className="text-xs text-slate-400">{a.bank}</p>}
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${(a.current_balance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(a.current_balance)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linha 1.5: Previsão de Fluxo de Caixa por data futura */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base text-slate-900">Previsão de Fluxo de Caixa</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Projeção com base no saldo atual, itens faturados a receber e despesas em aberto até a data.
              </p>
            </div>
            <div className="w-full sm:w-auto">
              <label className="text-xs text-slate-500 font-medium">Data da previsão</label>
              <input
                type="date"
                value={forecastDate}
                onChange={(e) => setForecastDate(e.target.value)}
                className="mt-1 block w-full sm:w-auto border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Saldo atual</p>
              <p className="text-lg font-bold text-slate-900">{fmt(cashForecast.baseBalance)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">A receber até a data</p>
              <p className="text-lg font-bold text-emerald-700">{fmt(cashForecast.receivablesToDate)}</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-3">
              <p className="text-xs text-rose-700">A pagar até a data</p>
              <p className="text-lg font-bold text-rose-700">{fmt(cashForecast.payablesToDate)}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs text-blue-700">Saldo projetado</p>
              <p className={`text-lg font-bold ${cashForecast.projectedBalance >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                {fmt(cashForecast.projectedBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linha 2: Pipeline de receita (to_bill → billed → received) */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Pipeline de Receita — {periodLabel}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">A Faturar</p>
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{fmtShort(toBill)}</p>
              <p className="text-xs text-slate-400 mt-1">Fases concluídas aguardando CR</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm border-l-4 border-l-blue-400">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Faturado (CR)</p>
                <DollarSign className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{fmtShort(billed)}</p>
              <p className="text-xs text-slate-400 mt-1">Nota emitida, aguardando pagamento</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm border-l-4 border-l-emerald-400">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Recebido</p>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-700">{fmtShort(received)}</p>
              <p className="text-xs text-slate-400 mt-1">Efetivamente recebido no mês</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Linha 3: Despesas + Imposto */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Despesas & Impostos — {periodLabel}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-amber-50 rounded-lg"><AlertTriangle className="w-4 h-4 text-amber-500" /></div>
                <p className="text-xs text-slate-500 font-medium">A Pagar</p>
              </div>
              <p className="text-xl font-bold text-amber-700">{fmtShort(totalOpenPayables)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Vencimento no mês</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-slate-100 rounded-lg"><TrendingDown className="w-4 h-4 text-slate-500" /></div>
                <p className="text-xs text-slate-500 font-medium">Despesas Pagas</p>
              </div>
              <p className="text-xl font-bold text-slate-700">{fmtShort(paidPayables)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Pagas no mês</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-purple-50 rounded-lg"><DollarSign className="w-4 h-4 text-purple-500" /></div>
                <p className="text-xs text-slate-500 font-medium">Imposto ({periodTaxRate}%)</p>
              </div>
              <p className="text-xl font-bold text-purple-700">{fmtShort(taxAmount)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Simples sobre recebido</p>
            </CardContent>
          </Card>
          <Card className={`border-0 shadow-sm ${resultBg}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${resultBg}`}><ResultIcon className={`w-4 h-4 ${resultColor}`} /></div>
                <p className="text-xs text-slate-500 font-medium">Resultado Líquido</p>
              </div>
              <p className={`text-xl font-bold ${resultColor}`}>{fmtShort(resultado)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Recebido − despesas − imposto</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Linha 4: Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700">Evolução dos últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} barSize={14} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="impostos" name="Impostos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700">Projetos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusCount} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" nameKey="name" paddingAngle={3}>
                  {statusCount.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {statusCount.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-slate-600">{s.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 5: Linha de resultado */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-700">Resultado Líquido — tendência 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              <Line type="monotone" dataKey="resultado" name="Resultado" stroke="#1e3a5f" strokeWidth={2.5} dot={{ r: 4, fill: '#1e3a5f' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
}