import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle2,
  Upload,
  FileText,
  Trash2,
  Pencil,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import StatusBadge from '../components/ui/StatusBadge';
import TaskForm from '../components/forms/TaskForm';
import TimeEntryForm from '../components/forms/TimeEntryForm';
import ScheduleTab from '../components/project/ScheduleTab';
import FinancialTab from '../components/project/FinancialTab';
import DeliverablesTab from '../components/project/DeliverablesTab';
import { downloadDiagnosticReport } from '../components/project/DiagnosticReport';
import { downloadConsultingProposal } from '../components/project/ConsultingProposal';
import ProjectForm from '../components/forms/ProjectForm';
import ServiceReportForm from '../components/project/ServiceReportForm';
import { downloadServiceReport } from '../components/project/ServiceReportPDF';
import { Download } from 'lucide-react';

import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ProjectDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [timeEntryFormOpen, setTimeEntryFormOpen] = useState(false);
  const [editingTimeEntry, setEditingTimeEntry] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [serviceReportOpen, setServiceReportOpen] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await api.entities.Project.filter({ id: projectId });
      return projects[0];
    },
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: ['client', project?.client_id],
    queryFn: async () => {
      const clients = await api.entities.Client.filter({ id: project.client_id });
      return clients[0] || null;
    },
    enabled: !!project?.client_id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: consultant } = useQuery({
    queryKey: ['consultant', project?.consultant_id],
    queryFn: async () => {
      const consultants = await api.entities.Consultant.filter({ id: project.consultant_id });
      return consultants[0] || null;
    },
    enabled: !!project?.consultant_id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.entities.Client.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.entities.Task.filter({ project_id: projectId }),
    enabled: !!projectId,
    staleTime: 1 * 60 * 1000,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => api.entities.Document.filter({ project_id: projectId }),
    enabled: !!projectId,
    staleTime: 1 * 60 * 1000,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['timeEntries', projectId],
    queryFn: () => api.entities.TimeEntry.filter({ project_id: projectId }),
    enabled: !!projectId,
    staleTime: 1 * 60 * 1000,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', projectId],
    queryFn: () => api.entities.Expense.filter({ project_id: projectId }),
    enabled: !!projectId,
    staleTime: 1 * 60 * 1000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', projectId],
    queryFn: () => api.entities.Message.filter({ project_id: projectId }),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
  });

  const { data: serviceReports = [] } = useQuery({
    queryKey: ['serviceReport', projectId],
    queryFn: () => api.entities.ServiceReport.filter({ project_id: projectId }),
    enabled: !!projectId,
  });
  const serviceReport = serviceReports[0] || null;

  const saveServiceReportMutation = useMutation({
    mutationFn: (data) => serviceReport
      ? api.entities.ServiceReport.update(serviceReport.id, data)
      : api.entities.ServiceReport.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceReport', projectId] });
      setServiceReportOpen(false);
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: (progress) => api.entities.Project.update(projectId, { progress }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const [updateError, setUpdateError] = useState('');

  const updateProjectMutation = useMutation({
    mutationFn: (data) => api.entities.Project.update(projectId, data),
    onSuccess: () => {
      setUpdateError('');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setEditProjectOpen(false);
    },
    onError: (error) => {
      const errorMsg = error?.message || 'Erro ao salvar o atendimento';
      setUpdateError(errorMsg);
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => api.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setTaskFormOpen(false);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setTaskFormOpen(false);
      setEditingTask(null);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => api.entities.Task.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const createTimeEntryMutation = useMutation({
    mutationFn: (data) => api.entities.TimeEntry.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries', projectId] });
      setTimeEntryFormOpen(false);
    },
  });

  const updateTimeEntryMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.TimeEntry.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries', projectId] });
      setTimeEntryFormOpen(false);
      setEditingTimeEntry(null);
    },
  });

  const deleteTimeEntryMutation = useMutation({
    mutationFn: (id) => api.entities.TimeEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timeEntries', projectId] }),
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      return api.entities.Document.create({
        project_id: projectId,
        name: file.name,
        file_url,
        type: 'other',
        uploaded_by: user?.full_name,
        visible_to_client: true
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', projectId] }),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id) => api.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', projectId] }),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      // Delete related financial records in parallel
      const [receivables, payables, schedules] = await Promise.all([
        api.entities.ProjectReceivable.filter({ project_id: projectId }),
        api.entities.ProjectPayable.filter({ project_id: projectId }),
        api.entities.ProjectSchedule.filter({ project_id: projectId }),
      ]);
      await Promise.all([
        ...receivables.map(r => api.entities.ProjectReceivable.delete(r.id)),
        ...payables.map(p => api.entities.ProjectPayable.delete(p.id)),
        ...schedules.map(s => api.entities.ProjectSchedule.delete(s.id)),
      ]);
      await api.entities.Project.delete(projectId);
    },
    onSuccess: () => {
      window.location.href = createPageUrl('Projects');
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content) => api.entities.Message.create({
      project_id: projectId,
      content,
      sender_name: user?.full_name,
      sender_type: user?.user_type || 'admin'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', projectId] });
      setNewMessage('');
    },
  });

  const handleTaskSave = (data) => {
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data });
    } else {
      createTaskMutation.mutate(data);
    }
  };

  const handleTimeEntrySave = (data) => {
    if (editingTimeEntry) {
      updateTimeEntryMutation.mutate({ id: editingTimeEntry.id, data });
    } else {
      createTimeEntryMutation.mutate({ ...data, project_id: projectId });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadDocumentMutation.mutate(file);
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  // Financial calculations
  const totalHours = timeEntries.reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0);
  const laborCost = totalHours * (project.hourly_rate || 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalCosts = laborCost + totalExpenses;
  const profit = (project.contracted_value || 0) - totalCosts;

  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    review: tasks.filter(t => t.status === 'review'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={createPageUrl('Projects')}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-slate-500">
            {project.project_type === 'public_policies' ? project.name : client?.company_name} • {consultant?.name}
            {project.area && project.area !== 'custom' && ` • ${project.area === 'finances' ? 'Finanças' : project.area === 'marketing' ? 'Marketing' : project.area === 'planning' ? 'Planejamento' : project.area === 'associativism' ? 'Associativismo' : 'Políticas Públicas'}`}
            {project.area === 'custom' && project.custom_area && ` • ${project.custom_area}`}
            {(project.subarea || project.custom_subarea) && ` › ${project.subarea || project.custom_subarea}`}
          </p>
          {project.start_date && (
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-sm text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                Início: <strong className="text-slate-700">{format(parseISO(project.start_date), 'dd/MM/yyyy')}</strong>
              </span>
              {project.end_date && (
                <>
                  <span className="text-slate-300">→</span>
                  <span className="flex items-center gap-1 text-sm text-slate-500">
                    Término: <strong className="text-slate-700">{format(parseISO(project.end_date), 'dd/MM/yyyy')}</strong>
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {project.project_type !== 'public_policies' && (
            <>
              {project.project_type === 'diagnostic' && client && (
                <Button variant="outline" onClick={() => downloadDiagnosticReport(project, client).catch(console.error)}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Diagnóstico
                </Button>
              )}
              {project.project_type === 'consulting' && client && (
                <Button variant="outline" onClick={() => downloadConsultingProposal(project, client).catch(console.error)}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Proposta
                </Button>
              )}
              {project.project_type === 'consulting' && project.status === 'completed' && (
                serviceReport ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                        <FileText className="w-4 h-4 mr-2" />
                        Relatório da Prestação de Serviço
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setServiceReportOpen(true)}>
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadServiceReport(serviceReport, project, client, consultant).catch(console.error)}>
                        <Download className="w-4 h-4 mr-2" /> Download do Relatório
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setServiceReportOpen(true)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Relatório da Prestação de Serviço
                  </Button>
                )
              )}
              <Button variant="outline" onClick={() => setEditProjectOpen(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar Atendimento
              </Button>
              <Button variant="outline" asChild>
                <Link to={createPageUrl(`ProjectFinancial?id=${projectId}`)}>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Financeiro
                </Link>
              </Button>
            </>
          )}
          {project.project_type === 'public_policies' && project.proposal_file_url && (
            <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50" asChild>
              <a href={project.proposal_file_url} target="_blank" rel="noreferrer">
                <FileText className="w-4 h-4 mr-2" />
                Ver Proposta
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Valor Contratado</p>
                <p className="font-semibold text-slate-900">R$ {project.contracted_value?.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Horas Trabalhadas</p>
                <p className="font-semibold text-slate-900">{totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <CheckCircle2 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Tarefas Concluídas</p>
                <p className="font-semibold text-slate-900">
                  {tasksByStatus.completed.length}/{tasks.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${profit >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                <DollarSign className={`w-5 h-5 ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Lucro Estimado</p>
                <p className={`font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  R$ {profit.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-900">Progresso do Projeto</h3>
            <span className="text-2xl font-bold text-slate-900">{project.progress || 0}%</span>
          </div>
          <Slider
            value={[project.progress || 0]}
            max={100}
            step={5}
            onValueCommit={(value) => updateProgressMutation.mutate(value[0])}
            className="mb-2"
          />
        </CardContent>
      </Card>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Excluir Atendimento</h3>
            </div>
            <p className="text-slate-600 mb-2">
              Tem certeza que deseja excluir o atendimento <strong>{project.name}</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              Esta ação também excluirá todos os registros financeiros (contas a receber, contas a pagar e agenda) deste atendimento e não poderá ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 py-2 px-4 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteProjectMutation.mutate()}
                disabled={deleteProjectMutation.isPending}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteProjectMutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="agenda" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
          {project.project_type === 'consulting' && (
            <TabsTrigger value="deliverables">Entregáveis</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="agenda">
          <ScheduleTab
            projectId={projectId}
            consultantId={project?.consultant_id}
            consultants={consultants}
            project={project}
          />
        </TabsContent>

        <TabsContent value="financial">
          <FinancialTab
            project={project}
            projectId={projectId}
            expenses={expenses}
          />
        </TabsContent>

        <TabsContent value="deliverables">
          <DeliverablesTab
            project={project}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ['project', projectId] })}
          />
        </TabsContent>
      </Tabs>

      <TaskForm
        open={taskFormOpen}
        onClose={() => {
          setTaskFormOpen(false);
          setEditingTask(null);
        }}
        task={editingTask}
        onSave={handleTaskSave}
        loading={createTaskMutation.isPending || updateTaskMutation.isPending}
        consultants={consultants}
        projectId={projectId}
      />

      <TimeEntryForm
        open={timeEntryFormOpen}
        onClose={() => {
          setTimeEntryFormOpen(false);
          setEditingTimeEntry(null);
        }}
        entry={editingTimeEntry}
        onSave={handleTimeEntrySave}
        loading={createTimeEntryMutation.isPending || updateTimeEntryMutation.isPending}
        projects={project ? [project] : []}
        consultants={consultants}
        tasks={tasks}
      />

      {updateError && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg shadow-lg z-40 max-w-md">
          <p className="font-semibold">Erro ao salvar</p>
          <p className="text-sm">{updateError}</p>
          <button onClick={() => setUpdateError('')} className="text-xs text-red-600 underline mt-2">Fechar</button>
        </div>
      )}

      <ProjectForm
        open={editProjectOpen}
        onClose={() => {
          setEditProjectOpen(false);
          setUpdateError('');
        }}
        project={project}
        onSave={(data) => updateProjectMutation.mutate(data)}
        loading={updateProjectMutation.isPending}
        clients={clients}
        consultants={consultants}
        serviceModels={[]}
      />

      <ServiceReportForm
        open={serviceReportOpen}
        onClose={() => setServiceReportOpen(false)}
        report={serviceReport}
        project={project}
        client={client}
        onSave={(data) => saveServiceReportMutation.mutate(data)}
        loading={saveServiceReportMutation.isPending}
      />

    </div>
  );
}