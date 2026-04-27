import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function TaxRatesTab() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ month: format(new Date(), 'yyyy-MM'), rate_percent: '', notes: '' });

  const { data: taxRates = [] } = useQuery({ queryKey: ['taxRates'], queryFn: () => api.entities.TaxRate.list('-month') });
  const { data: billings = [] } = useQuery({ queryKey: ['billings'], queryFn: () => api.entities.BillingEntry.list() });

  const saveMutation = useMutation({
    mutationFn: (data) => modal?.id ? api.entities.TaxRate.update(modal.id, data) : api.entities.TaxRate.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['taxRates'] }); setModal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.TaxRate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['taxRates'] }),
  });

  const getMonthRevenue = (monthStr) =>
    billings.filter(b => b.status === 'received' && (b.received_date || '').startsWith(monthStr))
      .reduce((s, b) => s + (b.amount || 0), 0);

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Alíquotas de Imposto Mensais</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Define o percentual de imposto sobre receitas para cada mês</p>
            </div>
            <Button onClick={() => { setForm({ month: format(new Date(), 'yyyy-MM'), rate_percent: '', notes: '' }); setModal({}); }} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              <Plus className="w-4 h-4 mr-2" /> Adicionar Mês
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {taxRates.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p>Nenhuma alíquota cadastrada</p>
              <p className="text-sm mt-1">Adicione a alíquota mensal para calcular os impostos sobre as receitas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-3 text-slate-600 font-medium">Mês de Referência</th>
                    <th className="text-right py-3 px-3 text-slate-600 font-medium">Alíquota (%)</th>
                    <th className="text-right py-3 px-3 text-slate-600 font-medium">Receitas do Mês</th>
                    <th className="text-right py-3 px-3 text-slate-600 font-medium">Imposto Calculado</th>
                    <th className="text-left py-3 px-3 text-slate-600 font-medium">Obs.</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {taxRates.map(tr => {
                    const revenue = getMonthRevenue(tr.month);
                    const tax = revenue * (tr.rate_percent / 100);
                    const [y, m] = tr.month.split('-');
                    const monthLabel = format(new Date(parseInt(y), parseInt(m) - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
                    return (
                      <tr key={tr.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-3 px-3 font-medium capitalize">{monthLabel}</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-700">{tr.rate_percent}%</td>
                        <td className="py-3 px-3 text-right text-emerald-700">{fmt(revenue)}</td>
                        <td className="py-3 px-3 text-right text-rose-700 font-semibold">{fmt(tax)}</td>
                        <td className="py-3 px-3 text-slate-400 text-xs">{tr.notes || '—'}</td>
                        <td className="py-3 px-3">
                          <div className="flex gap-1">
                            <button onClick={() => { setForm({ month: tr.month, rate_percent: String(tr.rate_percent), notes: tr.notes || '' }); setModal({ id: tr.id }); }} className="p-1.5 text-slate-400 hover:text-slate-700">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { if (confirm('Excluir?')) deleteMutation.mutate(tr.id); }} className="p-1.5 text-slate-400 hover:text-rose-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {modal !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-4">{modal.id ? 'Editar Alíquota' : 'Nova Alíquota'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Mês de Referência *</label>
                <input type="month" value={form.month} onChange={e => setForm(p => ({ ...p, month: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Alíquota (%) *</label>
                <input type="number" step="0.01" min="0" max="100" placeholder="Ex: 15.5" value={form.rate_percent} onChange={e => setForm(p => ({ ...p, rate_percent: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Observações</label>
                <input placeholder="Ex: Simples Nacional, IRPJ, etc." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancelar</button>
              <button onClick={() => { if (!form.month || !form.rate_percent) return alert('Campos obrigatórios'); saveMutation.mutate({ month: form.month, rate_percent: parseFloat(form.rate_percent), notes: form.notes }); }} className="flex-1 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}