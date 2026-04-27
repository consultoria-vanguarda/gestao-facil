import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Search, MoreHorizontal, Pencil, Trash2, Mail, Phone } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ClientForm from '../components/forms/ClientForm';
import { motion } from 'framer-motion';

export default function Clients() {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.entities.Client.list('-created_date'),
    retry: 1,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list(),
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Client.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Client.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setFormOpen(false);
      setEditingClient(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Client.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDeleteConfirm(null);
    },
  });

  const handleSave = (data) => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  const filteredClients = clients.filter(c => 
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.segment?.toLowerCase().includes(search.toLowerCase())
  );

  const getClientProjects = (clientId) => {
    return projects.filter(p => p.client_id === clientId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
          <p className="text-slate-500 mt-2">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-rose-500 mx-auto mb-2" />
          <h2 className="text-lg font-medium text-slate-900">Erro ao carregar dados</h2>
          <p className="text-slate-500 text-sm mt-1">Tente recarregar a página</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-md hover:bg-[#2d4a6f]">
            Recarregar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Gerencie seus clientes e empresas"
        action={() => setFormOpen(true)}
        actionLabel="Novo Cliente"
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md pl-10"
          />
        </div>
      </div>

      {filteredClients.length === 0 && !isLoading ? (
        <EmptyState
          icon={Building2}
          title="Nenhum cliente cadastrado"
          description="Cadastre seus clientes para começar a criar projetos"
          action={() => setFormOpen(true)}
          actionLabel="Cadastrar Cliente"
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rounded-xl border bg-card text-card-foreground shadow border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Empresa</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Segmento</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Contato</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Projetos</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                    <th className="px-6 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const clientProjects = getClientProjects(client.id);
                    return (
                      <tr key={client.id} className="hover:bg-slate-50 border-b">
                        <td className="px-6 py-4 text-sm">
                           <div>
                             <p className="font-medium text-slate-900">{client.company_name}</p>
                             {client.document && (
                               <p className="text-sm text-slate-500">{client.document}</p>
                             )}
                           </div>
                         </td>
                         <td className="px-6 py-4 text-sm text-slate-600">
                           {client.segment || '-'}
                         </td>
                         <td className="px-6 py-4 text-sm">
                           <div className="space-y-1">
                             <div className="flex items-center gap-1 text-slate-600">
                               <Mail className="w-3 h-3" />
                               {client.email}
                             </div>
                             {client.phone && (
                               <div className="flex items-center gap-1 text-slate-500">
                                 <Phone className="w-3 h-3" />
                                 {client.phone}
                               </div>
                             )}
                           </div>
                         </td>
                         <td className="px-6 py-4 text-sm">
                           <span className="font-medium">{clientProjects.length}</span>
                           <span className="text-slate-500 text-sm ml-1">
                             ({clientProjects.filter(p => p.status === 'in_progress').length} ativos)
                           </span>
                         </td>
                         <td className="px-6 py-4 text-sm">
                           <StatusBadge status={client.status} />
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEdit(client)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md font-medium transition-colors">
                                <Pencil className="w-3.5 h-3.5" /> Editar
                              </button>
                              <button onClick={() => setDeleteConfirm(client)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                         </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      <ClientForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingClient(null);
        }}
        client={editingClient}
        onSave={handleSave}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="font-semibold text-lg text-slate-900 mb-2">Confirmar exclusão</h3>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir o cliente "{deleteConfirm?.company_name}"? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button 
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}