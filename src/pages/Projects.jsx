import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { FolderKanban, Search, Calendar, DollarSign, ChevronDown, X } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ProjectForm from '../components/forms/ProjectForm';
import PublicPoliciesForm from '../components/forms/PublicPoliciesForm';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { SERVICE_AREAS, getSubareas } from '../components/utils/serviceAreas';

export default function Projects() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [consultantFilter, setConsultantFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [subareaFilter, setSubareaFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list('-created_date'),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.entities.Client.list(),
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list(),
  });

  const { data: serviceModels = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.entities.ServiceModel.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setFormOpen(false);
      setEditingProject(null);
    },
    onError: (error) => {
      console.error('Erro ao criar projeto:', error);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Project.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setFormOpen(false);
      setEditingProject(null);
    },
    onError: (error) => {
      console.error('Erro ao atualizar projeto:', error);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Project.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      console.error('Erro ao deletar projeto:', error);
    }
  });

  const handleSave = (data) => {
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormOpen(true);
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesType = typeFilter === 'all' || p.project_type === typeFilter;
    const matchesConsultant = consultantFilter === 'all' || p.consultant_id === consultantFilter;
    const matchesArea = areaFilter === 'all' || p.area === areaFilter || (areaFilter === 'custom' && p.custom_area);
    const matchesSubarea = subareaFilter === 'all' || p.subarea === subareaFilter || p.custom_subarea === subareaFilter;
    return matchesSearch && matchesStatus && matchesType && matchesConsultant && matchesArea && matchesSubarea;
  });

  const subareas = areaFilter !== 'all' && areaFilter !== 'custom'
    ? getSubareas(areaFilter)
    : [];

  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || consultantFilter !== 'all' || areaFilter !== 'all' || subareaFilter !== 'all';

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setConsultantFilter('all');
    setAreaFilter('all');
    setSubareaFilter('all');
    setSearch('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Atendimentos</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie todos os atendimentos de consultoria</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setFormOpen(true)} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            Novo Atendimento
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar atendimentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 gap-1 shrink-0">
              <X className="w-4 h-4" /> Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-md bg-white text-sm"
          >
            <option value="all">Todos os status</option>
            <option value="planning">Planejamento</option>
            <option value="in_progress">Em Execução</option>
            <option value="completed">Concluído</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-md bg-white text-sm"
          >
            <option value="all">Todos os tipos</option>
            <option value="consulting">Consultoria</option>
            <option value="diagnostic">Diagnóstico</option>
            <option value="instructional">Instrutoria</option>
            <option value="lecture">Palestra</option>
            <option value="public_policies">Políticas Públicas</option>
            <option value="other">Outro</option>
          </select>
          <select
            value={consultantFilter}
            onChange={(e) => setConsultantFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-md bg-white text-sm"
          >
            <option value="all">Todos os consultores</option>
            {consultants.filter(c => c.status === 'active').map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={areaFilter}
            onChange={(e) => { setAreaFilter(e.target.value); setSubareaFilter('all'); }}
            className="px-3 py-2 border border-input rounded-md bg-white text-sm"
          >
            <option value="all">Todas as áreas</option>
            {Object.entries(SERVICE_AREAS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
            <option value="custom">Área personalizada</option>
          </select>
          {subareas.length > 0 && (
            <select
              value={subareaFilter}
              onChange={(e) => setSubareaFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-white text-sm"
            >
              <option value="all">Todas as subáreas</option>
              {subareas.map((s, i) => (
                <option key={i} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
        <p className="text-sm text-slate-500">{filteredProjects.length} atendimento(s) encontrado(s)</p>
      </div>

      {filteredProjects.length === 0 && !isLoading ? (
        <EmptyState
          icon={FolderKanban}
          title="Nenhum atendimento encontrado"
          description={search || statusFilter !== 'all' 
            ? "Tente ajustar os filtros de busca" 
            : "Crie seu primeiro atendimento para começar"}
          action={!search && statusFilter === 'all' ? () => setFormOpen(true) : undefined}
          actionLabel="Criar Atendimento"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProjects.map((project, index) => {
            const client = clients.find(c => c.id === project.client_id);
            const consultant = consultants.find(c => c.id === project.consultant_id);
            
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{project.name}</h3>
                          <StatusBadge status={project.status} />
                        </div>
                        <p className="text-sm text-slate-500">
                          {project.project_type === 'public_policies'
                            ? (project.name || 'Políticas Públicas')
                            : (client?.company_name || 'Cliente não definido')}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
                          Ver detalhes
                        </Link>
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {project.start_date ? format(parseISO(project.start_date), 'dd/MM/yyyy') : '-'}
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        R$ {project.contracted_value?.toLocaleString('pt-BR')}
                      </div>
                    </div>

                    {(project.project_type || project.area) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {project.project_type && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1e3a5f]/10 text-[#1e3a5f] text-xs font-medium">
                            {{ diagnostic: 'Diagnóstico', consulting: 'Consultoria', instructional: 'Instrutoria', lecture: 'Palestra', public_policies: 'Políticas Públicas', other: 'Outro' }[project.project_type] || project.project_type}
                          </span>
                        )}
                        {project.area && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium truncate max-w-[200px]" title={SERVICE_AREAS[project.area]?.label || project.area}>
                            {SERVICE_AREAS[project.area]?.label || project.area}
                          </span>
                        )}
                        {project.subarea && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs truncate max-w-[200px]" title={project.subarea}>
                            {project.subarea}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">Progresso</span>
                        <span className="font-medium">{project.progress || 0}%</span>
                      </div>
                      <Progress value={project.progress || 0} className="h-2" />
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-medium">
                          {consultant?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                        </div>
                        <span className="text-sm text-slate-600">{consultant?.name || 'Sem consultor'}</span>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
                          Ver mais
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <ProjectForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingProject(null);
        }}
        project={editingProject}
        onSave={handleSave}
        loading={createMutation.isPending || updateMutation.isPending}
        clients={clients}
        consultants={consultants}
        serviceModels={serviceModels}
      />

    </div>
  );
}