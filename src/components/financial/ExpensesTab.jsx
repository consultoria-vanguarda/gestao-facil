import React, { useState, useEffect } from 'react';
import { usePeriod } from './PeriodContext';
import { api, formatEntitySaveError } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Plus, Receipt, MoreHorizontal, Pencil, Trash2, Upload, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Trigger do banco mapeia to_pay→pending e paid→reimbursed (compat. com tela de despesas).
const STATUS_CONFIG = {
  to_pay: { label: 'A Pagar', color: 'bg-amber-100 text-amber-800' },
  pending: { label: 'A Pagar', color: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Pago', color: 'bg-emerald-100 text-emerald-800' },
  reimbursed: { label: 'Pago', color: 'bg-emerald-100 text-emerald-800' },
};

const isOpenExpense = (status) => status === 'to_pay' || status === 'pending';
const isPaidExpense = (status) => status === 'paid' || status === 'reimbursed';

const createEmptyForm = () => ({
  project_id: '',
  consultant_id: '',
  chart_account_id: '',
  description: '',
  amount: '',
  due_date: format(new Date(), 'yyyy-MM-dd'),
  receipt_url: '',
  reimbursable: false,
});

// ── Formulário de registro/edição ──────────────────────────────────────────
function ExpenseFormModal({ open, onClose, expense, projects, consultants, chartAccounts, onSave, loading }) {
  const [form, setForm] = useState(createEmptyForm);
  const [uploading, setUploading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState(3);

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setForm({
        project_id: expense.project_id || '',
        consultant_id: expense.consultant_id || '',
        chart_account_id: expense.chart_account_id || '',
        description: expense.description || '',
        amount: expense.amount?.toString() || '',
        due_date: expense.due_date || expense.date || format(new Date(), 'yyyy-MM-dd'),
        receipt_url: expense.receipt_url || '',
        reimbursable: expense.reimbursable || false,
      });
      setIsRecurring(false);
    } else {
      setForm(createEmptyForm());
      setIsRecurring(false);
    }
  }, [expense, open]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    setForm(p => ({ ...p, receipt_url: file_url }));
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || !form.due_date) return alert('Valor e data de vencimento são obrigatórios');
    const base = { ...form, amount: parseFloat(form.amount) || 0 };
    if (!isRecurring || expense) {
      onSave(base);
    } else {
      const entries = [];
      for (let i = 0; i < recurringMonths; i++) {
        const due = new Date(form.due_date + 'T12:00:00');
        due.setMonth(due.getMonth() + i);
        const dueStr = due.toISOString().split('T')[0];
        entries.push({
          ...base,
          due_date: dueStr,
          description: `${form.description}${recurringMonths > 1 ? ` (${i + 1}/${recurringMonths})` : ''}`.trim(),
        });
      }
      onSave(entries);
    }
  };

  const expenseAccounts = chartAccounts.filter(a => a.type === 'expense' && a.active !== false);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col" aria-describedby="exp-desc">
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
          <DialogDescription id="exp-desc">Registre despesas operacionais ou de projeto</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1 overflow-y-auto flex-1 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Valor (R$) *</Label>
              <input type="number" step="0.01" min="0" placeholder="0,00" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" required />
            </div>
            <div>
              <Label className="text-sm">Data de Vencimento *</Label>
              <input type="date" value={form.due_date}
                onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" required />
            </div>
          </div>

          <div>
            <Label className="text-sm">Conta do Plano de Contas</Label>
            <select value={form.chart_account_id} onChange={e => setForm(p => ({ ...p, chart_account_id: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Selecione a conta...</option>
              {expenseAccounts.sort((a, b) => a.code.localeCompare(b.code)).map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-sm">Projeto (opcional)</Label>
            <select value={form.project_id} onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Sem vínculo com projeto</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <Label className="text-sm">Consultor (opcional)</Label>
            <select value={form.consultant_id} onChange={e => setForm(p => ({ ...p, consultant_id: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Nenhum</option>
              {consultants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <Label className="text-sm">Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2} placeholder="Detalhe a despesa..." className="mt-1 text-sm" />
          </div>

          <div>
            <Label className="text-sm">Comprovante / Documento</Label>
            <div className="flex items-center gap-3 mt-1">
              <input type="file" id="exp-file-upload" className="hidden" accept="image/*,.pdf"
                onChange={handleFileUpload} />
              <Button type="button" variant="outline" size="sm"
                onClick={() => document.getElementById('exp-file-upload').click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                {form.receipt_url ? 'Substituir' : 'Anexar'}
              </Button>
              {form.receipt_url && (
                <a href={form.receipt_url} target="_blank" rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Ver documento
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="reimb" checked={form.reimbursable}
              onCheckedChange={v => setForm(p => ({ ...p, reimbursable: v }))} />
            <Label htmlFor="reimb" className="cursor-pointer text-sm">Despesa reembolsável</Label>
          </div>

          {/* Recorrência — apenas para nova despesa */}
          {!expense && (
            <div className="border border-slate-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="recurring" checked={isRecurring} onCheckedChange={v => setIsRecurring(!!v)} />
                <Label htmlFor="recurring" className="cursor-pointer text-sm font-medium">Despesa recorrente</Label>
              </div>
              {isRecurring && (
                <div className="pl-6 space-y-2">
                  <div>
                    <Label className="text-sm">Número de meses *</Label>
                    <input type="number" min="2" max="60" value={recurringMonths}
                      onChange={e => setRecurringMonths(Math.max(2, parseInt(e.target.value) || 2))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div className="text-xs text-slate-500 bg-slate-50 rounded p-2">
                    Serão criadas <strong>{recurringMonths}</strong> despesas mensais de{' '}
                    <strong>R$ {(parseFloat(form.amount) || 0).toFixed(2)}</strong> cada,
                    vencendo todo dia <strong>{form.due_date ? new Date(form.due_date + 'T12:00:00').getDate() : '?'}</strong>.
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {expense ? 'Salvar' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de Baixa (Pagamento) ─────────────────────────────────────────────
function PayModal({ expense, accounts, onConfirm, onClose, loading }) {
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [accountId, setAccountId] = useState('');

  if (!expense) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Baixar Pagamento</h3>
        <p className="text-sm text-slate-500 mb-4">{fmt(expense.amount)} — {expense.description || 'Despesa'}</p>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Data de Pagamento *</label>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Conta de Origem *</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Selecione a conta...</option>
              {accounts.filter(a => a.active !== false).map(a => (
                <option key={a.id} value={a.id}>{a.name} — {fmt(a.current_balance)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!accountId) return alert('Selecione a conta de origem');
              if (!payDate) return alert('Informe a data de pagamento');
              onConfirm({ accountId, payDate });
            }}
            disabled={loading}
            className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            Confirmar Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ───────────────────────────────────────────────────
export default function ExpensesTab() {
  const queryClient = useQueryClient();
  const { period } = usePeriod();
  const { user } = useAuth();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [payingExpense, setPayingExpense] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('current_month');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [reverseLoadingId, setReverseLoadingId] = useState(null);

  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => api.entities.Expense.list('-due_date') });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.entities.Project.list() });
  const { data: consultants = [] } = useQuery({ queryKey: ['consultants'], queryFn: () => api.entities.Consultant.list() });
  const { data: chartAccounts = [] } = useQuery({ queryKey: ['chartOfAccounts'], queryFn: () => api.entities.ChartOfAccounts.list() });
  const { data: financialAccounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => api.entities.FinancialAccount.list() });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Expense.create({ ...data, status: 'to_pay' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setFormOpen(false);
      setEditingExpense(null);
      toast({ title: 'Despesa registrada', description: 'O lançamento foi salvo com sucesso.' });
    },
    onError: (error) => {
      console.error('Erro ao criar despesa:', error);
      toast({
        variant: 'destructive',
        title: 'Não foi possível registrar a despesa',
        description: formatEntitySaveError(error),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setFormOpen(false);
      setEditingExpense(null);
      toast({ title: 'Despesa atualizada', description: 'As alterações foram salvas.' });
    },
    onError: (error) => {
      console.error('Erro ao atualizar despesa:', error);
      toast({
        variant: 'destructive',
        title: 'Não foi possível salvar a despesa',
        description: formatEntitySaveError(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setDeleteConfirm(null);
    },
  });

  const handleSave = async (data) => {
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
      return;
    }
    if (Array.isArray(data)) {
      try {
        for (const entry of data) {
          await api.entities.Expense.create({ ...entry, status: 'to_pay' });
        }
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        setFormOpen(false);
        setEditingExpense(null);
        toast({
          title: 'Despesas registradas',
          description: `${data.length} lançamentos recorrentes foram salvos.`,
        });
      } catch (error) {
        console.error('Erro ao criar despesas recorrentes:', error);
        toast({
          variant: 'destructive',
          title: 'Não foi possível registrar as despesas',
          description: formatEntitySaveError(error),
        });
      }
      return;
    }
    createMutation.mutate(data);
  };

  const handlePay = async ({ accountId, payDate }) => {
    setPayLoading(true);
    const expense = payingExpense;
    const account = financialAccounts.find(a => a.id === accountId);
    const newBalance = (account.current_balance || 0) - expense.amount;

    await api.entities.Expense.update(expense.id, {
      status: 'paid',
      payment_date: payDate,
      payment_account_id: accountId,
    });
    await api.entities.FinancialAccount.update(accountId, { current_balance: newBalance });
    await api.entities.AccountTransaction.create({
      account_id: accountId,
      type: 'debit',
      amount: expense.amount,
      description: expense.description || 'Pagamento de despesa',
      date: payDate,
      reference_type: 'payable',
      reference_id: expense.id,
      project_id: expense.project_id || undefined,
    });

    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    setPayingExpense(null);
    setPayLoading(false);
  };

  const handleReversePayment = async (expense) => {
    if (!expense || !isPaidExpense(expense.status)) return;
    const ok = window.confirm('Confirmar reversão desta despesa paga?');
    if (!ok) return;

    try {
      setReverseLoadingId(expense.id);
      const nowIso = new Date().toISOString();
      const actorName = user?.full_name || user?.email || 'Usuário';
      const actorId = user?.id || null;

      // Reverte impacto no saldo da conta (se existir conta vinculada ao pagamento).
      if (expense.payment_account_id) {
        const account = financialAccounts.find((a) => a.id === expense.payment_account_id);
        if (account) {
          const newBalance = (account.current_balance || 0) + (expense.amount || 0);
          await api.entities.FinancialAccount.update(expense.payment_account_id, { current_balance: newBalance });
        }

        await api.entities.AccountTransaction.create({
          account_id: expense.payment_account_id,
          type: 'credit',
          amount: expense.amount || 0,
          description: `Reversão de despesa paga: ${expense.description || 'Despesa'}`,
          date: nowIso.slice(0, 10),
          reference_type: 'payable_reversal',
          reference_id: expense.id,
          project_id: expense.project_id || undefined,
        });
      }

      // Data e autor da reversão são sempre automáticos (não editáveis no formulário).
      await api.entities.Expense.update(expense.id, {
        status: 'to_pay',
        payment_date: null,
        payment_account_id: null,
        reversal_requested_at: nowIso,
        reversal_requested_by_name: actorName,
        reversal_requested_by_id: actorId,
      });

      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    } finally {
      setReverseLoadingId(null);
    }
  };

  const globalPeriodStr = `${period.year}-${String(period.month).padStart(2, '0')}`;
  const filteredExpenses = expenses.filter(e => {
    const matchStatus =
      filterStatus === 'all'
      || (filterStatus === 'to_pay' && isOpenExpense(e.status))
      || (filterStatus === 'paid' && isPaidExpense(e.status));
    const matchProject = filterProject === 'all' || e.project_id === filterProject;
    const matchAccount = filterAccount === 'all' || e.chart_account_id === filterAccount;
    let matchPeriod = true;
    const dateRef = e.due_date || e.payment_date || '';
    if (filterPeriod === 'current_month') {
      matchPeriod = dateRef.startsWith(globalPeriodStr);
    } else if (filterPeriod === 'custom') {
      if (periodStart) matchPeriod = matchPeriod && dateRef >= periodStart;
      if (periodEnd) matchPeriod = matchPeriod && dateRef <= periodEnd;
    }
    return matchStatus && matchProject && matchAccount && matchPeriod;
  });

  const totalToPay = expenses.filter(e => isOpenExpense(e.status) && (e.due_date || '').startsWith(globalPeriodStr)).reduce((s, e) => s + (e.amount || 0), 0);
  const totalPaid = expenses.filter(e => isPaidExpense(e.status) && (e.payment_date || '').startsWith(globalPeriodStr)).reduce((s, e) => s + (e.amount || 0), 0);
  const totalFiltered = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const getAccountLabel = (id) => {
    const a = chartAccounts.find(a => a.id === id);
    return a ? `${a.code} — ${a.name}` : null;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">A Pagar no Período</p>
            <p className="font-bold text-amber-700 text-lg">{fmt(totalToPay)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Pago no Período</p>
            <p className="font-bold text-emerald-700 text-lg">{fmt(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total filtrado</p>
            <p className="font-bold text-slate-900 text-lg">{fmt(totalFiltered)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Despesas</CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="current_month">Mês corrente</option>
                <option value="all_time">Todos os períodos</option>
                <option value="custom">Selecionar período</option>
              </select>
              {filterPeriod === 'custom' && (
                <div className="flex items-center gap-1">
                  <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2 py-2 text-sm" />
                  <span className="text-slate-400 text-xs">até</span>
                  <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2 py-2 text-sm" />
                </div>
              )}
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="all">Todos os status</option>
                <option value="to_pay">A Pagar</option>
                <option value="paid">Pago</option>
              </select>
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="all">Todos os projetos</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="all">Todas as contas</option>
                {chartAccounts.filter(a => a.type === 'expense').sort((a, b) => a.code.localeCompare(b.code)).map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
              <Button onClick={() => { setEditingExpense(null); setFormOpen(true); }} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                <Plus className="w-4 h-4 mr-2" /> Nova Despesa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhuma despesa encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredExpenses.map(expense => {
                const project = projects.find(p => p.id === expense.project_id);
                const consultant = consultants.find(c => c.id === expense.consultant_id);
                const sc = STATUS_CONFIG[expense.status] || STATUS_CONFIG.to_pay;
                const accountLabel = getAccountLabel(expense.chart_account_id);
                return (
                  <div key={expense.id} className="flex items-start justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900">{fmt(expense.amount)}</span>
                        <Badge className={sc.color + ' border-0 text-xs'}>{sc.label}</Badge>
                        {expense.reimbursable && <Badge className="bg-purple-50 text-purple-700 border-0 text-xs">Reembolsável</Badge>}
                      </div>
                      <p className="text-xs text-slate-500">
                        Venc.: {expense.due_date ? format(parseISO(expense.due_date), 'dd/MM/yyyy') : '—'}
                        {expense.payment_date && (
                          <span className="ml-3 text-emerald-600">Pago em: {format(parseISO(expense.payment_date), 'dd/MM/yyyy')}</span>
                        )}
                        {expense.reversal_requested_at && (
                          <span className="ml-3 text-amber-700">
                            Reversão: {format(parseISO(expense.reversal_requested_at), 'dd/MM/yyyy HH:mm')} por {expense.reversal_requested_by_name || 'Usuário'}
                          </span>
                        )}
                        {accountLabel && <span className="ml-2 font-medium text-slate-700">{accountLabel}</span>}
                      </p>
                      {expense.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{expense.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-0.5">
                        {project && <span>Projeto: {project.name}</span>}
                        {consultant && <span>Consultor: {consultant.name}</span>}
                        {expense.receipt_url && (
                          <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Ver documento
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isOpenExpense(expense.status) && (
                        <button onClick={() => setPayingExpense(expense)}
                          className="flex items-center gap-1 px-2 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded font-medium whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Baixar
                        </button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 text-slate-400 hover:text-slate-700 rounded">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingExpense(expense); setFormOpen(true); }}>
                            <Pencil className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          {isPaidExpense(expense.status) && (
                            <DropdownMenuItem
                              disabled={reverseLoadingId === expense.id}
                              onClick={() => handleReversePayment(expense)}
                              className="text-amber-700"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              {reverseLoadingId === expense.id ? 'Revertendo...' : 'Reverter Pagamento'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setDeleteConfirm(expense)} className="text-rose-600">
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingExpense(null); }}
        expense={editingExpense}
        projects={projects}
        consultants={consultants}
        chartAccounts={chartAccounts}
        onSave={handleSave}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <PayModal
        expense={payingExpense}
        accounts={financialAccounts}
        onConfirm={handlePay}
        onClose={() => setPayingExpense(null)}
        loading={payLoading}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta despesa?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteConfirm.id)} className="bg-rose-600 hover:bg-rose-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}