import React, { useState, useMemo } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Landmark, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const emptyAccount = { name: '', type: 'checking', bank: '', initial_balance: '' };
const emptyTx = { description: '', amount: '', type: 'credit', date: format(new Date(), 'yyyy-MM-dd') };

export default function AccountsTab() {
  const queryClient = useQueryClient();
  const [accountModal, setAccountModal] = useState(null);
  const [txModal, setTxModal] = useState(null);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [txForm, setTxForm] = useState(emptyTx);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('current_month');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => api.entities.FinancialAccount.list() });
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', selectedAccount],
    queryFn: () => api.entities.AccountTransaction.filter({ account_id: selectedAccount }, '-date'),
    enabled: !!selectedAccount,
  });

  const currentMonthStr = format(new Date(), 'yyyy-MM');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const d = tx.date || '';
      if (filterPeriod === 'current_month') return d.startsWith(currentMonthStr);
      if (filterPeriod === 'custom') {
        let ok = true;
        if (periodStart) ok = ok && d >= periodStart;
        if (periodEnd) ok = ok && d <= periodEnd;
        return ok;
      }
      return true;
    });
  }, [transactions, filterPeriod, periodStart, periodEnd, currentMonthStr]);

  const totalCredits = filteredTransactions.filter(tx => tx.type === 'credit').reduce((s, tx) => s + (tx.amount || 0), 0);
  const totalDebits = filteredTransactions.filter(tx => tx.type === 'debit').reduce((s, tx) => s + (tx.amount || 0), 0);

  const saveMutation = useMutation({
    mutationFn: (data) => accountModal?.id
      ? api.entities.FinancialAccount.update(accountModal.id, data)
      : api.entities.FinancialAccount.create({ ...data, current_balance: parseFloat(data.initial_balance) || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accounts'] }); setAccountModal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.FinancialAccount.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const txMutation = useMutation({
    mutationFn: async (data) => {
      const account = accounts.find(a => a.id === data.account_id);
      const delta = data.type === 'credit' ? parseFloat(data.amount) : -parseFloat(data.amount);
      await api.entities.AccountTransaction.create(data);
      await api.entities.FinancialAccount.update(data.account_id, { current_balance: (account.current_balance || 0) + delta });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', selectedAccount] });
      setTxModal(null);
    },
  });

  const handleOpenAccount = (account = null) => {
    if (account) {
      setAccountForm({ name: account.name, type: account.type || 'checking', bank: account.bank || '', initial_balance: account.initial_balance || '' });
      setAccountModal({ id: account.id });
    } else {
      setAccountForm(emptyAccount);
      setAccountModal({});
    }
  };

  const handleSaveAccount = () => {
    if (!accountForm.name) return alert('Nome obrigatório');
    saveMutation.mutate({ ...accountForm, initial_balance: parseFloat(accountForm.initial_balance) || 0 });
  };

  const handleTx = () => {
    if (!txForm.description || !txForm.amount) return alert('Preencha os campos obrigatórios');
    txMutation.mutate({ ...txForm, account_id: selectedAccount, amount: parseFloat(txForm.amount), reference_type: 'manual' });
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Contas Financeiras</CardTitle>
            <Button onClick={() => handleOpenAccount()} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              <Plus className="w-4 h-4 mr-2" /> Nova Conta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Landmark className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhuma conta cadastrada</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map(a => (
                <div key={a.id}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAccount === a.id ? 'border-[#1e3a5f] bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                  onClick={() => setSelectedAccount(selectedAccount === a.id ? null : a.id)}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-slate-900">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.bank || 'Sem banco'}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={e => { e.stopPropagation(); handleOpenAccount(a); }} className="p-1 text-slate-400 hover:text-slate-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); if (confirm('Excluir conta?')) deleteMutation.mutate(a.id); }} className="p-1 text-slate-400 hover:text-rose-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className={`text-xl font-bold ${(a.current_balance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(a.current_balance)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAccount && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Extrato — {accounts.find(a => a.id === selectedAccount)?.name}</CardTitle>
                <Button size="sm" onClick={() => setTxModal({})} variant="outline">
                  <Plus className="w-4 h-4 mr-1" /> Lançamento Manual
                </Button>
              </div>
              {/* Period filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">
                  <option value="current_month">Mês corrente</option>
                  <option value="all_time">Todos os períodos</option>
                  <option value="custom">Selecionar período</option>
                </select>
                {filterPeriod === 'custom' && (
                  <div className="flex items-center gap-1">
                    <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                    <span className="text-slate-400 text-xs">até</span>
                    <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                )}
              </div>
              {/* Summary row */}
              <div className="flex gap-4 text-sm flex-wrap">
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <ArrowUpCircle className="w-4 h-4" /> Entradas: {fmt(totalCredits)}
                </span>
                <span className="flex items-center gap-1 text-rose-600 font-medium">
                  <ArrowDownCircle className="w-4 h-4" /> Saídas: {fmt(totalDebits)}
                </span>
                <span className="flex items-center gap-1 text-slate-700 font-bold">
                  Saldo do período: {fmt(totalCredits - totalDebits)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sem movimentações no período</p>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {tx.type === 'credit' ? <ArrowUpCircle className="w-5 h-5 text-emerald-500" /> : <ArrowDownCircle className="w-5 h-5 text-rose-500" />}
                      <div>
                        <p className="text-sm font-medium text-slate-900">{tx.description}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-400">{tx.date ? format(parseISO(tx.date), 'dd/MM/yyyy') : ''}</p>
                          {tx.reference_type && tx.reference_type !== 'manual' && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 capitalize">{tx.reference_type === 'receivable' ? 'Receita' : 'Despesa'}</span>
                          )}
                          {tx.reference_type === 'manual' && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">Manual</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`font-semibold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{fmt(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {accountModal !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">{accountModal.id ? 'Editar Conta' : 'Nova Conta'}</h3>
            <div className="space-y-3">
              <input placeholder="Nome da Conta *" value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Banco / Instituição" value={accountForm.bank} onChange={e => setAccountForm(p => ({ ...p, bank: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <select value={accountForm.type} onChange={e => setAccountForm(p => ({ ...p, type: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="checking">Conta Corrente</option>
                <option value="savings">Conta Poupança</option>
                <option value="cash">Caixa</option>
                <option value="other">Outro</option>
              </select>
              {!accountModal.id && (
                <input type="number" step="0.01" placeholder="Saldo Inicial (R$)" value={accountForm.initial_balance} onChange={e => setAccountForm(p => ({ ...p, initial_balance: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setAccountModal(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSaveAccount} className="flex-1 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {txModal !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Lançamento Manual</h3>
            <div className="space-y-3">
              <input placeholder="Descrição *" value={txForm.description} onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="0.01" placeholder="Valor (R$) *" value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <input type="date" value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <select value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="credit">Entrada (Crédito)</option>
                <option value="debit">Saída (Débito)</option>
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setTxModal(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleTx} className="flex-1 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium">Lançar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}