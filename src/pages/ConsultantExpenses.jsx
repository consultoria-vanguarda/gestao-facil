import React, { useState } from 'react';
import { api, formatEntitySaveError } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, MoreHorizontal, Pencil, Trash2, Calendar } from 'lucide-react';
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
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ExpenseForm from '../components/forms/ExpenseForm';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIES = {
  travel: "Deslocamento",
  materials: "Materiais",
  tools: "Ferramentas",
  administrative: "Administrativo",
  meals: "Refeições",
  software: "Software",
  other: "Outros"
};

export default function ConsultantExpenses() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['myExpenses', user?.consultant_id],
    queryFn: () => api.entities.Expense.filter({ consultant_id: user.consultant_id }, '-date'),
    enabled: !!user?.consultant_id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['myProjects', user?.consultant_id],
    queryFn: () => api.entities.Project.filter({ consultant_id: user.consultant_id }),
    enabled: !!user?.consultant_id,
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Expense.create({
      ...data,
      consultant_id: user.consultant_id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myExpenses'] });
      setFormOpen(false);
      toast({ title: 'Despesa registrada', description: 'O lançamento foi salvo com sucesso.' });
    },
    onError: (error) => {
      console.error('Erro ao criar despesa:', error);
      toast({
        variant: 'destructive',
        title: 'Não foi possível registrar a despesa',
        description: formatEntitySaveError(error),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myExpenses'] });
      setFormOpen(false);
      setEditingExpense(null);
      toast({ title: 'Despesa atualizada', description: 'As alterações foram salvas.' });
    },
    onError: (error) => {
      console.error('Erro ao atualizar despesa:', error);
      toast({
        variant: 'destructive',
        title: 'Não foi possível salvar a despesa',
        description: formatEntitySaveError(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myExpenses'] });
      setDeleteConfirm(null);
    },
  });

  const handleSave = (data) => {
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredExpenses = expenses.filter(e => {
    return statusFilter === 'all' || e.status === statusFilter;
  });

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingAmount = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.amount || 0), 0);
  const approvedAmount = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas Despesas"
        subtitle="Registre e acompanhe suas despesas"
        action={() => setFormOpen(true)}
        actionLabel="Nova Despesa"
        actionIcon={Receipt}
      />

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="reimbursed">Reembolsado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-bold text-slate-900">R$ {totalExpenses.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Pendentes</p>
            <p className="text-2xl font-bold text-amber-600">R$ {pendingAmount.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Aprovadas</p>
            <p className="text-2xl font-bold text-emerald-600">R$ {approvedAmount.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
      </div>

      {filteredExpenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma despesa encontrada"
          description="Registre suas despesas de projetos"
          action={() => setFormOpen(true)}
          actionLabel="Registrar Despesa"
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
                    <TableHead>Categoria</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => {
                    const project = projects.find(p => p.id === expense.project_id);
                    
                    return (
                      <TableRow key={expense.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {expense.date ? format(new Date(expense.date), 'dd/MM/yyyy') : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {CATEGORIES[expense.category] || expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{project?.name || 'Geral'}</TableCell>
                        <TableCell className="font-medium">
                          R$ {expense.amount?.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={expense.status} />
                        </TableCell>
                        <TableCell>
                          <span className="text-slate-500 text-sm line-clamp-1">
                            {expense.description || '-'}
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
                              {expense.status === 'pending' && (
                                <DropdownMenuItem onClick={() => {
                                  setEditingExpense(expense);
                                  setFormOpen(true);
                                }}>
                                  <Pencil className="w-4 h-4 mr-2" /> Editar
                                </DropdownMenuItem>
                              )}
                              {expense.receipt_url && (
                                <DropdownMenuItem asChild>
                                  <a href={expense.receipt_url} target="_blank" rel="noreferrer">
                                    Ver Comprovante
                                  </a>
                                </DropdownMenuItem>
                              )}
                              {expense.status === 'pending' && (
                                <DropdownMenuItem 
                                  onClick={() => setDeleteConfirm(expense)}
                                  className="text-rose-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              )}
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

      <ExpenseForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingExpense(null);
        }}
        expense={editingExpense}
        onSave={handleSave}
        loading={createMutation.isPending || updateMutation.isPending}
        projects={projects}
        consultants={consultants}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa?
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