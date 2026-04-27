import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus, Upload, FileText, Trash2 } from "lucide-react";
import { api } from '@/api/appApi';
import MoneyInput from "@/components/ui/MoneyInput";
import { parseMoneyBRToNumber, validateMoney } from "@/lib/validators";

const SERVICE_TYPES = {
  diagnostic: "Diagnóstico",
  implementation: "Implementação",
  training: "Treinamento",
  consulting_package: "Pacote de Consultoria",
  mentoring: "Mentoria",
  audit: "Auditoria"
};

export default function ServiceModelForm({ open, onClose, service, onSave, loading }) {
  const [form, setForm] = useState({
    name: '',
    type: 'consulting_package',
    description: '',
    base_price: '',
    hourly_rate: '',
    estimated_hours: '',
    deliverables: [],
    document_url: '',
    document_name: '',
    status: 'active'
  });
  const [newDeliverable, setNewDeliverable] = useState({ name: '', estimated_hours: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (service) {
      setForm({
        name: service.name || '',
        type: service.type || 'consulting_package',
        description: service.description || '',
        base_price: service.base_price || '',
        hourly_rate: service.hourly_rate || '',
        estimated_hours: service.estimated_hours || '',
        deliverables: service.deliverables || [],
        document_url: service.document_url || '',
        document_name: service.document_name || '',
        status: service.status || 'active'
      });
    } else {
      setForm({
        name: '',
        type: 'consulting_package',
        description: '',
        base_price: '',
        hourly_rate: '',
        estimated_hours: '',
        deliverables: [],
        document_url: '',
        document_name: '',
        status: 'active'
      });
    }
    setNewDeliverable({ name: '', estimated_hours: '' });
  }, [service]);

  const addDeliverable = () => {
    if (newDeliverable.name.trim()) {
      setForm({
        ...form, 
        deliverables: [...form.deliverables, {
          name: newDeliverable.name.trim(),
          estimated_hours: parseFloat(newDeliverable.estimated_hours) || 0
        }]
      });
      setNewDeliverable({ name: '', estimated_hours: '' });
    }
  };

  const removeDeliverable = (index) => {
    setForm({...form, deliverables: form.deliverables.filter((_, i) => i !== index)});
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setForm({...form, document_url: file_url, document_name: file.name});
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = () => {
    setForm({...form, document_url: '', document_name: ''});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateMoney(form.base_price, { min: 0 })) {
      alert('Informe um Preço Base (R$) válido.');
      return;
    }
    if (form.hourly_rate && !validateMoney(form.hourly_rate, { min: 0 })) {
      alert('Informe um Valor/Hora (R$) válido.');
      return;
    }
    onSave({
      ...form,
      base_price: parseMoneyBRToNumber(form.base_price) || 0,
      hourly_rate: parseMoneyBRToNumber(form.hourly_rate) || 0,
      estimated_hours: parseFloat(form.estimated_hours) || 0
    });
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setTimeout(onClose, 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? 'Editar Serviço' : 'Novo Modelo de Serviço'}</DialogTitle>
          <DialogDescription>
            {service ? 'Altere os dados do modelo de serviço' : 'Configure um novo modelo de serviço'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label>Nome do Serviço *</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="Ex: Diagnóstico Empresarial Básico"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço Base (R$) *</Label>
                <MoneyInput
                  value={form.base_price} 
                  onChange={(v) => setForm({ ...form, base_price: v })}
                  required
                />
              </div>
              <div>
                <Label>Valor/Hora Consultor (R$)</Label>
                <MoneyInput
                  value={form.hourly_rate}
                  onChange={(v) => setForm({ ...form, hourly_rate: v })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Horas Estimadas</Label>
                <Input 
                  type="number"
                  step="0.5"
                  value={form.estimated_hours} 
                  onChange={(e) => setForm({...form, estimated_hours: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea 
                value={form.description} 
                onChange={(e) => setForm({...form, description: e.target.value})}
                rows={3}
              />
            </div>
            <div>
              <Label>Entregáveis</Label>
              <div className="flex gap-2 mb-2">
                <Input 
                  value={newDeliverable.name}
                  onChange={(e) => setNewDeliverable({...newDeliverable, name: e.target.value})}
                  placeholder="Nome do entregável"
                  className="flex-1"
                />
                <Input 
                  type="number"
                  step="0.5"
                  min="0"
                  value={newDeliverable.estimated_hours}
                  onChange={(e) => setNewDeliverable({...newDeliverable, estimated_hours: e.target.value})}
                  placeholder="Horas"
                  className="w-24"
                />
                <Button type="button" size="icon" variant="outline" onClick={addDeliverable}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {form.deliverables.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{typeof d === 'string' ? d : d.name}</span>
                      {typeof d === 'object' && d.estimated_hours > 0 && (
                        <span className="text-xs text-slate-500">({d.estimated_hours}h)</span>
                      )}
                    </div>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeDeliverable(i)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Documento Anexo</Label>
              <div className="mt-2">
                {form.document_url ? (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{form.document_name}</p>
                      <a 
                        href={form.document_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Ver documento
                      </a>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={removeDocument}
                      className="text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      id="service-document-upload"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('service-document-upload').click()}
                      disabled={uploading}
                      className="w-full"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Anexar Documento
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {service ? 'Salvar' : 'Criar Serviço'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}