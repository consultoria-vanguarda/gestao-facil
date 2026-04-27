import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, MoreHorizontal, Pencil, Trash2, Calendar } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import TimeEntryForm from '../components/forms/TimeEntryForm';
import { motion } from 'framer-motion';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { getDateRange } from '../components/utils/dateFilters';
import { calculateTotalHours } from '../components/utils/financialCalculations';

export default function ConsultantTimeEntries() {
  const [projectFilter, setProjectFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('month');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
  });

  const { data: consultant } = useQuery({
    queryKey: ['myConsultant', user?.consultant_id],
    queryFn: async () => {
      if (!user?.consultant_id) return null;
      const consultants = await api.entities.Consultant.filter({ id: user.consultant_id });
      return consultants[0];
    },
    enabled: !!user?.consultant_id,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['myTimeEntries', user?.consultant_id],
    queryFn: () => api.entities.TimeEntry.filter({ consultant_id: user.consultant_id }, '-date'),
    enabled: !!user?.consultant_id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['myProjects', user?.consultant_id],
    queryFn: () => api.entities.Project.filter({ consultant_id: user.consultant_id }),
    enabled: !!user?.consultant_id,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list(),
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.entities.Task.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.TimeEntry.create({
      ...data,
      consultant_id: user.consultant_id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
      setFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.TimeEntry.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
      setFormOpen(false);
      setEditingEntry(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.TimeEntry.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
      setDeleteConfirm(null);
    },
  });

  const handleSave = (data) => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const dateRange = getDateRange(periodFilter);

  const filteredEntries = timeEntries.filter(e => {
    const matchesProject = projectFilter === 'all' || e.project_id === projectFilter;
    if (!dateRange) return matchesProject;
    
    if (!e.date) return false;
    
    try {
      const date = parseISO(e.date);
      const matchesPeriod = isWithinInterval(date, dateRange);
      return matchesProject && matchesPeriod;
    } catch {
      return false;
    }
  });

  const totalHours = calculateTotalHours(filteredEntries);
  const totalValue = filteredEntries.reduce((sum, e) => sum + ((e.hours || 0) * (e.hourly_rate || 0)), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas Horas"
        subtitle="Registre e acompanhe suas horas trabalhadas"
        action={() => setFormOpen(true)}
        actionLabel="Lançar Horas"
        actionIcon={Clock}
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Total de Horas</p>
            <p className="text-2xl font-bold text-slate-900">{totalHours.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Valor Total</p>
            <p className="text-2xl font-bold text-slate-900">R$ {totalValue.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Lançamentos</p>
            <p className="text-2xl font-bold text-slate-900">{filteredEntries.length}</p>
          </CardContent>
        </Card>
      </div>

      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nenhum lançamento encontrado"
          description="Lance suas horas trabalhadas"
          action={() => setFormOpen(true)}
          actionLabel="Lançar Horas"
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Data</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const project = allProjects.find(p => p.id === entry.project_id);
                    const value = (entry.hours || 0) * (entry.hourly_rate || 0);
                    
                    return (
                      <TableRow key={entry.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {entry.date ? format(new Date(entry.date), 'dd/MM/yyyy') : '-'}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{project?.name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                            {entry.hours}h
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          R$ {value.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <span className="text-slate-500 text-sm line-clamp-1">
                            {entry.description || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setEditingEntry(entry);
                                setFormOpen(true);
                              }}>
                                <Pencil className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setDeleteConfirm(entry)}
                                className="text-rose-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </motion.div>
      )}

      <TimeEntryForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingEntry(null);
        }}
        entry={editingEntry}
        onSave={handleSave}
        loading={createMutation.isPending || updateMutation.isPending}
        projects={projects}
        consultants={consultant ? [consultant] : []}
        tasks={tasks}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}