import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Search, MoreHorizontal, Pencil, Trash2, Clock, DollarSign, FileText } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ServiceModelForm from '../components/forms/ServiceModelForm';
import { motion } from 'framer-motion';

const SERVICE_TYPES = {
  diagnostic: { label: "Diagnóstico", color: "bg-blue-100 text-blue-700" },
  implementation: { label: "Implementação", color: "bg-green-100 text-green-700" },
  training: { label: "Treinamento", color: "bg-purple-100 text-purple-700" },
  consulting_package: { label: "Pacote de Consultoria", color: "bg-amber-100 text-amber-700" },
  mentoring: { label: "Mentoria", color: "bg-pink-100 text-pink-700" },
  audit: { label: "Auditoria", color: "bg-slate-100 text-slate-700" }
};

export default function Services() {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.entities.ServiceModel.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.ServiceModel.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.ServiceModel.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setFormOpen(false);
      setEditingService(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.ServiceModel.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setDeleteConfirm(null);
    },
  });

  const handleSave = (data) => {
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormOpen(true);
  };

  const filteredServices = services.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modelos de Serviço"
        subtitle="Configure seus pacotes e tipos de consultoria"
        action={() => setFormOpen(true)}
        actionLabel="Novo Serviço"
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar serviços..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md pl-10"
          />
        </div>
      </div>

      {filteredServices.length === 0 && !isLoading ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhum serviço cadastrado"
          description="Crie modelos de serviço para padronizar suas ofertas"
          action={() => setFormOpen(true)}
          actionLabel="Criar Serviço"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service, index) => {
            const typeConfig = SERVICE_TYPES[service.type] || SERVICE_TYPES.consulting_package;
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="rounded-xl border bg-card text-card-foreground shadow border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-sm font-medium px-3 py-1 rounded-full border-0 ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                      <div className="relative group">
                         <button className="p-1 hover:bg-slate-100 rounded-lg">
                           <MoreHorizontal className="w-4 h-4" />
                         </button>
                         <div className="absolute right-0 top-8 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                           <button onClick={() => handleEdit(service)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left">
                             <Pencil className="w-4 h-4" /> Editar
                           </button>
                           <button 
                             onClick={() => setDeleteConfirm(service)}
                             className="flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 w-full text-left"
                           >
                             <Trash2 className="w-4 h-4" /> Excluir
                           </button>
                         </div>
                       </div>
                    </div>

                    <h3 className="font-semibold text-slate-900 mb-2">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm text-slate-500 mb-4 line-clamp-2">{service.description}</p>
                    )}

                    <div className="flex-1" />

                    {service.deliverables?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-slate-500 mb-2">Entregáveis:</p>
                        <div className="space-y-1">
                          {service.deliverables.slice(0, 3).map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-slate-700">{typeof d === 'string' ? d : d.name}</span>
                              {typeof d === 'object' && d.estimated_hours > 0 && (
                                <span className="text-slate-500">{d.estimated_hours}h</span>
                              )}
                            </div>
                          ))}
                          {service.deliverables.length > 3 && (
                            <span className="text-xs text-slate-500">+{service.deliverables.length - 3} mais</span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {service.document_name && (
                      <div className="mb-4">
                        <a 
                          href={service.document_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          {service.document_name}
                        </a>
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1 text-slate-600">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-semibold text-slate-900">
                            R$ {service.base_price?.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <StatusBadge status={service.status} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        {service.hourly_rate > 0 && (
                          <div className="text-slate-500">
                            R$ {service.hourly_rate?.toFixed(2)}/hora
                          </div>
                        )}
                        {service.estimated_hours > 0 && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-4 h-4" />
                            {service.estimated_hours}h estimadas
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <ServiceModelForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingService(null);
        }}
        service={editingService}
        onSave={handleSave}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="font-semibold text-lg text-slate-900 mb-2">Confirmar exclusão</h3>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir o serviço "{deleteConfirm?.name}"? Esta ação não pode ser desfeita.
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