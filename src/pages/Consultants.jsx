import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, MoreHorizontal, Pencil, Trash2, Mail, Phone, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ConsultantForm from '../components/forms/ConsultantForm';
import { motion } from 'framer-motion';

export default function Consultants() {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingConsultant, setEditingConsultant] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedAgenda, setExpandedAgenda] = useState({});
  
  const queryClient = useQueryClient();

  const { data: consultants = [], isLoading, error } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list('-created_date'),
    retry: 1,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list(),
    retry: 1,
  });

  // Buscar os schedules com folga (status cancelled, location FOLGA) para todos os projetos
  const { data: allSchedules = [] } = useQuery({
    queryKey: ['all-schedules-folga'],
    queryFn: () => api.entities.ProjectSchedule.filter({ status: 'cancelled' }),
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Consultant.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultants'] });
      setFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Consultant.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultants'] });
      setFormOpen(false);
      setEditingConsultant(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Consultant.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultants'] });
      setDeleteConfirm(null);
    },
  });

  const handleSave = (data) => {
    if (editingConsultant) {
      updateMutation.mutate({ id: editingConsultant.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (consultant) => {
    setEditingConsultant(consultant);
    setFormOpen(true);
  };

  const filteredConsultants = consultants.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.specialty?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getConsultantProjects = (consultantId) => {
    const planning = projects.filter(p => p.consultant_id === consultantId && p.status === 'planning');
    const inProgress = projects.filter(p => p.consultant_id === consultantId && p.status === 'in_progress');
    return { planning, inProgress };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Suporta yyyy-MM-dd e dd/MM/yyyy
    if (dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  // Extrai as datas de folga de um projeto
  const getDaysOff = (project) => {
    // Para Políticas Públicas: folgas são os dias entre fases sem atividade no documento
    // Essas folgas ficam gravadas como ProjectSchedule com status 'cancelled' e location 'FOLGA'
    // Retornamos apenas contagem para o card — detalhes aparecem via schedules

    if (!project.days_off || project.days_off === 0) return [];

    // Se há schedule_config com isDayOff, usar essas datas diretamente
    if (project.schedule_config && project.schedule_config.length > 0) {
      const offRows = project.schedule_config.filter(r => r.isDayOff && r.date);
      if (offRows.length > 0) {
        return offRows.map(r => formatDate(r.date));
      }
    }

    // Fallback: calcular as datas de folga com base na posição
    if (!project.start_date || !project.estimated_hours) return [`${project.days_off} dia(s)`];
    if (!project.max_hours_per_day && !project.hours_per_day) return [`${project.days_off} dia(s)`];

    const HOLIDAYS_LIST = ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25'];
    const isHol = (d) => HOLIDAYS_LIST.includes(d.toISOString().slice(5, 10));

    const maxHpd = parseFloat(project.max_hours_per_day ?? project.hours_per_day) || 8;
    const totalH = parseFloat(project.estimated_hours);
    const daysOffCount = parseInt(project.days_off) || 0;
    const workDaysNeeded = Math.ceil(totalH / maxHpd);
    const totalSlotsNeeded = workDaysNeeded + daysOffCount;
    const pos = project.days_off_position || 'end';

    const allSlots = [];
    let current = new Date(project.start_date + 'T12:00:00');
    let iter = 0;
    while (allSlots.length < totalSlotsNeeded && iter < 1000) {
      iter++;
      const dow = current.getDay();
      const skipSun = dow === 0 && project.consider_sundays !== 'yes';
      const skipHol = isHol(current) && project.consider_holidays !== 'yes';
      if (!skipSun && !skipHol) allSlots.push(new Date(current));
      current = new Date(current.getTime() + 86400000);
    }

    let offIndices = [];
    if (pos === 'start') offIndices = Array.from({ length: daysOffCount }, (_, i) => i);
    else if (pos === 'middle') {
      const mid = Math.floor(workDaysNeeded / 2);
      offIndices = Array.from({ length: daysOffCount }, (_, i) => mid + i);
    } else {
      offIndices = Array.from({ length: daysOffCount }, (_, i) => workDaysNeeded + i);
    }

    return offIndices
      .filter(i => i < allSlots.length)
      .map(i => allSlots[i].toLocaleDateString('pt-BR'));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
          <p className="text-slate-500 mt-2">Carregando consultores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="w-12 h-12 text-rose-500 mx-auto mb-2" />
          <h2 className="text-lg font-medium text-slate-900">Erro ao carregar dados</h2>
          <p className="text-slate-500 text-sm mt-1">Tente recarregar a página</p>
          <Button onClick={() => window.location.reload()} className="mt-4 bg-[#1e3a5f]">
            Recarregar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultores"
        subtitle="Gerencie sua equipe de consultores"
        action={() => setFormOpen(true)}
        actionLabel="Novo Consultor"
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar consultores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md pl-10"
          />
        </div>
      </div>

      {filteredConsultants.length === 0 && !isLoading ? (
        <EmptyState
          icon={Users}
          title="Nenhum consultor cadastrado"
          description="Cadastre seus consultores para começar a gerenciar projetos"
          action={() => setFormOpen(true)}
          actionLabel="Cadastrar Consultor"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConsultants.map((consultant, index) => {
            const { planning, inProgress } = getConsultantProjects(consultant.id);
            return (
              <motion.div
                key={consultant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="rounded-xl border bg-card text-card-foreground shadow border-0 shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#1e3a5f] text-white font-medium flex items-center justify-center text-sm">
                          {consultant.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{consultant.name}</h3>
                          <p className="text-sm text-slate-500">{consultant.specialty}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(consultant)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md font-medium transition-colors">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button onClick={() => setDeleteConfirm(consultant)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{consultant.email}</span>
                      </div>
                      {consultant.phone && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="w-4 h-4" />
                          <span>{consultant.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex gap-4 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">Planejamento</p>
                            <p className="font-semibold text-slate-900">{planning.length}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Em Execução</p>
                            <p className="font-semibold text-blue-700">{inProgress.length}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={consultant.status} />
                          {(planning.length > 0 || inProgress.length > 0) && (
                            <button
                              onClick={() => setExpandedAgenda(prev => ({ ...prev, [consultant.id]: !prev[consultant.id] }))}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500"
                            >
                              {expandedAgenda[consultant.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {expandedAgenda[consultant.id] && (
                        <div className="mt-2 space-y-2 text-xs">
                          {inProgress.length > 0 && (
                          <div>
                          <p className="font-semibold text-blue-700 mb-1 flex items-center gap-1">
                           <Calendar className="w-3 h-3" /> Em Execução
                          </p>
                          {inProgress.map(p => {
                           // Folgas de Políticas Públicas vêm dos schedules cancelados
                           const ppFolgas = p.project_type === 'public_policies'
                             ? allSchedules
                                 .filter(s => s.project_id === p.id && s.location === 'FOLGA')
                                 .map(s => formatDate(s.date))
                                 .slice(0, 5)
                             : getDaysOff(p);
                           return (
                             <div key={p.id} className="bg-blue-50 border border-blue-100 rounded p-2 mb-1">
                               <p className="font-medium text-slate-800 truncate">{p.name}</p>
                               <p className="text-slate-500">
                                 {formatDate(p.start_date)}{p.end_date ? ` → ${formatDate(p.end_date)}` : ''}
                               </p>
                               {ppFolgas.length > 0 && (
                                 <p className="text-amber-600 mt-0.5">
                                   🏖 Folga(s): {ppFolgas.join(', ')}{p.project_type === 'public_policies' && allSchedules.filter(s => s.project_id === p.id && s.location === 'FOLGA').length > 5 ? ` (+${allSchedules.filter(s => s.project_id === p.id && s.location === 'FOLGA').length - 5} mais)` : ''}
                                 </p>
                               )}
                             </div>
                           );
                          })}
                          </div>
                          )}
                          {planning.length > 0 && (
                          <div>
                          <p className="font-semibold text-slate-600 mb-1 flex items-center gap-1">
                           <Calendar className="w-3 h-3" /> Planejamento
                          </p>
                          {planning.map(p => {
                           const ppFolgas = p.project_type === 'public_policies'
                             ? allSchedules
                                 .filter(s => s.project_id === p.id && s.location === 'FOLGA')
                                 .map(s => formatDate(s.date))
                                 .slice(0, 5)
                             : getDaysOff(p);
                           return (
                             <div key={p.id} className="bg-slate-50 border border-slate-100 rounded p-2 mb-1">
                               <p className="font-medium text-slate-800 truncate">{p.name}</p>
                               <p className="text-slate-500">
                                 {formatDate(p.start_date)}{p.end_date ? ` → ${formatDate(p.end_date)}` : ''}
                               </p>
                               {ppFolgas.length > 0 && (
                                 <p className="text-amber-600 mt-0.5">
                                   🏖 Folga(s): {ppFolgas.join(', ')}{p.project_type === 'public_policies' && allSchedules.filter(s => s.project_id === p.id && s.location === 'FOLGA').length > 5 ? ` (+${allSchedules.filter(s => s.project_id === p.id && s.location === 'FOLGA').length - 5} mais)` : ''}
                                 </p>
                               )}
                             </div>
                           );
                          })}
                          </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <ConsultantForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingConsultant(null);
        }}
        consultant={editingConsultant}
        onSave={handleSave}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="font-semibold text-lg text-slate-900 mb-2">Confirmar exclusão</h3>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir o consultor "{deleteConfirm?.name}"? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button 
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}