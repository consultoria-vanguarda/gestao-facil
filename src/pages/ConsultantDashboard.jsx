import React from 'react';
import { api } from '@/api/appApi';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  FolderKanban, 
  Clock, 
  CheckCircle2, 
  DollarSign,
  ArrowRight,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { motion } from 'framer-motion';
import { format, isThisWeek, isToday } from 'date-fns';

export default function ConsultantDashboard() {
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

  const { data: projects = [] } = useQuery({
    queryKey: ['myProjects', user?.consultant_id],
    queryFn: () => api.entities.Project.filter({ consultant_id: user.consultant_id }),
    enabled: !!user?.consultant_id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['myTasks', user?.consultant_id],
    queryFn: () => api.entities.Task.filter({ assigned_to: user.consultant_id }),
    enabled: !!user?.consultant_id,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['myTimeEntries', user?.consultant_id],
    queryFn: () => api.entities.TimeEntry.filter({ consultant_id: user.consultant_id }, '-date'),
    enabled: !!user?.consultant_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.entities.Client.list(),
  });

  const activeProjects = projects.filter(p => p.status === 'in_progress');
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const thisMonthEntries = timeEntries.filter(t => new Date(t.date).getMonth() === new Date().getMonth());
  const totalHoursThisMonth = thisMonthEntries.reduce((sum, t) => sum + (t.hours || 0), 0);
  const earningsThisMonth = thisMonthEntries.reduce((sum, t) => sum + ((t.hours || 0) * (t.hourly_rate || 0)), 0);

  const upcomingTasks = tasks
    .filter(t => t.due_date && t.status !== 'completed')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          Olá, {consultant?.name?.split(' ')[0] || 'Consultor'}!
        </h1>
        <p className="text-slate-500 mt-1">Aqui está o resumo das suas atividades</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Projetos Ativos"
          value={activeProjects.length}
          subtitle={`${projects.length} total`}
          icon={FolderKanban}
          color="blue"
        />
        <StatCard
          title="Tarefas Pendentes"
          value={pendingTasks.length}
          subtitle={`${tasks.filter(t => t.status === 'completed').length} concluídas`}
          icon={CheckCircle2}
          color="amber"
        />
        <StatCard
          title="Horas (Este Mês)"
          value={`${totalHoursThisMonth.toFixed(1)}h`}
          icon={Clock}
          color="purple"
        />
        <StatCard
          title="Faturamento (Mês)"
          value={`R$ ${earningsThisMonth.toLocaleString('pt-BR')}`}
          subtitle={`${thisMonthEntries.length} lançamentos`}
          icon={DollarSign}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Projects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Meus Projetos</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to={createPageUrl('ConsultantProjects')}>
                  Ver todos <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {activeProjects.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum projeto ativo</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeProjects.slice(0, 4).map((project) => {
                    const client = clients.find(c => c.id === project.client_id);
                    return (
                      <div key={project.id} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-slate-900">{project.name}</p>
                            <p className="text-sm text-slate-500">{client?.company_name}</p>
                          </div>
                          <StatusBadge status={project.status} />
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={project.progress || 0} className="flex-1 h-2" />
                          <span className="text-sm text-slate-600">{project.progress || 0}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Próximas Tarefas</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to={createPageUrl('ConsultantProjects')}>
                  Ver todas <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {upcomingTasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma tarefa pendente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingTasks.map((task) => {
                    const project = projects.find(p => p.id === task.project_id);
                    const isOverdue = new Date(task.due_date) < new Date();
                    const isDueToday = isToday(new Date(task.due_date));
                    const isDueThisWeek = isThisWeek(new Date(task.due_date));
                    
                    return (
                      <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className={`w-3 h-3 rounded-full ${
                          isOverdue ? 'bg-rose-500' :
                          isDueToday ? 'bg-amber-500' :
                          isDueThisWeek ? 'bg-blue-500' :
                          'bg-slate-300'
                        }`} />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-slate-900">{task.title}</p>
                          <p className="text-xs text-slate-500">{project?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-medium ${
                            isOverdue ? 'text-rose-600' :
                            isDueToday ? 'text-amber-600' :
                            'text-slate-500'
                          }`}>
                            {isOverdue ? 'Atrasada' :
                             isDueToday ? 'Hoje' :
                             format(new Date(task.due_date), 'dd/MM')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Time Entries */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Últimos Lançamentos</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={createPageUrl('ConsultantTimeEntries')}>
                Ver todos <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {timeEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum lançamento registrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {timeEntries.slice(0, 5).map((entry) => {
                  const project = projects.find(p => p.id === entry.project_id);
                  return (
                    <div key={entry.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="font-medium text-sm text-slate-900">{project?.name}</p>
                          <p className="text-xs text-slate-500">
                            {entry.date ? format(new Date(entry.date), 'dd/MM/yyyy') : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-900">{entry.hours}h</p>
                        <p className="text-xs text-slate-500">
                          R$ {((entry.hours || 0) * (entry.hourly_rate || 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}