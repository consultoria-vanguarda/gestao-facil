import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  FolderKanban, 
  Eye, 
  Calendar,
  DollarSign,
  Plus,
  CheckCircle2,
  MoreHorizontal,
  Pencil
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import TaskForm from '../components/forms/TaskForm';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

export default function ConsultantProjects() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['myProjects', user?.consultant_id],
    queryFn: () => api.entities.Project.filter({ consultant_id: user.consultant_id }, '-created_date'),
    enabled: !!user?.consultant_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.entities.Client.list(),
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['allTasks'],
    queryFn: () => api.entities.Task.list(),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => api.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTasks'] });
      setTaskFormOpen(false);
      setSelectedProjectId(null);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTasks'] });
      setTaskFormOpen(false);
      setEditingTask(null);
    },
  });

  const handleTaskSave = (data) => {
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data });
    } else {
      createTaskMutation.mutate(data);
    }
  };

  const filteredProjects = projects.filter(p => {
    return statusFilter === 'all' || p.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus Projetos"
        subtitle="Gerencie os projetos atribuídos a você"
      />

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="planning">Planejamento</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="on_hold">Pausado</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nenhum projeto encontrado"
          description="Você não possui projetos atribuídos no momento"
        />
      ) : (
        <div className="space-y-6">
          {filteredProjects.map((project, index) => {
            const client = clients.find(c => c.id === project.client_id);
            const projectTasks = tasks.filter(t => t.project_id === project.id);
            const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
            
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <CardTitle>{project.name}</CardTitle>
                          <StatusBadge status={project.status} />
                        </div>
                        <p className="text-slate-500 mt-1">{client?.company_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setTaskFormOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Tarefa
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
                            <Eye className="w-4 h-4 mr-1" />
                            Detalhes
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Início</p>
                          <p className="font-medium">
                            {project.start_date ? format(new Date(project.start_date), 'dd/MM/yyyy') : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Término</p>
                          <p className="font-medium">
                            {project.end_date ? format(new Date(project.end_date), 'dd/MM/yyyy') : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Valor</p>
                          <p className="font-medium">R$ {project.contracted_value?.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Tarefas</p>
                          <p className="font-medium">{completedTasks}/{projectTasks.length}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">Progresso</span>
                        <span className="font-medium">{project.progress || 0}%</span>
                      </div>
                      <Progress value={project.progress || 0} className="h-2" />
                    </div>

                    {projectTasks.length > 0 && (
                      <div className="border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-medium text-slate-900 mb-3">Tarefas Recentes</h4>
                        <div className="space-y-2">
                          {projectTasks.slice(0, 3).map((task) => (
                            <div key={task.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  task.status === 'completed' ? 'bg-emerald-500' :
                                  task.status === 'in_progress' ? 'bg-blue-500' :
                                  'bg-slate-300'
                                }`} />
                                <span className="text-sm">{task.title}</span>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreHorizontal className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setEditingTask(task);
                                    setSelectedProjectId(project.id);
                                    setTaskFormOpen(true);
                                  }}>
                                    <Pencil className="w-3 h-3 mr-2" /> Editar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <TaskForm
        open={taskFormOpen}
        onClose={() => {
          setTaskFormOpen(false);
          setSelectedProjectId(null);
          setEditingTask(null);
        }}
        task={editingTask}
        onSave={handleTaskSave}
        loading={createTaskMutation.isPending || updateTaskMutation.isPending}
        consultants={consultants}
        projectId={selectedProjectId}
      />
    </div>
  );
}