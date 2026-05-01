import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/appApi';
import { APP_LOGO_URL } from '@/lib/branding';
import { loadImageAsDataUrl } from '@/lib/imageDataUrl';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, DollarSign, Clock, TrendingUp, TrendingDown, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const LOGO_URL = APP_LOGO_URL;
const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Mapa de situação do projeto → status da entidade Project
const PROJECT_STATUS_MAP = {
  planning: 'planning',
  in_progress: 'in_progress',
  completed: 'completed',
};

// Rótulos e destaque por situação
const SITUATION_CONFIG = {
  planning: {
    label: 'Planejamento',
    badge: 'Planejamento de Faturamento',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  in_progress: {
    label: 'Em Execução',
    badge: 'Previsão de Faturamento',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  completed: {
    label: 'Concluído',
    badge: null, // dinâmico conforme billing status
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
};

// Para projetos concluídos: quais status de billing exibir
const BILLING_STATUS_LABELS = {
  all: 'Todos',
  to_bill: 'A Faturar',
  billed: 'Faturado',
  received: 'Recebido',
};

export default function ReportsTab() {
  const [filterClient, setFilterClient] = useState('all');
  const [filterConsultant, setFilterConsultant] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [filterArea, setFilterArea] = useState('all');
  const [filterPeriodStart, setFilterPeriodStart] = useState('');
  const [filterPeriodEnd, setFilterPeriodEnd] = useState('');
  const [filterSituation, setFilterSituation] = useState('all'); // 'all' | 'planning' | 'in_progress' | 'completed'
  const [filterBillingStatus, setFilterBillingStatus] = useState('all'); // só ativo quando completed
  const [detailModal, setDetailModal] = useState(null);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.entities.Project.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => api.entities.Client.list() });
  const { data: consultants = [] } = useQuery({ queryKey: ['consultants'], queryFn: () => api.entities.Consultant.list() });
  const { data: billings = [] } = useQuery({ queryKey: ['billings'], queryFn: () => api.entities.BillingEntry.list() });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => api.entities.Expense.list() });
  const { data: schedules = [] } = useQuery({ queryKey: ['allSchedules'], queryFn: () => api.entities.ProjectSchedule.list() });

  const areas = useMemo(() => [...new Set(projects.map(p => p.area).filter(Boolean))], [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filterClient !== 'all' && p.client_id !== filterClient) return false;
      if (filterConsultant !== 'all' && p.consultant_id !== filterConsultant) return false;
      if (filterProject !== 'all' && p.id !== filterProject) return false;
      if (filterArea !== 'all' && p.area !== filterArea) return false;
      if (filterSituation !== 'all' && p.status !== PROJECT_STATUS_MAP[filterSituation]) return false;
      return true;
    });
  }, [projects, filterClient, filterConsultant, filterProject, filterArea, filterSituation]);

  const filteredProjectIds = useMemo(() => new Set(filteredProjects.map(p => p.id)), [filteredProjects]);

  // Determine which billing statuses to include based on situation filter
  const allowedBillingStatuses = useMemo(() => {
    if (filterSituation === 'planning') {
      // Planejamento: mostrar apenas "a faturar" (o que ainda está previsto)
      return new Set(['to_bill']);
    }
    if (filterSituation === 'in_progress') {
      // Em execução: previsão = to_bill + billed
      return new Set(['to_bill', 'billed']);
    }
    if (filterSituation === 'completed') {
      // Concluído: filtrar pelo sub-filtro de status
      if (filterBillingStatus === 'all') return new Set(['to_bill', 'billed', 'received']);
      return new Set([filterBillingStatus]);
    }
    // Todos: todos os status
    return new Set(['to_bill', 'billed', 'received']);
  }, [filterSituation, filterBillingStatus]);

  const filteredBillings = useMemo(() => {
    return billings.filter(b => {
      if (!filteredProjectIds.has(b.project_id)) return false;
      if (!allowedBillingStatuses.has(b.status)) return false;
      const date = b.billed_date || b.phase_date || '';
      if (filterPeriodStart && date < filterPeriodStart) return false;
      if (filterPeriodEnd && date > filterPeriodEnd) return false;
      return true;
    });
  }, [billings, filteredProjectIds, allowedBillingStatuses, filterPeriodStart, filterPeriodEnd]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (e.project_id && !filteredProjectIds.has(e.project_id)) return false;
      if (!e.project_id && filterProject !== 'all') return false;
      const date = e.due_date || '';
      if (filterPeriodStart && date < filterPeriodStart) return false;
      if (filterPeriodEnd && date > filterPeriodEnd) return false;
      return true;
    });
  }, [expenses, filteredProjectIds, filterPeriodStart, filterPeriodEnd, filterProject]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      if (!filteredProjectIds.has(s.project_id)) return false;
      if (s.status !== 'completed') return false;
      if (filterConsultant !== 'all' && s.consultant_id !== filterConsultant) return false;
      const date = s.date || '';
      if (filterPeriodStart && date < filterPeriodStart) return false;
      if (filterPeriodEnd && date > filterPeriodEnd) return false;
      return true;
    });
  }, [schedules, filteredProjectIds, filterConsultant, filterPeriodStart, filterPeriodEnd]);

  const totalReceita = filteredBillings.reduce((s, b) => s + (b.amount || 0), 0);
  const totalDespesa = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalHoras = filteredSchedules.reduce((s, sc) => s + (sc.hours || 0), 0);
  const totalLucro = totalReceita - totalDespesa;

  const consultorRanking = useMemo(() => {
    return consultants.map(c => {
      const projIds = filteredProjects.filter(p => p.consultant_id === c.id).map(p => p.id);
      const receita = filteredBillings.filter(b => projIds.includes(b.project_id)).reduce((s, b) => s + (b.amount || 0), 0);
      const horas = filteredSchedules.filter(s => s.consultant_id === c.id).reduce((s, sc) => s + (sc.hours || 0), 0);
      return { name: c.name, receita, horas };
    }).filter(c => c.receita > 0 || c.horas > 0).sort((a, b) => b.receita - a.receita);
  }, [consultants, filteredProjects, filteredBillings, filteredSchedules]);

  // Compute the highlight badge text
  const highlightBadge = useMemo(() => {
    if (filterSituation === 'all') return null;
    if (filterSituation === 'planning') return SITUATION_CONFIG.planning.badge;
    if (filterSituation === 'in_progress') return SITUATION_CONFIG.in_progress.badge;
    if (filterSituation === 'completed') {
      return BILLING_STATUS_LABELS[filterBillingStatus] || 'Todos';
    }
    return null;
  }, [filterSituation, filterBillingStatus]);

  const highlightColor = useMemo(() => {
    if (filterSituation === 'planning') return SITUATION_CONFIG.planning.badgeColor;
    if (filterSituation === 'in_progress') return SITUATION_CONFIG.in_progress.badgeColor;
    if (filterSituation === 'completed') return SITUATION_CONFIG.completed.badgeColor;
    return '';
  }, [filterSituation]);

  // Label para o card de Receita conforme situação
  const receitaCardTitle = useMemo(() => {
    if (filterSituation === 'planning') return 'Planejamento de Faturamento';
    if (filterSituation === 'in_progress') return 'Previsão de Faturamento';
    if (filterSituation === 'completed') return `Faturamento — ${BILLING_STATUS_LABELS[filterBillingStatus]}`;
    return 'Receita Total';
  }, [filterSituation, filterBillingStatus]);

  // PDF Export
  const handleExportPDF = async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    try {
      const img = await loadImageAsDataUrl(LOGO_URL);
      doc.addImage(img, 'PNG', 10, 8, 40, 14);
    } catch (_) {}

    doc.setFontSize(16); doc.setTextColor(30, 58, 95);
    doc.text('Relatório Gerencial', pageW / 2, 16, { align: 'center' });
    doc.setFontSize(9); doc.setTextColor(100);
    const periodo = filterPeriodStart || filterPeriodEnd ? `Período: ${filterPeriodStart || '—'} a ${filterPeriodEnd || '—'}` : 'Período: Todos';
    doc.text(periodo, pageW / 2, 22, { align: 'center' });
    if (highlightBadge) doc.text(`Situação: ${highlightBadge}`, pageW / 2, 27, { align: 'center' });
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageW / 2, 32, { align: 'center' });

    doc.setFontSize(12); doc.setTextColor(30, 58, 95);
    doc.text('Resumo Financeiro', 14, 40);
    doc.autoTable({
      startY: 44,
      head: [['Indicador', 'Valor']],
      body: [
        [receitaCardTitle, `R$ ${fmt(totalReceita)}`],
        ['Despesa Total', `R$ ${fmt(totalDespesa)}`],
        ['Lucro do Projeto', `R$ ${fmt(totalLucro)}`],
        ['Horas Trabalhadas', `${totalHoras.toFixed(1)}h`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95], textColor: 255 },
      styles: { fontSize: 10 },
    });

    if (consultorRanking.length > 0) {
      const y2 = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(12); doc.setTextColor(30, 58, 95);
      doc.text('Desempenho por Consultor', 14, y2);
      doc.autoTable({
        startY: y2 + 4,
        head: [['Consultor', 'Receita (R$)', 'Horas']],
        body: consultorRanking.map(c => [c.name, fmt(c.receita), `${c.horas.toFixed(1)}h`]),
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 95], textColor: 255 },
        styles: { fontSize: 10 },
      });
    }

    if (filteredBillings.length > 0) {
      const y3 = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(12); doc.setTextColor(30, 58, 95);
      doc.text('Receitas / Faturamento', 14, y3);
      doc.autoTable({
        startY: y3 + 4,
        head: [['Projeto', 'Descrição', 'Data', 'Status', 'Valor (R$)']],
        body: filteredBillings.map(b => {
          const proj = projects.find(p => p.id === b.project_id);
          return [proj?.name || '-', b.description || '-', b.billed_date || b.phase_date || '-', BILLING_STATUS_LABELS[b.status] || b.status, fmt(b.amount)];
        }),
        theme: 'striped',
        headStyles: { fillColor: [21, 128, 61], textColor: 255 },
        styles: { fontSize: 9 },
      });
    }

    if (filteredExpenses.length > 0) {
      const y4 = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(12); doc.setTextColor(30, 58, 95);
      doc.text('Despesas', 14, y4);
      doc.autoTable({
        startY: y4 + 4,
        head: [['Projeto', 'Descrição', 'Vencimento', 'Valor (R$)']],
        body: filteredExpenses.map(e => {
          const proj = projects.find(p => p.id === e.project_id);
          return [proj?.name || 'Geral', e.description || '-', e.due_date || '-', fmt(e.amount)];
        }),
        theme: 'striped',
        headStyles: { fillColor: [185, 28, 28], textColor: 255 },
        styles: { fontSize: 9 },
      });
    }

    doc.save('relatorio-gerencial.pdf');
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Cliente</label>
              <Select value={filterClient} onValueChange={v => { setFilterClient(v); setFilterProject('all'); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Projeto</label>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(filterClient === 'all' ? projects : projects.filter(p => p.client_id === filterClient))
                    .map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Consultor</label>
              <Select value={filterConsultant} onValueChange={setFilterConsultant}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {consultants.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Área</label>
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Período Início</label>
              <input type="date" value={filterPeriodStart} onChange={e => setFilterPeriodStart(e.target.value)}
                className="w-full h-8 px-2 border border-input rounded-md text-xs bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Período Fim</label>
              <input type="date" value={filterPeriodEnd} onChange={e => setFilterPeriodEnd(e.target.value)}
                className="w-full h-8 px-2 border border-input rounded-md text-xs bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Situação do Projeto</label>
              <Select value={filterSituation} onValueChange={v => { setFilterSituation(v); setFilterBillingStatus('all'); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="planning">Planejamento</SelectItem>
                  <SelectItem value="in_progress">Em Execução</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filterSituation === 'completed' && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Status do Faturamento</label>
                <Select value={filterBillingStatus} onValueChange={setFilterBillingStatus}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="to_bill">A Faturar</SelectItem>
                    <SelectItem value="billed">Faturado</SelectItem>
                    <SelectItem value="received">Recebido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Destaque de situação */}
          {highlightBadge && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold text-sm mb-3 ${highlightColor}`}>
              <span>📋</span>
              <span>{highlightBadge}</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={handleExportPDF} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] gap-2">
              <Download className="w-4 h-4" /> Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards informativos */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          title={receitaCardTitle}
          value={`R$ ${fmt(totalReceita)}`}
          icon={DollarSign}
          color="emerald"
          onClick={() => setDetailModal('receita')}
        />
        <SummaryCard
          title="Despesa Total"
          value={`R$ ${fmt(totalDespesa)}`}
          icon={TrendingDown}
          color="rose"
          onClick={() => setDetailModal('despesa')}
        />
        <SummaryCard
          title="Lucro do Projeto"
          value={`R$ ${fmt(totalLucro)}`}
          icon={TrendingUp}
          color={totalLucro >= 0 ? 'blue' : 'rose'}
          onClick={() => setDetailModal('lucro')}
        />
        <SummaryCard
          title="Horas Trabalhadas"
          value={`${totalHoras.toFixed(1)}h`}
          icon={Clock}
          color="purple"
          onClick={() => setDetailModal('horas')}
        />
        <SummaryCard
          title="Desempenho Consultores"
          value={`${consultorRanking.length} consultor(es)`}
          icon={Users}
          color="amber"
          onClick={() => setDetailModal('consultores')}
        />
      </div>

      {/* Gráfico */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Receita x Despesa por Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProjects.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={filteredProjects.slice(0, 15).map(p => {
                const rec = filteredBillings.filter(b => b.project_id === p.id).reduce((s, b) => s + (b.amount || 0), 0);
                const desp = filteredExpenses.filter(e => e.project_id === p.id).reduce((s, e) => s + (e.amount || 0), 0);
                return { name: (p.name || '').substring(0, 20), receita: rec, despesa: desp, lucro: rec - desp };
              })} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => `R$ ${fmt(v)}`} />
                <Legend />
                <Bar dataKey="receita" fill="#10b981" name="Receita" radius={[3,3,0,0]} />
                <Bar dataKey="despesa" fill="#ef4444" name="Despesa" radius={[3,3,0,0]} />
                <Bar dataKey="lucro" fill="#1e3a5f" name="Lucro" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Nenhum dado para os filtros selecionados</div>
          )}
        </CardContent>
      </Card>

      {/* Ranking */}
      {consultorRanking.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranking de Consultores por Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={consultorRanking} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => `R$ ${fmt(v)}`} />
                <Bar dataKey="receita" fill="#1e3a5f" name="Receita" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <DetailModal
        open={detailModal === 'receita'}
        onClose={() => setDetailModal(null)}
        title={receitaCardTitle}
        columns={['Projeto', 'Descrição', 'Data', 'Status', 'Valor']}
        rows={filteredBillings.map(b => {
          const proj = projects.find(p => p.id === b.project_id);
          return [proj?.name || '-', b.description || '-', b.billed_date || b.phase_date || '-', BILLING_STATUS_LABELS[b.status] || b.status, `R$ ${fmt(b.amount)}`];
        })}
        total={`Total: R$ ${fmt(totalReceita)}`}
      />
      <DetailModal
        open={detailModal === 'despesa'}
        onClose={() => setDetailModal(null)}
        title="Detalhamento de Despesas"
        columns={['Projeto', 'Descrição', 'Vencimento', 'Status', 'Valor']}
        rows={filteredExpenses.map(e => {
          const proj = projects.find(p => p.id === e.project_id);
          return [proj?.name || 'Geral', e.description || '-', e.due_date || '-', e.status, `R$ ${fmt(e.amount)}`];
        })}
        total={`Total: R$ ${fmt(totalDespesa)}`}
      />
      <DetailModal
        open={detailModal === 'lucro'}
        onClose={() => setDetailModal(null)}
        title="Lucro por Projeto"
        columns={['Projeto', 'Receita', 'Despesa', 'Lucro']}
        rows={filteredProjects.map(p => {
          const rec = filteredBillings.filter(b => b.project_id === p.id).reduce((s, b) => s + (b.amount || 0), 0);
          const desp = filteredExpenses.filter(e => e.project_id === p.id).reduce((s, e) => s + (e.amount || 0), 0);
          return [p.name || '-', `R$ ${fmt(rec)}`, `R$ ${fmt(desp)}`, `R$ ${fmt(rec - desp)}`];
        })}
        total={`Lucro Total: R$ ${fmt(totalLucro)}`}
      />
      <DetailModal
        open={detailModal === 'horas'}
        onClose={() => setDetailModal(null)}
        title="Horas Trabalhadas por Fase"
        columns={['Projeto', 'Consultor', 'Data', 'Horas']}
        rows={filteredSchedules.map(s => {
          const proj = projects.find(p => p.id === s.project_id);
          const cons = consultants.find(c => c.id === s.consultant_id);
          return [proj?.name || '-', cons?.name || '-', s.date || '-', `${s.hours || 0}h`];
        })}
        total={`Total: ${totalHoras.toFixed(1)}h`}
      />
      <DetailModal
        open={detailModal === 'consultores'}
        onClose={() => setDetailModal(null)}
        title="Desempenho por Consultor"
        columns={['#', 'Consultor', 'Receita', 'Horas']}
        rows={consultorRanking.map((c, i) => [`${i + 1}º`, c.name, `R$ ${fmt(c.receita)}`, `${c.horas.toFixed(1)}h`])}
        total=""
      />
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color, onClick }) {
  const colorMap = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div onClick={onClick} className={`rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium leading-tight">{title}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs opacity-60 mt-1">Clique para detalhes</p>
    </div>
  );
}

function DetailModal({ open, onClose, title, columns, rows, total }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1">
          {rows.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Nenhum dado para exibir</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  {columns.map((c, i) => (
                    <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 border-b border-slate-100 text-slate-700">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {total && <div className="pt-3 border-t text-right font-bold text-slate-800 text-sm">{total}</div>}
      </DialogContent>
    </Dialog>
  );
}
