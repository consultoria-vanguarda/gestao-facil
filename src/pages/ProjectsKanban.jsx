import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import KanbanBoard from '../components/kanban/KanbanBoard';

export default function ProjectsKanban() {
  const queryClient = useQueryClient();
  const [selectedConsultant, setSelectedConsultant] = useState('all');

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list(),
    staleTime: 30000,
  });

  const { data: consultants = [], isLoading: consultantsLoading } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list(),
    staleTime: 30000,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.entities.Client.list(),
    staleTime: 30000,
  });

  const { data: timeEntries = [], isLoading: timeEntriesLoading } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => api.entities.TimeEntry.list(),
    staleTime: 30000,
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Project.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleStatusChange = (projectId, newStatus) => {
    updateProjectMutation.mutate({ 
      id: projectId, 
      data: { status: newStatus } 
    });
  };

  const isLoading = projectsLoading || consultantsLoading || clientsLoading || timeEntriesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  const filteredProjects = selectedConsultant === 'all' 
    ? projects 
    : projects.filter(p => p.consultant_id === selectedConsultant);

  const selectedConsultantData = consultants.find(c => c.id === selectedConsultant);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Projetos - Visão Kanban</h1>
        <p className="text-slate-600 mt-1">Gerencie seus projetos e visualize a disponibilidade dos consultores</p>
      </div>

      <div className="mb-6">
        <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Selecione um consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os consultores</SelectItem>
            {consultants.filter(c => c.status === 'active').map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedConsultantData && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">{selectedConsultantData.name}</h3>
            <p className="text-sm text-slate-600">{selectedConsultantData.specialty} • {filteredProjects.filter(p => p.status === 'in_progress').length} projeto(s) em andamento</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-blue-600 font-medium">
              {filteredProjects.filter(p => !['completed','cancelled'].includes(p.status)).length} projeto(s) ativo(s)
            </span>
          </div>
        </div>
      )}

      <KanbanBoard 
        projects={filteredProjects}
        consultants={consultants}
        clients={clients}
        timeEntries={timeEntries}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}