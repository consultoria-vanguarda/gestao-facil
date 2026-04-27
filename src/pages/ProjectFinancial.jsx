import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { ArrowLeft, Plus, DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isPast } from 'date-fns';

export default function ProjectFinancial() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  
  const [receivableForm, setReceivableForm] = useState({ description: '', due_date: '', amount: '', payment_method: 'pix' });
  const [payableForm, setPayableForm] = useState({ description: '', due_date: '', amount: '', category: 'other', consultant_id: '' });
  const [showReceivableForm, setShowReceivableForm] = useState(false);
  const [showPayableForm, setShowPayableForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await api.entities.Project.filter({ id: projectId });
      return projects[0];
    },
    enabled: !!projectId,
  });

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables', projectId],
    queryFn: () => api.entities.ProjectReceivable.filter({ project_id: projectId }, '-due_date'),
    enabled: !!projectId,
  });

  const { data: payables = [] } = useQuery({
    queryKey: ['payables', projectId],
    queryFn: () => api.entities.ProjectPayable.filter({ project_id: projectId }, '-due_date'),
    enabled: !!projectId,
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list(),
  });

  const createReceivableMutation = useMutation({
    mutationFn: (data) => api.entities.ProjectReceivable.create({ ...data, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables', projectId] });
      setReceivableForm({ description: '', due_date: '', amount: '', payment_method: 'pix' });
      setShowReceivableForm(false);
    },
  });

  const createPayableMutation = useMutation({
    mutationFn: (data) => api.entities.ProjectPayable.create({ ...data, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payables', projectId] });
      setPayableForm({ description: '', due_date: '', amount: '', category: 'other' });
      setShowPayableForm(false);
    },
  });

  const updateReceivableStatusMutation = useMutation({
    mutationFn: ({ id, status }) => api.entities.ProjectReceivable.update(id, { 
      status, 
      received_at: status === 'received' ? new Date().toISOString().split('T')[0] : null 
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['receivables', projectId] }),
  });

  const updatePayableStatusMutation = useMutation({
    mutationFn: ({ id, status }) => api.entities.ProjectPayable.update(id, { 
      status, 
      paid_at: status === 'paid' ? new Date().toISOString().split('T')[0] : null 
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payables', projectId] }),
  });

  const handleReceivableSubmit = (e) => {
    e.preventDefault();
    if (!receivableForm.description || !receivableForm.due_date || !receivableForm.amount) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    createReceivableMutation.mutate({
      ...receivableForm,
      amount: parseFloat(receivableForm.amount),
      status: 'open'
    });
  };

  const handlePayableSubmit = (e) => {
    e.preventDefault();
    if (!payableForm.description || !payableForm.due_date || !payableForm.amount) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    createPayableMutation.mutate({
      ...payableForm,
      amount: parseFloat(payableForm.amount),
      consultant_id: payableForm.consultant_id || null,
      status: 'open'
    });
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  const totalReceivable = receivables.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalReceived = receivables.filter(r => r.status === 'received').reduce((sum, r) => sum + (r.amount || 0), 0);
  const openReceivables = receivables.filter(r => r.status === 'open').reduce((sum, r) => sum + (r.amount || 0), 0);
  
  const totalPayable = payables.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPaid = payables.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0);
  const openPayables = payables.filter(p => p.status === 'open').reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const projectBalance = totalReceived - totalPaid;
  
  const filteredReceivables = filterStatus === 'all' ? receivables : receivables.filter(r => r.status === filterStatus);
  const filteredPayables = filterStatus === 'all' ? payables : payables.filter(p => p.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={createPageUrl(`ProjectDetail?id=${projectId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-slate-500">{project.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">A Receber</p>
                <p className="font-semibold text-slate-900">R$ {totalReceivable.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Recebido</p>
                <p className="font-semibold text-emerald-600">R$ {totalReceived.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <TrendingDown className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">A Pagar</p>
                <p className="font-semibold text-slate-900">R$ {totalPayable.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${projectBalance >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                <DollarSign className={`w-5 h-5 ${projectBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Saldo</p>
                <p className={`font-semibold ${projectBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  R$ {projectBalance.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="receivables" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="receivables">A Receber</TabsTrigger>
          <TabsTrigger value="payables">A Pagar</TabsTrigger>
        </TabsList>

        <TabsContent value="receivables">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Contas a Receber</CardTitle>
                <Button 
                  onClick={() => setShowReceivableForm(!showReceivableForm)}
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                >
                  <Plus className="w-4 h-4 mr-2" /> Novo Recebível
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700">Filtrar:</label>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="all">Todos</option>
                  <option value="open">Em Aberto</option>
                  <option value="received">Recebido</option>
                  <option value="overdue">Vencido</option>
                </select>
                <div className="ml-auto text-sm text-slate-600">
                  Em aberto: <strong className="text-amber-600">R$ {openReceivables.toFixed(2)}</strong> • 
                  Recebido: <strong className="text-emerald-600">R$ {totalReceived.toFixed(2)}</strong>
                </div>
              </div>

              {showReceivableForm && (
                <form onSubmit={handleReceivableSubmit} className="mb-6 p-4 bg-slate-50 rounded-lg space-y-3">
                  <input 
                    type="text"
                    placeholder="Descrição *"
                    value={receivableForm.description}
                    onChange={(e) => setReceivableForm({...receivableForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="date"
                      value={receivableForm.due_date}
                      onChange={(e) => setReceivableForm({...receivableForm, due_date: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      required
                    />
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Valor (R$) *"
                      value={receivableForm.amount}
                      onChange={(e) => setReceivableForm({...receivableForm, amount: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      required
                    />
                  </div>
                  <select 
                    value={receivableForm.payment_method}
                    onChange={(e) => setReceivableForm({...receivableForm, payment_method: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value="pix">PIX</option>
                    <option value="transfer">Transferência</option>
                    <option value="boleto">Boleto</option>
                    <option value="check">Cheque</option>
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="debit_card">Cartão de Débito</option>
                    <option value="other">Outro</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-md text-sm hover:bg-[#2d4a6f]">
                      Adicionar
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowReceivableForm(false)}
                      className="px-4 py-2 border border-slate-300 rounded-md text-sm hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {filteredReceivables.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma conta a receber</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredReceivables.map((rec) => {
                    const isOverdue = rec.status === 'open' && isPast(parseISO(rec.due_date));
                    return (
                      <div key={rec.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{rec.description}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(parseISO(rec.due_date), 'dd/MM/yyyy')}
                            </span>
                            <span>{rec.payment_method}</span>
                            {rec.status === 'received' && rec.received_at && (
                              <span className="text-emerald-600">
                                Recebido em {format(parseISO(rec.received_at), 'dd/MM/yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-900">
                            R$ {rec.amount?.toLocaleString('pt-BR')}
                          </span>
                          {rec.status === 'received' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">Recebido</Badge>
                          ) : isOverdue ? (
                            <Badge className="bg-rose-100 text-rose-700 border-0">Vencido</Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => updateReceivableStatusMutation.mutate({ id: rec.id, status: 'received' })}
                              className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                            >
                              Dar Baixa
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payables">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Contas a Pagar</CardTitle>
                <Button 
                  onClick={() => setShowPayableForm(!showPayableForm)}
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                >
                  <Plus className="w-4 h-4 mr-2" /> Novo Pagável
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700">Filtrar:</label>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="all">Todos</option>
                  <option value="open">Em Aberto</option>
                  <option value="paid">Pago</option>
                  <option value="overdue">Vencido</option>
                </select>
                <div className="ml-auto text-sm text-slate-600">
                  Em aberto: <strong className="text-amber-600">R$ {openPayables.toFixed(2)}</strong> • 
                  Pago: <strong className="text-emerald-600">R$ {totalPaid.toFixed(2)}</strong>
                </div>
              </div>

              {showPayableForm && (
                <form onSubmit={handlePayableSubmit} className="mb-6 p-4 bg-slate-50 rounded-lg space-y-3">
                  <input 
                    type="text"
                    placeholder="Descrição *"
                    value={payableForm.description}
                    onChange={(e) => setPayableForm({...payableForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="date"
                      value={payableForm.due_date}
                      onChange={(e) => setPayableForm({...payableForm, due_date: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      required
                    />
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Valor (R$) *"
                      value={payableForm.amount}
                      onChange={(e) => setPayableForm({...payableForm, amount: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      required
                    />
                  </div>
                  <select 
                    value={payableForm.consultant_id}
                    onChange={(e) => setPayableForm({...payableForm, consultant_id: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value="">Selecione o Consultor (opcional)</option>
                    {consultants.filter(c => c.status === 'active').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <select 
                    value={payableForm.category}
                    onChange={(e) => setPayableForm({...payableForm, category: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value="travel">Deslocamento</option>
                    <option value="tools">Ferramentas</option>
                    <option value="commission">Comissão</option>
                    <option value="tax">Imposto</option>
                    <option value="supplier">Fornecedor</option>
                    <option value="consultant_fee">Taxa Consultor</option>
                    <option value="other">Outro</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-md text-sm hover:bg-[#2d4a6f]">
                      Adicionar
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowPayableForm(false)}
                      className="px-4 py-2 border border-slate-300 rounded-md text-sm hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {filteredPayables.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma conta a pagar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPayables.map((pay) => {
                    const isOverdue = pay.status === 'open' && isPast(parseISO(pay.due_date));
                    const payConsultant = consultants.find(c => c.id === pay.consultant_id);
                    return (
                      <div key={pay.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900">{pay.description}</p>
                            {payConsultant && (
                              <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">
                                {payConsultant.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(parseISO(pay.due_date), 'dd/MM/yyyy')}
                            </span>
                            <span>{pay.category}</span>
                            {pay.status === 'paid' && pay.paid_at && (
                              <span className="text-emerald-600">
                                Pago em {format(parseISO(pay.paid_at), 'dd/MM/yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-900">
                            R$ {pay.amount?.toLocaleString('pt-BR')}
                          </span>
                          {pay.status === 'paid' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">Pago</Badge>
                          ) : isOverdue ? (
                            <Badge className="bg-rose-100 text-rose-700 border-0">Vencido</Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => updatePayableStatusMutation.mutate({ id: pay.id, status: 'paid' })}
                              className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                            >
                              Dar Baixa
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}