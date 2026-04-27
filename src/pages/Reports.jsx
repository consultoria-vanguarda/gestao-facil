import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, Download, TrendingUp, Clock, DollarSign, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { format } from 'date-fns';
import { CHART_COLORS } from '../components/utils/constants';
import { calculateFinancialMetrics, calculateTotalHours, calculateProjectProfitability } from '../components/utils/financialCalculations';

export default function Reports() {
  const [selectedProject, setSelectedProject] = useState('all');
  
  console.log('Reports page loaded');
  
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.entities.Task.list(),
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => api.entities.TimeEntry.list(),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.entities.Expense.list(),
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list(),
  });

  // Filtrar dados por projeto
  const filteredTasks = selectedProject === 'all' 
    ? tasks 
    : tasks.filter(t => t.project_id === selectedProject);
  
  const filteredTimeEntries = selectedProject === 'all'
    ? timeEntries
    : timeEntries.filter(t => t.project_id === selectedProject);

  const filteredExpenses = selectedProject === 'all'
    ? expenses
    : expenses.filter(e => e.project_id === selectedProject);

  const filteredProjects = selectedProject === 'all'
    ? projects
    : projects.filter(p => p.id === selectedProject);

  // Métricas gerais
  const metrics = calculateFinancialMetrics(filteredProjects, filteredTimeEntries, filteredExpenses);
  const { revenue: totalRevenue, labor: totalLabor, expenses: totalExpenses, hours: totalHours, profit: totalProfit } = metrics;

  // Horas estimadas vs reais
  const totalEstimatedHours = filteredTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
  const totalActualHours = filteredTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);

  // Tarefas por status
  const tasksByStatus = [
    { name: 'A Fazer', value: filteredTasks.filter(t => t.status === 'todo').length },
    { name: 'Em Andamento', value: filteredTasks.filter(t => t.status === 'in_progress').length },
    { name: 'Revisão', value: filteredTasks.filter(t => t.status === 'review').length },
    { name: 'Concluído', value: filteredTasks.filter(t => t.status === 'completed').length },
  ].filter(item => item.value > 0);

  // Desempenho por consultor
  const consultantPerformance = consultants.map(consultant => {
    const consultantTasks = filteredTasks.filter(t => t.assigned_to === consultant.id);
    const completedTasks = consultantTasks.filter(t => t.status === 'completed').length;
    const consultantHours = filteredTimeEntries.filter(t => t.consultant_id === consultant.id)
      .reduce((sum, t) => sum + (t.hours || 0), 0);
    
    return {
      name: consultant.name,
      tasks: consultantTasks.length,
      completed: completedTasks,
      hours: consultantHours
    };
  }).filter(c => c.tasks > 0 || c.hours > 0);

  // Comparação de horas
  const hoursComparison = [
    { name: 'Estimadas', hours: totalEstimatedHours },
    { name: 'Reais', hours: totalActualHours },
    { name: 'Lançadas', hours: totalHours }
  ];

  // Financeiro por projeto
  const projectFinancials = filteredProjects.map(project => {
    const profitability = calculateProjectProfitability(project, timeEntries, expenses);
    return {
      name: profitability.name,
      revenue: profitability.revenue,
      costs: profitability.labor + profitability.expenses,
      profit: profitability.profit
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Relatórios"
        subtitle="Análise completa de desempenho e financeiro"
      />

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filtrar por projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Projetos</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Receita Total"
          value={`R$ ${totalRevenue.toLocaleString('pt-BR')}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Horas Trabalhadas"
          value={`${totalHours.toFixed(1)}h`}
          subtitle={`${totalEstimatedHours.toFixed(1)}h estimadas`}
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="Lucro Total"
          value={`R$ ${totalProfit.toLocaleString('pt-BR')}`}
          subtitle={`${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}% margem`}
          icon={TrendingUp}
          color={totalProfit >= 0 ? "green" : "rose"}
        />
        <StatCard
          title="Tarefas Concluídas"
          value={`${filteredTasks.filter(t => t.status === 'completed').length}/${filteredTasks.length}`}
          subtitle={`${filteredTasks.length > 0 ? ((filteredTasks.filter(t => t.status === 'completed').length / filteredTasks.length) * 100).toFixed(0) : 0}% completo`}
          icon={CheckCircle2}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de tarefas por status */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Tarefas por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {tasksByStatus.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={tasksByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {tasksByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comparação de horas */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Comparação de Horas</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={hoursComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#1e3a5f" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Desempenho por consultor */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Desempenho por Consultor</CardTitle>
          </CardHeader>
          <CardContent>
            {consultantPerformance.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={consultantPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tasks" fill="#3b82f6" name="Total Tarefas" />
                    <Bar dataKey="completed" fill="#10b981" name="Concluídas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financeiro por projeto */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Análise Financeira por Projeto</CardTitle>
          </CardHeader>
          <CardContent>
            {projectFinancials.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={projectFinancials}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" name="Receita" />
                    <Bar dataKey="costs" fill="#ef4444" name="Custos" />
                    <Bar dataKey="profit" fill="#1e3a5f" name="Lucro" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela resumo */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Resumo Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-500">Horas Estimadas</p>
                <p className="text-xl font-semibold text-slate-900">{totalEstimatedHours.toFixed(1)}h</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Horas Reais</p>
                <p className="text-xl font-semibold text-slate-900">{totalActualHours.toFixed(1)}h</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Horas Lançadas</p>
                <p className="text-xl font-semibold text-slate-900">{totalHours.toFixed(1)}h</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Variação</p>
                <p className={`text-xl font-semibold ${totalActualHours <= totalEstimatedHours ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totalEstimatedHours > 0 ? ((totalActualHours - totalEstimatedHours) / totalEstimatedHours * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-500">Receita</p>
                <p className="text-xl font-semibold text-emerald-600">R$ {totalRevenue.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Mão de Obra</p>
                <p className="text-xl font-semibold text-slate-900">R$ {totalLabor.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Despesas</p>
                <p className="text-xl font-semibold text-slate-900">R$ {totalExpenses.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Lucro</p>
                <p className={`text-xl font-semibold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  R$ {totalProfit.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}