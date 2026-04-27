import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Download, Folder, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';

const DOC_TYPES = {
  contract: { label: "Contrato", color: "bg-blue-100 text-blue-700" },
  report: { label: "Relatório", color: "bg-green-100 text-green-700" },
  presentation: { label: "Apresentação", color: "bg-purple-100 text-purple-700" },
  spreadsheet: { label: "Planilha", color: "bg-amber-100 text-amber-700" },
  other: { label: "Outro", color: "bg-slate-100 text-slate-700" }
};

export default function ClientDocuments() {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  
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

  const { data: documents = [] } = useQuery({
    queryKey: ['clientAllDocuments'],
    queryFn: async () => {
      if (!user?.client_id || projects.length === 0) return [];
      const projectIds = projects.map(p => p.id);
      const allDocs = await api.entities.Document.list('-created_date');
      return allDocs.filter(d => projectIds.includes(d.project_id) && d.visible_to_client);
    },
    enabled: projects.length > 0,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, projectId }) => {
      setUploading(true);
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      return api.entities.Document.create({
        project_id: projectId,
        name: file.name,
        file_url,
        type: 'other',
        uploaded_by: user?.full_name,
        visible_to_client: true,
        description: 'Enviado pelo cliente'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientAllDocuments'] });
      setUploading(false);
    },
    onError: () => setUploading(false),
  });

  const handleUpload = (e, projectId) => {
    const file = e.target.files[0];
    if (file && projectId) {
      uploadMutation.mutate({ file, projectId });
    }
  };

  const filteredDocuments = documents.filter(d => {
    const matchesSearch = d.name?.toLowerCase().includes(search.toLowerCase());
    const matchesProject = projectFilter === 'all' || d.project_id === projectFilter;
    return matchesSearch && matchesProject;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus Documentos"
        subtitle="Acesse e envie documentos dos seus projetos"
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar documentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Filtrar por projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Upload Section */}
      {projects.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                <p className="font-medium text-slate-900">Enviar documento</p>
                <p className="text-sm text-slate-500">Selecione um projeto e envie um arquivo</p>
              </div>
              <div className="flex gap-2">
                <Select value={projectFilter !== 'all' ? projectFilter : ''} onValueChange={setProjectFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Selecione projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="file"
                  id="client-upload"
                  className="hidden"
                  onChange={(e) => handleUpload(e, projectFilter !== 'all' ? projectFilter : projects[0]?.id)}
                  disabled={uploading || projects.length === 0}
                />
                <Button
                  onClick={() => document.getElementById('client-upload').click()}
                  disabled={uploading || (projectFilter === 'all' && !projects[0])}
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum documento encontrado"
          description={search || projectFilter !== 'all' 
            ? "Tente ajustar os filtros de busca" 
            : "Os documentos compartilhados aparecerão aqui"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc, index) => {
            const project = projects.find(p => p.id === doc.project_id);
            const typeConfig = DOC_TYPES[doc.type] || DOC_TYPES.other;
            
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-slate-100">
                        <FileText className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{doc.name}</p>
                        <p className="text-sm text-slate-500 truncate">{project?.name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={`${typeConfig.color} border-0`}>
                        {typeConfig.label}
                      </Badge>
                    </div>

                    <div className="flex-1" />

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {doc.created_date ? format(parseISO(doc.created_date), 'dd/MM/yyyy') : '-'}
                      </span>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={doc.file_url} target="_blank" rel="noreferrer">
                          <Download className="w-4 h-4 mr-1" />
                          Baixar
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}