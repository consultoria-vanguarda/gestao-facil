import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/appApi';
import { format, parseISO } from 'date-fns';
import { DollarSign, CheckCircle, Receipt, ChevronRight, Pencil } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import MoneyInput from "@/components/ui/MoneyInput";
import ExpenseForm from '@/components/forms/ExpenseForm';
import { parseMoneyBRToNumber, validateISODate, validateMoney } from "@/lib/validators";

function ConfirmReceivableModal({ open, onClose, onConfirm, amount }) {
  const [description, setDescription] = useState('Valor produzido aprovado');
  const [paymentType, setPaymentType] = useState('integral'); // 'integral' | 'parcial'
  const [dueDate, setDueDate] = useState('');
  const [installments, setInstallments] = useState([{ due_date: '', amount: '' }]);

  const handleInstallmentCount = (count) => {
    const n = Math.max(1, Math.min(24, parseInt(count) || 1));
    const perInstallment = Number((amount / n).toFixed(2));
    setInstallments(Array.from({ length: n }, (_, i) => ({
      due_date: installments[i]?.due_date || '',
      amount: perInstallment,
    })));
  };

  const updateInstallment = (index, field, value) => {
    setInstallments(prev => prev.map((inst, i) => i === index ? { ...inst, [field]: value } : inst));
  };

  const totalInstallments = installments.reduce((s, i) => s + (parseMoneyBRToNumber(i.amount) || 0), 0);
  const isValid = paymentType === 'integral'
    ? validateISODate(dueDate)
    : installments.every(i => validateISODate(i.due_date) && validateMoney(i.amount, { min: 0.01 }));

  const handleConfirm = () => {
    if (paymentType === 'integral') {
      onConfirm([{ description, dueDate, amount }]);
    } else {
      onConfirm(installments.map((inst, i) => ({
        description: `${description} — Parcela ${i + 1}/${installments.length}`,
        dueDate: inst.due_date,
        amount: parseMoneyBRToNumber(inst.amount),
      })));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar em Contas a Receber</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-3 bg-emerald-50 rounded-lg">
            <p className="text-sm text-emerald-600">Valor total a lançar</p>
            <p className="text-2xl font-bold text-emerald-700">R$ {amount.toFixed(2)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Payment type selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Recebimento</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentType('integral')}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${paymentType === 'integral' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                Integral
              </button>
              <button
                onClick={() => setPaymentType('parcial')}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${paymentType === 'parcial' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                Parcelado
              </button>
            </div>
          </div>

          {paymentType === 'integral' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de Vencimento *</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </div>
          )}

          {paymentType === 'parcial' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Parcelas</label>
                <input
                  type="number" min="1" max="24"
                  value={installments.length}
                  onChange={(e) => handleInstallmentCount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {installments.map((inst, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs text-slate-500 w-16 shrink-0">Parcela {i + 1}</span>
                    <input
                      type="date" value={inst.due_date}
                      onChange={(e) => updateInstallment(i, 'due_date', e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-slate-300 rounded-md text-sm"
                    />
                    <MoneyInput
                      value={inst.amount}
                      onChange={(v) => updateInstallment(i, 'amount', v)}
                      className="w-28"
                      placeholder="0,00"
                    />
                  </div>
                ))}
              </div>
              <div className={`text-xs font-medium text-right ${Math.abs(totalInstallments - amount) > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>
                Total das parcelas: R$ {totalInstallments.toFixed(2)} {Math.abs(totalInstallments - amount) > 0.01 ? `(diferença: R$ ${(totalInstallments - amount).toFixed(2)})` : '✓'}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!isValid} className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirm}>
            <CheckCircle className="w-4 h-4 mr-2" /> Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FinancialTab({ project, projectId, expenses }) {
  const queryClient = useQueryClient();
  const [confirmModal, setConfirmModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setEditingExpense(null);
    }
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => api.entities.ProjectSchedule.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables', projectId],
    queryFn: () => api.entities.ProjectReceivable.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const createReceivableMutation = useMutation({
    mutationFn: (data) => api.entities.ProjectReceivable.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables', projectId] });
      setConfirmModal(false);
    }
  });

  const hourlyRate = project?.hourly_rate || 0;
  const approvedSchedules = schedules.filter(s => s.status === 'completed' && s.approved);
  const completedSchedules = schedules.filter(s => s.status === 'completed');

  const approvedHours = approvedSchedules.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
  const completedHours = completedSchedules.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
  const producedValue = completedHours * hourlyRate;
  const approvedValue = approvedHours * hourlyRate;

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalReceivablesLaunched = receivables.reduce((sum, r) => sum + (r.amount || 0), 0);

  const pendingToLaunch = approvedValue - totalReceivablesLaunched;

  const handleConfirmReceivable = ({ description, dueDate, amount }) => {
    createReceivableMutation.mutate({
      project_id: projectId,
      description,
      due_date: dueDate,
      amount,
      status: 'open'
    });
  };

  const categoryLabels = {
    travel: 'Viagem', materials: 'Materiais', tools: 'Ferramentas',
    administrative: 'Administrativo', meals: 'Alimentação', software: 'Software', other: 'Outro'
  };

  const statusColors = {
    open: 'bg-amber-100 text-amber-700',
    received: 'bg-emerald-100 text-emerald-700',
    overdue: 'bg-rose-100 text-rose-700'
  };
  const statusLabels = { open: 'Em aberto', received: 'Recebido', overdue: 'Vencido' };

  return (
    <div className="space-y-4">
      {/* Produced Value Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-sm text-blue-600 font-medium mb-1">Valor Contratado</p>
          <p className="text-2xl font-bold text-blue-800">R$ {(project?.contracted_value || 0).toLocaleString('pt-BR')}</p>
        </div>
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-sm text-emerald-600 font-medium mb-1">Valor Produzido</p>
          <p className="text-2xl font-bold text-emerald-700">R$ {producedValue.toFixed(2)}</p>
          <p className="text-xs text-emerald-500 mt-1">{completedHours.toFixed(1)}h × R$ {hourlyRate.toFixed(2)}/h</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
          <p className="text-sm text-purple-600 font-medium mb-1">Valor Aprovado</p>
          <p className="text-2xl font-bold text-purple-700">R$ {approvedValue.toFixed(2)}</p>
          <p className="text-xs text-purple-500 mt-1">{approvedHours.toFixed(1)}h aprovadas</p>
        </div>
      </div>

      {/* Send to Receivables */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Contas a Receber do Projeto
            </CardTitle>
            {pendingToLaunch > 0 && (
              <Button className="bg-emerald-600 hover:bg-emerald-700" size="sm"
                onClick={() => setConfirmModal(true)}>
                <ChevronRight className="w-4 h-4 mr-1" />
                Confirmar R$ {pendingToLaunch.toFixed(2)} para C/R
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {receivables.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum recebível lançado ainda</p>
              {approvedValue > 0 && (
                <p className="text-xs mt-1 text-emerald-600">
                  R$ {approvedValue.toFixed(2)} aprovados aguardando lançamento
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {receivables.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{r.description}</p>
                    <p className="text-xs text-slate-500">
                      Vence: {r.due_date ? format(parseISO(r.due_date), 'dd/MM/yyyy') : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800">R$ {(r.amount || 0).toFixed(2)}</span>
                    <Badge className={`text-xs ${statusColors[r.status] || 'bg-slate-100 text-slate-600'}`}>
                      {statusLabels[r.status] || r.status}
                    </Badge>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                <span className="text-sm font-medium text-slate-700">Total lançado</span>
                <span className="font-bold text-slate-900">R$ {totalReceivablesLaunched.toFixed(2)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4 text-rose-500" />
            Despesas do Projeto
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma despesa registrada neste projeto</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{exp.description || categoryLabels[exp.category] || exp.category}</p>
                    <p className="text-xs text-slate-500">
                      {categoryLabels[exp.category] || exp.category} • {exp.due_date ? format(parseISO(exp.due_date), 'dd/MM/yyyy') : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-rose-600">R$ {(exp.amount || 0).toFixed(2)}</span>
                    <button
                      onClick={() => setEditingExpense(exp)}
                      className="p-1 text-slate-400 hover:text-[#1e3a5f] transition-colors"
                      title="Editar despesa"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                <span className="text-sm font-medium text-slate-700">Total de despesas</span>
                <span className="font-bold text-rose-600">R$ {totalExpenses.toFixed(2)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {editingExpense && (
        <ExpenseForm
          open={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          expense={editingExpense}
          onSave={(data) => updateExpenseMutation.mutate({ id: editingExpense.id, data })}
          loading={updateExpenseMutation.isPending}
        />
      )}

      <ConfirmReceivableModal
        open={confirmModal}
        onClose={() => setConfirmModal(false)}
        amount={pendingToLaunch}
        onConfirm={handleConfirmReceivable}
      />
    </div>
  );
}