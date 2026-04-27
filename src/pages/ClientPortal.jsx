import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FolderKanban, 
  FileText, 
  MessageSquare, 
  Clock, 
  CheckCircle2,
  Send,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

export default function ClientPortal() {
  const [newMessage, setNewMessage] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['clientProjects'],
    queryFn: async () => {
      if (!user?.client_id) return [];
      return api.entities.Project.filter({ client_id: user.client_id });
    },
    enabled: !!user?.client_id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['clientTasks', selectedProject?.id],
    queryFn: () => api.entities.Task.filter({ project_id: selectedProject.id }),
    enabled: !!selectedProject?.id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['clientDocuments', selectedProject?.id],
    queryFn: () => api.entities.Document.filter({ project_id: selectedProject.id, visible_to_client: true }),
    enabled: !!selectedProject?.id,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['clientMessages', selectedProject?.id],
    queryFn: () => api.entities.Message.filter({ project_id: selectedProject.id }, 'created_date'),
    enabled: !!selectedProject?.id,
  });

  const { data: consultant } = useQuery({
    queryKey: ['consultant', selectedProject?.consultant_id],
    queryFn: async () => {
      const consultants = await api.entities.Consultant.filter({ id: selectedProject.consultant_id });
      return consultants[0];
    },
    enabled: !!selectedProject?.consultant_id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content) => api.entities.Message.create({
      project_id: selectedProject.id,
      content,
      sender_name: user?.full_name,
      sender_type: 'client'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientMessages', selectedProject?.id] });
      setNewMessage('');
    },
  });

  const activeProjects = projects.filter(p => p.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  if (!selectedProject && projects.length > 0) {
    setSelectedProject(projects[0]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Portal do Cliente</h1>
        <p className="text-slate-500 mt-1">Acompanhe seus projetos de consultoria</p>
      </div>

      {projects.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <FolderKanban className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum projeto ativo</h3>
            <p className="text-slate-500">Entre em contato para iniciar um novo projeto de consultoria</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Project Selector */}
          <div className="flex flex-wrap gap-2">
            {projects.map((project) => (
              <Button
                key={project.id}
                variant={selectedProject?.id === project.id ? "default" : "outline"}
                onClick={() => setSelectedProject(project)}
                className={selectedProject?.id === project.id ? "bg-[#1e3a5f]" : ""}
              >
                {project.name}
              </Button>
            ))}
          </div>

          {selectedProject && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Progresso"
                  value={`${selectedProject.progress || 0}%`}
                  icon={FolderKanban}
                  color="blue"
                />
                <StatCard
                  title="Tarefas Concluídas"
                  value={`${completedTasks}/${tasks.length}`}
                  icon={CheckCircle2}
                  color="green"
                />
                <StatCard
                  title="Documentos"
                  value={documents.length}
                  icon={FileText}
                  color="purple"
                />
                <StatCard
                  title="Mensagens"
                  value={messages.length}
                  icon={MessageSquare}
                  color="amber"
                />
              </div>

              {/* Project Overview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{selectedProject.name}</CardTitle>
                        <p className="text-slate-500 mt-1">
                          Consultor: {consultant?.name || 'Não atribuído'}
                        </p>
                      </div>
                      <StatusBadge status={selectedProject.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Progresso do projeto</span>
                        <span className="font-medium">{selectedProject.progress || 0}%</span>
                      </div>
                      <Progress value={selectedProject.progress || 0} className="h-3" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Início</p>
                        <p className="font-medium">
                          {selectedProject.start_date 
                            ? format(new Date(selectedProject.start_date), 'dd/MM/yyyy')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Término Previsto</p>
                        <p className="font-medium">
                          {selectedProject.end_date 
                            ? format(new Date(selectedProject.end_date), 'dd/MM/yyyy')
                            : '-'}
                        </p>
                      </div>
                    </div>

                    {selectedProject.scope && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-slate-500 text-sm mb-1">Escopo</p>
                        <p className="text-slate-700">{selectedProject.scope}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <Tabs defaultValue="tasks" className="space-y-4">
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="tasks">Tarefas</TabsTrigger>
                  <TabsTrigger value="documents">Documentos</TabsTrigger>
                  <TabsTrigger value="messages">Mensagens</TabsTrigger>
                </TabsList>

                <TabsContent value="tasks">
                  <Card className="border-0 shadow-sm">
                    <CardHeader>
                      <CardTitle>Tarefas e Entregáveis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {tasks.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Nenhuma tarefa cadastrada</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {tasks.map((task) => (
                            <div key={task.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                              <div className={`w-3 h-3 rounded-full ${
                                task.status === 'completed' ? 'bg-emerald-500' :
                                task.status === 'in_progress' ? 'bg-blue-500' :
                                'bg-slate-300'
                              }`} />
                              <div className="flex-1">
                                <p className={`font-medium ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                  {task.title}
                                </p>
                                {task.due_date && (
                                  <p className="text-sm text-slate-500">
                                    <Calendar className="w-3 h-3 inline mr-1" />
                                    Prazo: {format(new Date(task.due_date), 'dd/MM/yyyy')}
                                  </p>
                                )}
                              </div>
                              <StatusBadge status={task.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="documents">
                  <Card className="border-0 shadow-sm">
                    <CardHeader>
                      <CardTitle>Documentos do Projeto</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {documents.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Nenhum documento disponível</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-slate-400" />
                                <div>
                                  <p className="font-medium text-slate-900">{doc.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {format(new Date(doc.created_date), 'dd/MM/yyyy')}
                                  </p>
                                </div>
                              </div>
                              <Button variant="outline" size="sm" asChild>
                                <a href={doc.file_url} target="_blank" rel="noreferrer">Download</a>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="messages">
                  <Card className="border-0 shadow-sm">
                    <CardHeader>
                      <CardTitle>Comunicação com Consultor</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                        {messages.length === 0 ? (
                          <div className="text-center py-8 text-slate-400">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Inicie uma conversa</p>
                          </div>
                        ) : (
                          messages.map((msg) => (
                            <div 
                              key={msg.id} 
                              className={`p-3 rounded-lg ${
                                msg.sender_type === 'client' 
                                  ? 'bg-[#1e3a5f] text-white ml-8' 
                                  : 'bg-slate-100 mr-8'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-medium text-sm ${msg.sender_type === 'client' ? 'text-white' : 'text-slate-900'}`}>
                                  {msg.sender_name}
                                </span>
                                <span className={`text-xs ${msg.sender_type === 'client' ? 'text-white/70' : 'text-slate-400'}`}>
                                  {format(new Date(msg.created_date), 'dd/MM HH:mm')}
                                </span>
                              </div>
                              <p className={`text-sm ${msg.sender_type === 'client' ? 'text-white/90' : 'text-slate-700'}`}>
                                {msg.content}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Textarea 
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Digite sua mensagem..."
                          rows={2}
                        />
                        <Button 
                          onClick={() => sendMessageMutation.mutate(newMessage)}
                          disabled={!newMessage.trim() || sendMessageMutation.isPending}
                          className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </>
      )}
    </div>
  );
}