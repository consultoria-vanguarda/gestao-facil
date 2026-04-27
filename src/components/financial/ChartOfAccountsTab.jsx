import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';

const TYPE_LABELS = { revenue: 'Receita', expense: 'Despesa', asset: 'Ativo', liability: 'Passivo' };
const TYPE_COLORS = { revenue: 'text-emerald-700 bg-emerald-50', expense: 'text-rose-700 bg-rose-50', asset: 'text-blue-700 bg-blue-50', liability: 'text-amber-700 bg-amber-50' };
const emptyForm = { code: '', name: '', type: 'expense', category: '', active: true };

// Suggests next available sub-code under a parent code
function suggestSubCode(parentCode, existingCodes) {
  if (!parentCode) return '';
  const children = existingCodes.filter(c => c.startsWith(parentCode + '.'));
  const subNums = children.map(c => {
    const rest = c.slice(parentCode.length + 1);
    const num = parseInt(rest.split('.')[0]);
    return isNaN(num) ? 0 : num;
  });
  const next = subNums.length > 0 ? Math.max(...subNums) + 1 : 1;
  return `${parentCode}.${next}`;
}

export default function ChartOfAccountsTab() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState('all');
  const [insertMode, setInsertMode] = useState('new'); // 'new' | 'existing'
  const [selectedParent, setSelectedParent] = useState('');
  const [newCategoryMode, setNewCategoryMode] = useState(false);

  const { data: accounts = [] } = useQuery({ queryKey: ['chartOfAccounts'], queryFn: () => api.entities.ChartOfAccounts.list() });

  const saveMutation = useMutation({
    mutationFn: (data) => modal?.id ? api.entities.ChartOfAccounts.update(modal.id, data) : api.entities.ChartOfAccounts.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chartOfAccounts'] }); setModal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.ChartOfAccounts.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chartOfAccounts'] }),
  });

  const handleOpen = (account = null) => {
    if (account) {
      setForm({ code: account.code, name: account.name, type: account.type, category: account.category || '', active: account.active !== false });
      setModal({ id: account.id });
      setInsertMode('new');
      setSelectedParent('');
      setNewCategoryMode(false);
    } else {
      setForm(emptyForm);
      setModal({});
      setInsertMode('new');
      setSelectedParent('');
      setNewCategoryMode(false);
    }
  };

  // All unique existing categories
  const existingCategories = [...new Set(accounts.map(a => a.category).filter(Boolean))].sort();

  const handleParentSelect = (parentId) => {
    setSelectedParent(parentId);
    if (!parentId) {
      setForm(p => ({ ...p, code: '', category: '' }));
      return;
    }
    const parent = accounts.find(a => a.id === parentId);
    if (!parent) return;
    const existingCodes = accounts.map(a => a.code);
    const suggestedCode = suggestSubCode(parent.code, existingCodes);
    setForm(p => ({ ...p, code: suggestedCode, type: parent.type, category: parent.category || parent.name }));
  };

  const filtered = filterType === 'all' ? accounts : accounts.filter(a => a.type === filterType);
  const grouped = filtered.reduce((acc, a) => {
    const cat = a.category || 'Sem Categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Plano de Contas</CardTitle>
            <div className="flex gap-2">
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="all">Todos</option>
                <option value="revenue">Receitas</option>
                <option value="expense">Despesas</option>
              </select>
              <Button onClick={() => handleOpen()} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                <Plus className="w-4 h-4 mr-2" /> Nova Conta
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhuma conta cadastrada</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">{category}</h4>
                  <div className="space-y-1">
                    {items.sort((a, b) => a.code.localeCompare(b.code)).map(account => (
                      <div key={account.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-400 w-10">{account.code}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[account.type]}`}>{TYPE_LABELS[account.type]}</span>
                          <span className="text-sm font-medium text-slate-900">{account.name}</span>
                          {!account.active && <span className="text-xs text-slate-400">(inativa)</span>}
                        </div>
                        <div className="flex gap-1">
                          {!account.is_default ? (
                            <>
                              <button onClick={() => handleOpen(account)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => { if (confirm('Excluir conta?')) deleteMutation.mutate(account.id); }} className="p-1.5 text-slate-400 hover:text-rose-600 rounded">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-300 px-2">padrão</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {modal !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">{modal.id ? 'Editar Conta' : 'Nova Conta'}</h3>

            {/* Insert mode toggle - only for new accounts */}
            {!modal.id && (
              <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-4">
                <button
                  onClick={() => { setInsertMode('new'); setSelectedParent(''); setForm(emptyForm); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${insertMode === 'new' ? 'bg-[#1e3a5f] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Nova Conta / Grupo
                </button>
                <button
                  onClick={() => { setInsertMode('existing'); setSelectedParent(''); setForm(emptyForm); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${insertMode === 'existing' ? 'bg-[#1e3a5f] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Subconta de Existente
                </button>
              </div>
            )}

            <div className="space-y-3">
              {/* Parent selector for subconta mode */}
              {insertMode === 'existing' && !modal.id && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Conta Pai *</label>
                  <select
                    value={selectedParent}
                    onChange={e => handleParentSelect(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecione a conta pai...</option>
                    {[...accounts].sort((a, b) => a.code.localeCompare(b.code)).map(a => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Código *</label>
                  <input
                    placeholder="Ex: 3.1.5"
                    value={form.code}
                    onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                  {insertMode === 'existing' && selectedParent && (
                    <p className="text-xs text-slate-400 mt-0.5">Sugerido automaticamente</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo *</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="expense">Despesa</option>
                    <option value="revenue">Receita</option>
                    <option value="asset">Ativo</option>
                    <option value="liability">Passivo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nome da Conta *</label>
                <input placeholder="Nome da conta" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Categoria / Grupo</label>
                {!newCategoryMode ? (
                  <div className="flex gap-2">
                    <select
                      value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Sem categoria</option>
                      {existingCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setNewCategoryMode(true); setForm(p => ({ ...p, category: '' })); }}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                    >
                      + Nova
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      placeholder="Ex: Custos Operacionais"
                      value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => { setNewCategoryMode(false); setForm(p => ({ ...p, category: '' })); }}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancelar</button>
              <button
                onClick={() => {
                  if (!form.code || !form.name) return alert('Código e nome são obrigatórios');
                  saveMutation.mutate(form);
                }}
                disabled={saveMutation.isPending}
                className="flex-1 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}