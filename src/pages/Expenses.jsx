import React, { useState } from 'react';
import { api, formatEntitySaveError } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react';
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
import { EXPENSE_CATEGORIES } from '../components/utils/constants';
import { useToast } from '@/components/ui/use-toast';

export default function Expenses() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.entities.Expense.list('-date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list(),
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Expense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setFormOpen(false);
      setEditingExpense(null);
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
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
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
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setDeleteConfirm(null);
    },
  });

  const handleSave = async (data) => {
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
      return;
    }
    if (Array.isArray(data)) {
      try {
        for (const entry of data) {
          await api.entities.Expense.create(entry);
        }
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        setFormOpen(false);
        setEditingExpense(null);
        toast({
          title: 'Despesas registradas',
          description: `${data.length} lançamentos recorrentes foram salvos.`,
        });
      } catch (error) {
        console.error('Erro ao criar despesas recorrentes:', error);
        toast({
          variant: 'destructive',
          title: 'Não foi possível registrar as despesas',
          description: formatEntitySaveError(error),
        });
      }
      return;
    }
    createMutation.mutate(data);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormOpen(true);
  };

  const handleApprove = (expense) => {
    updateMutation.mutate({ id: expense.id, data: { ...expense, status: 'approved' } });
  };

  const handleReject = (expense) => {
    updateMutation.mutate({ id: expense.id, data: { ...expense, status: 'rejected' } });
  };

  const filteredExpenses = expenses.filter(e => {
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchesProject = projectFilter === 'all' || e.project_id === projectFilter;
    return matchesCategory && matchesStatus && matchesProject;
  });

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingCount = expenses.filter(e => e.status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Despesas"
        subtitle="Controle de despesas e reembolsos"
        action={() => setFormOpen(true)}
        actionLabel="Nova Despesa"
        actionIcon={Receipt}
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="reimbursed">Reembolsado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Total de Despesas</p>
            <p className="text-2xl font-bold text-slate-900">R$ {totalExpenses.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Pendentes</p>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Aprovadas</p>
            <p className="text-2xl font-bold text-emerald-600">
              R$ {expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.amount || 0), 0).toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Lançamentos</p>
            <p className="text-2xl font-bold text-slate-900">{filteredExpenses.length}</p>
          </CardContent>
        </Card>
      </div>

      {filteredExpenses.length === 0 && !isLoading ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma despesa encontrada"
          description="Registre as despesas dos projetos"
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
                    <TableHead className="w-32">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => {
                    const project = projects.find(p => p.id === expense.project_id);
                    
                    return (
                      <TableRow key={expense.id} className="hover:bg-slate-50">
                        <TableCell>{expense.date || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{EXPENSE_CATEGORIES[expense.category] || expense.category}</Badge>
                        </TableCell>
                        <TableCell>{project?.name || 'Geral'}</TableCell>
                        <TableCell className="font-medium">
                          R$ {expense.amount?.toFixed(2)}
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
                          <div className="flex items-center gap-1">
                            {expense.status === 'pending' && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-emerald-600"
                                  onClick={() => handleApprove(expense)}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-rose-600"
                                  onClick={() => handleReject(expense)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(expense)}>
                                  <Pencil className="w-4 h-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                {expense.receipt_url && (
                                  <DropdownMenuItem asChild>
                                    <a href={expense.receipt_url} target="_blank" rel="noreferrer">
                                      Ver Comprovante
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  onClick={() => setDeleteConfirm(expense)}
                                  className="text-rose-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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

      {formOpen && (
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
      )}

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