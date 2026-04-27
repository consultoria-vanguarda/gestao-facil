import React, { useState, useEffect } from 'react';
import { usePeriod } from './PeriodContext';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import { DollarSign, FileCheck, CheckCircle2, Clock, Layers, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { lancaImpostoDespesa, lancaImpostoDespesaLote } from '@/components/utils/simplesNacionalHelper';

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_CONFIG = {
  to_bill: { label: 'A Faturar', color: 'bg-amber-100 text-amber-800' },
  billed: { label: 'Faturado (CR)', color: 'bg-blue-100 text-blue-800' },
  received: { label: 'Recebido', color: 'bg-emerald-100 text-emerald-800' },
};

export default function BillingTab() {
  const queryClient = useQueryClient();
  const { period } = usePeriod();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [billingModal, setBillingModal] = useState(null);
  const [billingForm, setBillingForm] = useState({ due_date: '', payment_method: 'pix', account_id: '', discount: '', extra_revenue: '', received_date: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchModal, setBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({ due_date: '', payment_method: 'pix', account_id: '', discount: '', extra_revenue: '', received_date: '' });
  const [batchMonthFilter, setBatchMonthFilter] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('current_month');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [editAmountModal, setEditAmountModal] = useState(null);
  const [editAmountValue, setEditAmountValue] = useState('');
  const [collapsedMonths, setCollapsedMonths] = useState({});

  // Sync filter to global period when in "current_month" mode
  const globalPeriodStr = `${period.year}-${String(period.month).padStart(2, '0')}`;
  useEffect(() => {
    if (filterPeriod === 'current_month') {
      // re-render is enough — filter uses globalPeriodStr
    }
  }, [period]);

  const toggleMonth = (monthKey) => {
    setCollapsedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const { data: billings = [] } = useQuery({ queryKey: ['billings'], queryFn: () => api.entities.BillingEntry.list('-created_date') });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.entities.Project.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => api.entities.FinancialAccount.list() });
  const { data: taxRates = [] } = useQuery({ queryKey: ['taxRates'], queryFn: () => api.entities.TaxRate.list() });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.BillingEntry.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billings'] });
      setBillingModal(null);
    }
  });

  const handleBill = async () => {
    if (!billingForm.due_date) return alert('Informe a data de vencimento');
    const billedDate = format(new Date(), 'yyyy-MM-dd');
    await api.entities.BillingEntry.update(billingModal.entry.id, {
      status: 'billed',
      billed_date: billedDate,
      due_date: billingForm.due_date,
      payment_method: billingForm.payment_method,
    });
    queryClient.invalidateQueries({ queryKey: ['billings'] });
    setBillingModal(null);
  };

  const handleReceive = async () => {
    if (!billingForm.account_id) return alert('Selecione a conta de destino');
    const entry = billingModal.entry;
    const account = accounts.find(a => a.id === billingForm.account_id);
    const discount = parseFloat(billingForm.discount) || 0;
    const extraRevenue = parseFloat(billingForm.extra_revenue) || 0;
    const today = billingForm.received_date || format(new Date(), 'yyyy-MM-dd');

    // Net amount credited to account = original - discount + extra
    const netAmount = Math.round((entry.amount - discount + extraRevenue) * 100) / 100;

    await api.entities.BillingEntry.update(entry.id, {
      status: 'received',
      received_date: today,
      account_id: billingForm.account_id,
    });

    // Update account balance with net amount
    const newBalance = Math.round(((account.current_balance || 0) + netAmount) * 100) / 100;
    await api.entities.FinancialAccount.update(billingForm.account_id, { current_balance: newBalance });

    // Main transaction: net amount credited
    await api.entities.AccountTransaction.create({
      account_id: billingForm.account_id,
      type: 'credit',
      amount: netAmount,
      description: entry.description || 'Recebimento de projeto',
      date: today,
      reference_type: 'receivable',
      reference_id: entry.id,
      project_id: entry.project_id,
    });

    // If discount: lança como despesa na conta 2.6
    if (discount > 0) {
      await api.entities.Expense.create({
        project_id: entry.project_id || '',
        chart_account_id: '69a46624d77081d6bf429fbb', // 2.6 Desconto
        category: 'other',
        description: `Desconto concedido — ${entry.description || 'Receita de projeto'}`,
        amount: discount,
        due_date: today,
        payment_date: today,
        status: 'paid',
      });
    }

    // If extra revenue: lança na conta 1.5 como BillingEntry extra
    if (extraRevenue > 0) {
      await api.entities.BillingEntry.create({
        project_id: entry.project_id || '',
        amount: extraRevenue,
        status: 'received',
        billed_date: today,
        received_date: today,
        account_id: billingForm.account_id,
        description: `Receita Extra (ajuste de caixa) — ${entry.description || 'Receita de projeto'}`,
        phase_date: today,
      });
    }

    // Lança despesa de imposto (A Pagar, vence no último dia do mês)
    await lancaImpostoDespesa({ ...entry, amount: entry.amount }, today, taxRates);

    queryClient.invalidateQueries({ queryKey: ['billings'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    setBillingModal(null);
  };

  const handleEditAmount = async () => {
    const newAmount = parseFloat(editAmountValue);
    if (!newAmount || newAmount <= 0) return alert('Informe um valor válido');
    await api.entities.BillingEntry.update(editAmountModal.entry.id, { amount: newAmount });
    queryClient.invalidateQueries({ queryKey: ['billings'] });
    setEditAmountModal(null);
  };

  const handleBatchBill = async () => {
    if (!batchForm.due_date) return alert('Informe a data de vencimento');
    setBatchLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    for (const id of selectedIds) {
      await api.entities.BillingEntry.update(id, {
        status: 'billed',
        billed_date: today,
        due_date: batchForm.due_date,
        payment_method: batchForm.payment_method,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['billings'] });
    setBatchLoading(false);
    setBatchModal(false);
    setSelectedIds([]);
  };

  const handleBatchRevertToBill = async () => {
    setBatchLoading(true);
    const ids = selectedIds.filter(id => billings.find(b => b.id === id)?.status === 'billed');
    for (const id of ids) {
      await api.entities.BillingEntry.update(id, {
        status: 'to_bill',
        billed_date: null,
        due_date: null,
        payment_method: null,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['billings'] });
    setBatchLoading(false);
    setBatchModal(false);
    setSelectedIds([]);
  };

  const handleBatchRevertToReceive = async () => {
    setBatchLoading(true);
    const ids = selectedIds.filter(id => billings.find(b => b.id === id)?.status === 'received');

    // Agrupa por conta para recalcular cada saldo uma única vez
    const accountsToRecalc = new Set();
    for (const id of ids) {
      const entry = billings.find(b => b.id === id);
      if (entry?.account_id) accountsToRecalc.add(entry.account_id);

      await api.entities.BillingEntry.update(id, {
        status: 'billed',
        received_date: null,
        account_id: null,
      });
    }

    // Recalcula o saldo de cada conta afetada com base nas transações restantes (status atual)
    for (const accountId of accountsToRecalc) {
      const account = accounts.find(a => a.id === accountId);
      if (!account) continue;
      const allTx = await api.entities.AccountTransaction.filter({ account_id: accountId });
      const calcBalance = allTx.reduce((sum, tx) => {
        return sum + (tx.type === 'credit' ? (tx.amount || 0) : -(tx.amount || 0));
      }, account.initial_balance || 0);
      await api.entities.FinancialAccount.update(accountId, { current_balance: Math.round(calcBalance * 100) / 100 });
    }

    queryClient.invalidateQueries({ queryKey: ['billings'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    setBatchLoading(false);
    setBatchModal(false);
    setSelectedIds([]);
  };

  const handleBatchChangeDueDate = async () => {
    if (!batchForm.due_date) return alert('Informe a nova data de vencimento');
    setBatchLoading(true);
    const ids = selectedIds.filter(id => billings.find(b => b.id === id)?.status === 'billed');
    for (const id of ids) {
      await api.entities.BillingEntry.update(id, { due_date: batchForm.due_date });
    }
    queryClient.invalidateQueries({ queryKey: ['billings'] });
    setBatchLoading(false);
    setBatchModal(false);
    setSelectedIds([]);
  };

  const handleBatchReceive = async () => {
    if (!batchForm.account_id) return alert('Selecione a conta de destino');
    setBatchLoading(true);
    const account = accounts.find(a => a.id === batchForm.account_id);
    const selectedEntries = billings.filter(b => selectedIds.includes(b.id) && b.status === 'billed');
    const discount = parseFloat(batchForm.discount) || 0;
    const extraRevenue = parseFloat(batchForm.extra_revenue) || 0;
    const batchToday = batchForm.received_date || format(new Date(), 'yyyy-MM-dd');
    const originalTotal = selectedEntries.reduce((s, b) => s + (b.amount || 0), 0);
    const netTotal = Math.round((originalTotal - discount + extraRevenue) * 100) / 100;

    for (const entry of selectedEntries) {
      await api.entities.BillingEntry.update(entry.id, {
        status: 'received',
        received_date: batchToday,
        account_id: batchForm.account_id,
      });
      await api.entities.AccountTransaction.create({
        account_id: batchForm.account_id,
        type: 'credit',
        amount: entry.amount,
        description: entry.description || 'Recebimento de projeto',
        date: batchToday,
        reference_type: 'receivable',
        reference_id: entry.id,
        project_id: entry.project_id,
      });
    }

    // Update account balance with net total (original - discount + extra)
    const newBalance = Math.round(((account.current_balance || 0) + netTotal) * 100) / 100;
    await api.entities.FinancialAccount.update(batchForm.account_id, { current_balance: newBalance });

    // If discount: lança como despesa na conta 2.6 (uma única vez pelo total)
    if (discount > 0) {
      await api.entities.Expense.create({
        project_id: selectedEntries[0]?.project_id || '',
        chart_account_id: '69a46624d77081d6bf429fbb', // 2.6 Desconto
        category: 'other',
        description: `Desconto concedido em lote — ${selectedEntries.length} receita(s)`,
        amount: discount,
        due_date: batchToday,
        payment_date: batchToday,
        status: 'paid',
      });
    }

    // If extra revenue: lança na conta 1.5 como BillingEntry extra
    if (extraRevenue > 0) {
      await api.entities.BillingEntry.create({
        project_id: selectedEntries[0]?.project_id || '',
        amount: extraRevenue,
        status: 'received',
        billed_date: batchToday,
        received_date: batchToday,
        account_id: batchForm.account_id,
        description: `Receita Extra (ajuste de caixa) — lote de ${selectedEntries.length} receita(s)`,
        phase_date: batchToday,
      });
    }

    // Lança despesa de imposto em lote (A Pagar, vence no último dia do mês)
    await lancaImpostoDespesaLote(originalTotal, batchToday, taxRates, selectedEntries[0]?.project_id);

    queryClient.invalidateQueries({ queryKey: ['billings'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    setBatchLoading(false);
    setBatchModal(false);
    setSelectedIds([]);
  };

  // Filter data
  let filtered = billings;
  if (filterStatus !== 'all') filtered = filtered.filter(b => b.status === filterStatus);
  if (filterProject !== 'all') filtered = filtered.filter(b => b.project_id === filterProject);
  filtered = filtered.filter(b => {
    const dateRef = b.billed_date || b.phase_date || b.due_date || '';
    if (filterPeriod === 'current_month') return dateRef.startsWith(globalPeriodStr);
    if (filterPeriod === 'custom') {
      let ok = true;
      if (periodStart) ok = ok && dateRef >= periodStart;
      if (periodEnd) ok = ok && dateRef <= periodEnd;
      return ok;
    }
    return true; // all_time
  });

  // Selectable = to_bill OR billed OR received
  const selectableToBillIds = filtered.filter(b => b.status === 'to_bill').map(b => b.id);
  const selectableBilledIds = filtered.filter(b => b.status === 'billed').map(b => b.id);
  const selectableReceivedIds = filtered.filter(b => b.status === 'received').map(b => b.id);
  const selectableIds = filtered.map(b => b.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !selectableIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...selectableIds])]);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toBillTotal = billings.filter(b => b.status === 'to_bill').reduce((s, b) => s + (b.amount || 0), 0);
  const billedTotal = billings.filter(b => b.status === 'billed').reduce((s, b) => s + (b.amount || 0), 0);
  const receivedTotal = billings.filter(b => b.status === 'received').reduce((s, b) => s + (b.amount || 0), 0);
  const selectedTotal = billings.filter(b => selectedIds.includes(b.id)).reduce((s, b) => s + (b.amount || 0), 0);
  const filteredTotal = filtered.reduce((s, b) => s + (b.amount || 0), 0);

  // Projects that have billings
  const projectsWithBillings = projects.filter(p => billings.some(b => b.project_id === p.id));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><Clock className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-xs text-slate-500">A Faturar</p><p className="font-bold text-slate-900">{fmt(toBillTotal)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50"><FileCheck className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-slate-500">Faturado / A Receber</p><p className="font-bold text-slate-900">{fmt(billedTotal)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-xs text-slate-500">Recebido</p><p className="font-bold text-slate-900">{fmt(receivedTotal)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Receitas de Projetos</CardTitle>
              {(filterStatus !== 'all' || filterProject !== 'all') && (
                <p className="text-sm text-slate-500 mt-1">
                  Total filtrado: <span className="font-semibold text-slate-800">{fmt(filteredTotal)}</span>
                  <span className="ml-2 text-xs text-slate-400">({filtered.length} registro(s))</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Batch action bar */}
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-sm flex-wrap">
                  <span>{selectedIds.length} selecionado(s) — {fmt(selectedTotal)}</span>
                  {selectedIds.some(id => billings.find(b => b.id === id)?.status === 'to_bill') && (
                    <Button size="sm" className="bg-white text-[#1e3a5f] hover:bg-slate-100 h-7 text-xs px-2"
                      onClick={() => { setBatchModal('bill'); setBatchForm({ due_date: '', payment_method: 'pix', account_id: '' }); }}>
                      <Layers className="w-3 h-3 mr-1" /> Faturar em Lote
                    </Button>
                  )}
                  {selectedIds.some(id => billings.find(b => b.id === id)?.status === 'billed') && (<>
                    <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-7 text-xs px-2"
                      onClick={() => { setBatchModal('receive'); setBatchForm({ due_date: '', payment_method: 'pix', account_id: '', discount: '', extra_revenue: '', received_date: '' }); }}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Efetivar em Lote
                    </Button>
                    <Button size="sm" className="bg-slate-500 hover:bg-slate-600 text-white h-7 text-xs px-2"
                      onClick={() => { setBatchModal('change_due_date'); setBatchForm({ due_date: '', payment_method: 'pix', account_id: '' }); }}>
                      📅 Alterar Vencimento
                    </Button>
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white h-7 text-xs px-2"
                      onClick={() => setBatchModal('revert_to_bill')}>
                      ↩ Voltar p/ A Faturar
                    </Button>
                  </>)}
                  {selectedIds.some(id => billings.find(b => b.id === id)?.status === 'received') && (
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white h-7 text-xs px-2"
                      onClick={() => setBatchModal('revert_to_billed')}>
                      ↩ Voltar p/ Faturado
                    </Button>
                  )}
                  <button onClick={() => setSelectedIds([])} className="text-white/70 hover:text-white text-xs">✕ Limpar</button>
                </div>
              )}
              {/* Filter by period */}
              <select value={filterPeriod} onChange={e => { setFilterPeriod(e.target.value); setSelectedIds([]); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="current_month">Mês corrente</option>
                <option value="all_time">Todos os períodos</option>
                <option value="custom">Selecionar período</option>
              </select>
              {filterPeriod === 'custom' && (
                <div className="flex items-center gap-1">
                  <input type="date" value={periodStart} onChange={e => { setPeriodStart(e.target.value); setSelectedIds([]); }}
                    className="border border-slate-200 rounded-lg px-2 py-2 text-sm" />
                  <span className="text-slate-400 text-xs">até</span>
                  <input type="date" value={periodEnd} onChange={e => { setPeriodEnd(e.target.value); setSelectedIds([]); }}
                    className="border border-slate-200 rounded-lg px-2 py-2 text-sm" />
                </div>
              )}
              {/* Filter by project */}
              <select value={filterProject} onChange={e => { setFilterProject(e.target.value); setSelectedIds([]); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="all">Todos os Projetos</option>
                {projectsWithBillings.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {/* Filter by status */}
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setSelectedIds([]); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="all">Todos os Status</option>
                <option value="to_bill">A Faturar</option>
                <option value="billed">Faturado</option>
                <option value="received">Recebido</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhuma receita encontrada</p>
              <p className="text-sm mt-1">As receitas são geradas automaticamente ao concluir fases dos projetos</p>
            </div>
          ) : (() => {
            // Group filtered entries by month (using billed_date, phase_date, or due_date)
            const monthGroups = {};
            for (const entry of filtered) {
              const dateRef = entry.billed_date || entry.phase_date || entry.due_date || entry.created_date || '';
              const monthKey = dateRef ? dateRef.substring(0, 7) : 'sem-data';
              if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
              monthGroups[monthKey].push(entry);
            }
            const sortedMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

            const monthLabel = (key) => {
              if (key === 'sem-data') return 'Sem data';
              const [y, m] = key.split('-');
              const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
              return `${months[parseInt(m) - 1]} / ${y}`;
            };

            return (
              <>
                {selectableIds.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 accent-[#1e3a5f]" />
                    <span className="text-sm text-slate-700 font-medium">
                      {allSelected ? 'Desmarcar todos' : `Selecionar todos (${selectableIds.length} item(ns))`}
                    </span>
                  </div>
                )}
                <div className="space-y-4">
                  {sortedMonths.map(monthKey => {
                    const entries = monthGroups[monthKey];
                    const monthTotal = entries.reduce((s, e) => s + (e.amount || 0), 0);
                    const isMonthCollapsed = collapsedMonths[monthKey];
                    const monthSelectableIds = entries.filter(e => e.status === 'to_bill' || e.status === 'billed').map(e => e.id);
                    const monthAllSelected = monthSelectableIds.length > 0 && monthSelectableIds.every(id => selectedIds.includes(id));

                    const toggleMonthSelect = () => {
                      if (monthAllSelected) {
                        setSelectedIds(prev => prev.filter(id => !monthSelectableIds.includes(id)));
                      } else {
                        setSelectedIds(prev => [...new Set([...prev, ...monthSelectableIds])]);
                      }
                    };

                    // Group entries by client within this month
                    const clientGroups = {};
                    for (const entry of entries) {
                      const proj = projects.find(p => p.id === entry.project_id);
                      const clientId = proj?.client_id || 'sem-cliente';
                      if (!clientGroups[clientId]) clientGroups[clientId] = [];
                      clientGroups[clientId].push(entry);
                    }

                    return (
                      <div key={monthKey} className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* Month header */}
                        <div
                          className="flex items-center justify-between px-4 py-3 bg-[#1e3a5f] cursor-pointer hover:bg-[#2d4a6f] transition-colors"
                          onClick={() => toggleMonth(monthKey)}
                        >
                          <div className="flex items-center gap-3">
                            {isMonthCollapsed ? <ChevronRight className="w-4 h-4 text-white/70" /> : <ChevronDown className="w-4 h-4 text-white/70" />}
                            <span className="font-bold text-white">{monthLabel(monthKey)}</span>
                            <span className="text-xs text-white/60">{entries.length} lançamento(s)</span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Quick month actions */}
                            {(() => {
                              const monthToBillIds = entries.filter(e => e.status === 'to_bill').map(e => e.id);
                              const monthBilledIds = entries.filter(e => e.status === 'billed').map(e => e.id);
                              return (<>
                                {monthToBillIds.length > 0 && (
                                  <button
                                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-medium px-2 py-1 rounded transition-colors"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setSelectedIds(monthToBillIds);
                                      setBatchModal('bill');
                                      setBatchForm({ due_date: '', payment_method: 'pix', account_id: '' });
                                    }}
                                  >
                                    <Layers className="w-3 h-3 inline mr-1" />Faturar Mês ({monthToBillIds.length})
                                  </button>
                                )}
                                {monthBilledIds.length > 0 && (
                                  <button
                                    className="text-xs bg-emerald-500/80 hover:bg-emerald-500 text-white font-medium px-2 py-1 rounded transition-colors"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setSelectedIds(monthBilledIds);
                                      setBatchModal('receive');
                                      setBatchForm({ due_date: '', payment_method: 'pix', account_id: '', discount: '', extra_revenue: '', received_date: '' });
                                    }}
                                  >
                                    <CheckCircle2 className="w-3 h-3 inline mr-1" />Dar Baixa no Mês ({monthBilledIds.length})
                                  </button>
                                )}
                              </>);
                            })()}
                            {monthSelectableIds.length > 0 && (
                              <button
                                className="text-xs text-white/70 hover:text-white hover:underline"
                                onClick={e => { e.stopPropagation(); toggleMonthSelect(); }}
                              >
                                {monthAllSelected ? 'Desmarcar' : 'Selecionar'}
                              </button>
                            )}
                            <span className="font-bold text-white">{fmt(monthTotal)}</span>
                          </div>
                        </div>

                        {/* Client sub-groups */}
                        {!isMonthCollapsed && (
                          <div className="divide-y divide-slate-100">
                            {Object.entries(clientGroups).map(([clientId, clientEntries]) => {
                              const clientName = (() => {
                                const proj = projects.find(p => clientEntries.some(e => e.project_id === p.id));
                                // We need clients data — get from projects
                                return proj?.name?.split(' - ')[0] || 'Cliente não identificado';
                              })();
                              const clientKey = `${monthKey}-${clientId}`;
                              const isClientCollapsed = collapsedMonths[clientKey];
                              const clientTotal = clientEntries.reduce((s, e) => s + (e.amount || 0), 0);
                              const clientSelectableIds = clientEntries.filter(e => e.status === 'to_bill' || e.status === 'billed').map(e => e.id);
                              const clientAllSelected = clientSelectableIds.length > 0 && clientSelectableIds.every(id => selectedIds.includes(id));

                              const toggleClientSelect = (ev) => {
                                ev.stopPropagation();
                                if (clientAllSelected) {
                                  setSelectedIds(prev => prev.filter(id => !clientSelectableIds.includes(id)));
                                } else {
                                  setSelectedIds(prev => [...new Set([...prev, ...clientSelectableIds])]);
                                }
                              };

                              return (
                                <div key={clientKey}>
                                  {/* Client header */}
                                  <div
                                    className="flex items-center justify-between px-4 py-2.5 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-200"
                                    onClick={() => toggleMonth(clientKey)}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isClientCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                                      <span className="font-semibold text-slate-700 text-sm">{clientName}</span>
                                      <span className="text-xs text-slate-400">{clientEntries.length} lançamento(s)</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {clientEntries.filter(e => e.status === 'to_bill').length > 0 && (
                                        <button
                                          className="text-xs bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white font-medium px-2 py-1 rounded transition-colors"
                                          onClick={e => {
                                            e.stopPropagation();
                                            const ids = clientEntries.filter(e => e.status === 'to_bill').map(e => e.id);
                                            setSelectedIds(ids);
                                            setBatchModal('bill');
                                            setBatchForm({ due_date: '', payment_method: 'pix', account_id: '' });
                                          }}
                                        >
                                          <Layers className="w-3 h-3 inline mr-1" />Faturar ({clientEntries.filter(e => e.status === 'to_bill').length})
                                        </button>
                                      )}
                                      {clientEntries.filter(e => e.status === 'billed').length > 0 && (
                                        <button
                                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2 py-1 rounded transition-colors"
                                          onClick={e => {
                                            e.stopPropagation();
                                            const ids = clientEntries.filter(e => e.status === 'billed').map(e => e.id);
                                            setSelectedIds(ids);
                                            setBatchModal('receive');
                                            setBatchForm({ due_date: '', payment_method: 'pix', account_id: '', discount: '', extra_revenue: '', received_date: '' });
                                          }}
                                        >
                                          <CheckCircle2 className="w-3 h-3 inline mr-1" />Dar Baixa ({clientEntries.filter(e => e.status === 'billed').length})
                                        </button>
                                      )}
                                      {clientSelectableIds.length > 0 && (
                                        <button className="text-xs text-slate-500 hover:text-slate-700 hover:underline" onClick={toggleClientSelect}>
                                          {clientAllSelected ? 'Desmarcar' : 'Selecionar'}
                                        </button>
                                      )}
                                      <span className="font-semibold text-slate-700 text-sm">{fmt(clientTotal)}</span>
                                    </div>
                                  </div>

                                  {/* Entries */}
                                  {!isClientCollapsed && (
                                    <div className="divide-y divide-slate-100">
                                      {clientEntries.map(entry => {
                                        const project = projects.find(p => p.id === entry.project_id);
                                        const isSelectable = entry.status === 'to_bill' || entry.status === 'billed';
                                        const isSelected = selectedIds.includes(entry.id);
                                        return (
                                          <div key={entry.id} className={`flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                              {isSelectable ? (
                                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(entry.id)} className="w-4 h-4 accent-[#1e3a5f] shrink-0" />
                                              ) : (
                                                <div className="w-4 h-4 shrink-0" />
                                              )}
                                              <div className="min-w-0">
                                                <p className="font-medium text-slate-900 truncate text-sm">{entry.description || project?.name || 'Projeto'}</p>
                                                <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-0.5">
                                                  <span>{project?.name}</span>
                                                  {entry.phase_date && <span>Fase: {format(parseISO(entry.phase_date), 'dd/MM/yyyy')}</span>}
                                                  {entry.hours > 0 && <span>{entry.hours}h</span>}
                                                  {entry.due_date && <span>Vence: {format(parseISO(entry.due_date), 'dd/MM/yyyy')}</span>}
                                                  {entry.received_date && <span className="text-emerald-600">Recebido: {format(parseISO(entry.received_date), 'dd/MM/yyyy')}</span>}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-3 ml-4 shrink-0">
                                              <div className="flex items-center gap-1">
                                                <span className="font-bold text-slate-900 whitespace-nowrap text-sm">{fmt(entry.amount)}</span>
                                                {entry.status !== 'received' && (
                                                  <button title="Editar valor"
                                                    onClick={() => { setEditAmountModal({ entry }); setEditAmountValue(String(entry.amount)); }}
                                                    className="p-1 text-slate-400 hover:text-[#1e3a5f] transition-colors">
                                                    <Pencil className="w-3 h-3" />
                                                  </button>
                                                )}
                                              </div>
                                              <Badge className={STATUS_CONFIG[entry.status]?.color + ' border-0 whitespace-nowrap text-xs'}>
                                                {STATUS_CONFIG[entry.status]?.label}
                                              </Badge>
                                              {entry.status === 'to_bill' && (
                                                <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-xs whitespace-nowrap"
                                                  onClick={() => { setBillingModal({ entry, action: 'bill' }); setBillingForm({ due_date: '', payment_method: 'pix', account_id: '' }); }}>
                                                  Faturar
                                                </Button>
                                              )}
                                              {entry.status === 'billed' && (
                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs whitespace-nowrap"
                                                  onClick={() => { setBillingModal({ entry, action: 'receive' }); setBillingForm({ due_date: '', payment_method: 'pix', account_id: '', discount: '', extra_revenue: '', received_date: '' }); }}>
                                                  Efetivar
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Individual billing/receive modal */}
      {billingModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {billingModal.action === 'bill' ? 'Faturar Receita' : 'Efetivar Recebimento'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">{fmt(billingModal.entry.amount)}</p>

            {billingModal.action === 'bill' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Data de Vencimento *</label>
                  <input type="date" value={billingForm.due_date} onChange={e => setBillingForm(p => ({ ...p, due_date: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Forma de Pagamento</label>
                  <select value={billingForm.payment_method} onChange={e => setBillingForm(p => ({ ...p, payment_method: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="pix">PIX</option>
                    <option value="transfer">Transferência</option>
                    <option value="boleto">Boleto</option>
                    <option value="check">Cheque</option>
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
              </div>
            )}

            {billingModal.action === 'receive' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Data de Efetivação *</label>
                  <input type="date" value={billingForm.received_date} onChange={e => setBillingForm(p => ({ ...p, received_date: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Conta de Destino *</label>
                  <select value={billingForm.account_id} onChange={e => setBillingForm(p => ({ ...p, account_id: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Selecione a conta...</option>
                    {accounts.filter(a => a.active).map(a => (
                      <option key={a.id} value={a.id}>{a.name} — {fmt(a.current_balance)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Desconto (R$)</label>
                    <input type="number" min="0" step="0.01" placeholder="0,00"
                      value={billingForm.discount} onChange={e => setBillingForm(p => ({ ...p, discount: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    <p className="text-xs text-slate-400 mt-1">Lança em 2.6 - Desconto</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Receita Extra (R$)</label>
                    <input type="number" min="0" step="0.01" placeholder="0,00"
                      value={billingForm.extra_revenue} onChange={e => setBillingForm(p => ({ ...p, extra_revenue: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    <p className="text-xs text-slate-400 mt-1">Lança em 1.5 - Receita Extra</p>
                  </div>
                </div>
                {(parseFloat(billingForm.discount) > 0 || parseFloat(billingForm.extra_revenue) > 0) && (
                  <div className="p-3 bg-slate-50 rounded-lg text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Valor original:</span><span>{fmt(billingModal.entry.amount)}</span>
                    </div>
                    {parseFloat(billingForm.discount) > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>(-) Desconto:</span><span>- {fmt(parseFloat(billingForm.discount))}</span>
                      </div>
                    )}
                    {parseFloat(billingForm.extra_revenue) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>(+) Receita Extra:</span><span>+ {fmt(parseFloat(billingForm.extra_revenue))}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 mt-1 pt-1">
                      <span>Valor a receber:</span>
                      <span>{fmt(Math.max(0, (billingModal.entry.amount || 0) - (parseFloat(billingForm.discount) || 0) + (parseFloat(billingForm.extra_revenue) || 0)))}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={() => setBillingModal(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={billingModal.action === 'bill' ? handleBill : handleReceive} disabled={updateMutation.isPending}
                className="flex-1 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#2d4a6f] disabled:opacity-50">
                {billingModal.action === 'bill' ? 'Confirmar Faturamento' : 'Confirmar Recebimento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Amount Modal */}
      {editAmountModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Alterar Valor da Receita</h3>
            <p className="text-sm text-slate-500 mb-4 truncate">{editAmountModal.entry.description || 'Receita de projeto'}</p>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Novo Valor (R$) *</label>
              <input
                type="number" min="0.01" step="0.01"
                value={editAmountValue}
                onChange={e => setEditAmountValue(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditAmountModal(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleEditAmount} className="flex-1 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#2d4a6f]">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch modal */}
      {batchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {batchModal === 'bill' && 'Faturar em Lote'}
              {batchModal === 'receive' && 'Efetivar Recebimento em Lote'}
              {batchModal === 'revert_to_bill' && 'Voltar para A Faturar'}
              {batchModal === 'revert_to_billed' && 'Voltar para Faturado'}
              {batchModal === 'change_due_date' && 'Alterar Data de Vencimento em Lote'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {batchModal === 'bill' && `${selectableToBillIds.filter(id => selectedIds.includes(id)).length} receita(s) — Total: `}
              {batchModal === 'receive' && `${selectableBilledIds.filter(id => selectedIds.includes(id)).length} receita(s) — Total: `}
              {batchModal === 'change_due_date' && `${selectableBilledIds.filter(id => selectedIds.includes(id)).length} receita(s) faturadas serão atualizadas`}
              {batchModal === 'revert_to_bill' && `${selectableBilledIds.filter(id => selectedIds.includes(id)).length} receita(s) voltarão para "A Faturar"`}
              {batchModal === 'revert_to_billed' && `${selectableReceivedIds.filter(id => selectedIds.includes(id)).length} receita(s) voltarão para "Faturado"`}
              {(batchModal === 'bill' || batchModal === 'receive') && (
                <strong>{fmt(billings.filter(b => selectedIds.includes(b.id) && b.status === (batchModal === 'bill' ? 'to_bill' : 'billed')).reduce((s, b) => s + (b.amount || 0), 0))}</strong>
              )}
            </p>

            {batchModal === 'bill' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Data de Vencimento *</label>
                  <input type="date" value={batchForm.due_date} onChange={e => setBatchForm(p => ({ ...p, due_date: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Forma de Pagamento</label>
                  <select value={batchForm.payment_method} onChange={e => setBatchForm(p => ({ ...p, payment_method: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="pix">PIX</option>
                    <option value="transfer">Transferência</option>
                    <option value="boleto">Boleto</option>
                    <option value="check">Cheque</option>
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
              </div>
            )}

            {batchModal === 'receive' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Data de Efetivação *</label>
                  <input type="date" value={batchForm.received_date} onChange={e => setBatchForm(p => ({ ...p, received_date: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Conta de Destino *</label>
                  <select value={batchForm.account_id} onChange={e => setBatchForm(p => ({ ...p, account_id: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Selecione a conta...</option>
                    {accounts.filter(a => a.active).map(a => (
                      <option key={a.id} value={a.id}>{a.name} — {fmt(a.current_balance)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Desconto (R$)</label>
                    <input type="number" min="0" step="0.01" placeholder="0,00"
                      value={batchForm.discount} onChange={e => setBatchForm(p => ({ ...p, discount: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    <p className="text-xs text-slate-400 mt-1">Lança em 2.6 - Desconto</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Receita Extra (R$)</label>
                    <input type="number" min="0" step="0.01" placeholder="0,00"
                      value={batchForm.extra_revenue} onChange={e => setBatchForm(p => ({ ...p, extra_revenue: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    <p className="text-xs text-slate-400 mt-1">Lança em 1.5 - Receita Extra</p>
                  </div>
                </div>
                {(parseFloat(batchForm.discount) > 0 || parseFloat(batchForm.extra_revenue) > 0) && (() => {
                  const batchOriginal = billings.filter(b => selectedIds.includes(b.id) && b.status === 'billed').reduce((s, b) => s + (b.amount || 0), 0);
                  return (
                    <div className="p-3 bg-slate-50 rounded-lg text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Total original:</span><span>{fmt(batchOriginal)}</span>
                      </div>
                      {parseFloat(batchForm.discount) > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>(-) Desconto:</span><span>- {fmt(parseFloat(batchForm.discount))}</span>
                        </div>
                      )}
                      {parseFloat(batchForm.extra_revenue) > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>(+) Receita Extra:</span><span>+ {fmt(parseFloat(batchForm.extra_revenue))}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 mt-1 pt-1">
                        <span>Valor a receber:</span>
                        <span>{fmt(Math.max(0, batchOriginal - (parseFloat(batchForm.discount) || 0) + (parseFloat(batchForm.extra_revenue) || 0)))}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {batchModal === 'change_due_date' && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nova Data de Vencimento *</label>
                <input type="date" value={batchForm.due_date} onChange={e => setBatchForm(p => ({ ...p, due_date: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={() => setBatchModal(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button
                disabled={batchLoading}
                onClick={
                  batchModal === 'bill' ? handleBatchBill
                  : batchModal === 'receive' ? handleBatchReceive
                  : batchModal === 'revert_to_bill' ? handleBatchRevertToBill
                  : batchModal === 'revert_to_billed' ? handleBatchRevertToReceive
                  : handleBatchChangeDueDate
                }
                className={`flex-1 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${
                  batchModal === 'bill' ? 'bg-[#1e3a5f] hover:bg-[#2d4a6f]'
                  : batchModal === 'receive' ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-500 hover:bg-amber-600'
                }`}>
                {batchLoading ? 'Processando...'
                  : batchModal === 'bill' ? 'Confirmar Faturamento em Lote'
                  : batchModal === 'receive' ? 'Confirmar Recebimento em Lote'
                  : batchModal === 'revert_to_bill' ? 'Confirmar Reversão'
                  : batchModal === 'revert_to_billed' ? 'Confirmar Reversão'
                  : 'Confirmar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}