import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PhoneInput from "@/components/ui/PhoneInput";
import { Loader2, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { SERVICE_AREAS, getSubareasWithDetails } from '../utils/serviceAreas';
import { api } from '@/api/appApi';
import { useQuery } from '@tanstack/react-query';
import { validateEmail, validatePhone } from "@/lib/validators";

export default function ConsultantForm({ open, onClose, consultant, onSave, loading }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', specialty: '',
    availability: 'full_time', status: 'active', bio: '', service_areas: []
  });
  const [addingArea, setAddingArea] = useState('');
  const [expandedAreas, setExpandedAreas] = useState({});

  useEffect(() => {
    if (consultant) {
      setForm({
        name: consultant.name || '',
        email: consultant.email || '',
        phone: consultant.phone || '',
        specialty: consultant.specialty || '',
        availability: consultant.availability || 'full_time',
        status: consultant.status || 'active',
        bio: consultant.bio || '',
        service_areas: consultant.service_areas || []
      });
    } else {
      setForm({ name: '', email: '', phone: '', specialty: '', availability: 'full_time', status: 'active', bio: '', service_areas: [] });
    }
    setAddingArea('');
    setExpandedAreas({});
  }, [consultant, open]);

  const handleAddArea = () => {
    if (!addingArea) return;
    const already = form.service_areas.find(sa => sa.area === addingArea);
    if (already) return;
    setForm(prev => ({ ...prev, service_areas: [...prev.service_areas, { area: addingArea, subareas: [] }] }));
    setExpandedAreas(prev => ({ ...prev, [addingArea]: true }));
    setAddingArea('');
  };

  const handleRemoveArea = (area) => {
    setForm(prev => ({ ...prev, service_areas: prev.service_areas.filter(sa => sa.area !== area) }));
  };

  const handleToggleSubarea = (area, subarea) => {
    setForm(prev => ({
      ...prev,
      service_areas: prev.service_areas.map(sa => {
        if (sa.area !== area) return sa;
        const has = sa.subareas.includes(subarea);
        return { ...sa, subareas: has ? sa.subareas.filter(s => s !== subarea) : [...sa.subareas, subarea] };
      })
    }));
  };

  const toggleExpand = (area) => setExpandedAreas(prev => ({ ...prev, [area]: !prev[area] }));

  // Load active areas from DB config
  const { data: configs = [] } = useQuery({
    queryKey: ['serviceAreaConfigs'],
    queryFn: () => api.entities.ServiceAreaConfig.list(),
  });

  // Build list of area options that have at least one active subarea in the company config
  const availableAreasToAdd = useMemo(() => {
    const result = [];
    configs.forEach(c => {
      if (c.active_subareas && c.active_subareas.length > 0 && SERVICE_AREAS[c.area_key]) {
        if (!form.service_areas.find(sa => sa.area === c.area_key)) {
          const area = SERVICE_AREAS[c.area_key];
          result.push({ value: c.area_key, label: `${area.number}. ${area.label}` });
        }
      }
    });
    return result.sort((a, b) => SERVICE_AREAS[a.value].number - SERVICE_AREAS[b.value].number);
  }, [configs, form.service_areas]);

  // For each area in the form, only show subareas that are active in company config
  const getActiveSubareasForArea = (areaKey) => {
    const config = configs.find(c => c.area_key === areaKey);
    const activeIds = config?.active_subareas || [];
    return getSubareasWithDetails(areaKey).filter(sub => activeIds.includes(sub.id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateEmail(form.email)) {
      alert('Informe um e-mail válido.');
      return;
    }
    if (form.phone && !validatePhone(form.phone)) {
      alert('Informe um telefone válido (com DDD).');
      return;
    }
    onSave(form);
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) setTimeout(onClose, 100);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{consultant ? 'Editar Consultor' : 'Novo Consultor'}</DialogTitle>
          <DialogDescription>
            {consultant ? 'Altere os dados do consultor' : 'Cadastre um novo consultor'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome Completo *</Label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
            </div>
            <div>
              <Label>Telefone</Label>
              <PhoneInput value={form.phone} onChange={(v) => setForm({...form, phone: v})} />
            </div>
            <div>
              <Label>Especialidade *</Label>
              <Input value={form.specialty} onChange={(e) => setForm({...form, specialty: e.target.value})} placeholder="Ex: Finanças, Marketing" required />
            </div>
            <div>
              <Label>Disponibilidade</Label>
              <Select value={form.availability} onValueChange={(v) => setForm({...form, availability: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Tempo Integral</SelectItem>
                  <SelectItem value="part_time">Meio Período</SelectItem>
                  <SelectItem value="project_based">Por Projeto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Biografia</Label>
              <Textarea value={form.bio} onChange={(e) => setForm({...form, bio: e.target.value})} placeholder="Breve descrição profissional" rows={2} />
            </div>
          </div>

          {/* Áreas de atuação */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <Label className="text-base font-semibold text-[#1e3a5f]">Áreas de Atuação</Label>

            {/* Add area */}
            {availableAreasToAdd.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={addingArea}
                  onChange={e => setAddingArea(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                >
                  <option value="">Selecionar área para adicionar...</option>
                  {availableAreasToAdd.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
                <Button type="button" onClick={handleAddArea} disabled={!addingArea} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}

            {form.service_areas.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-2">Nenhuma área adicionada</p>
            )}

            {form.service_areas.map(sa => {
              const areaConfig = SERVICE_AREAS[sa.area];
              const subareas = getSubareasWithDetails(sa.area);
              const isExpanded = expandedAreas[sa.area];
              return (
                <div key={sa.area} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50">
                    <button type="button" onClick={() => toggleExpand(sa.area)} className="flex-1 flex items-center gap-2 text-left text-sm font-medium text-slate-800">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {areaConfig?.label || sa.area}
                      <span className="text-xs text-slate-500 font-normal">({sa.subareas.length} subárea{sa.subareas.length !== 1 ? 's' : ''})</span>
                    </button>
                    <button type="button" onClick={() => handleRemoveArea(sa.area)} className="text-rose-400 hover:text-rose-600 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {isExpanded && (() => {
                    const activeSubareas = getActiveSubareasForArea(sa.area);
                    return activeSubareas.length > 0 ? (
                      <div className="p-3 grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                        {activeSubareas.map(sub => (
                          <label key={sub.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
                            <input
                              type="checkbox"
                              checked={sa.subareas.includes(sub.name)}
                              onChange={() => handleToggleSubarea(sa.area, sub.name)}
                              className="mt-0.5 accent-[#1e3a5f]"
                            />
                            <div>
                              <span className="text-slate-400 text-xs font-mono mr-1">{sub.id}</span>
                              <span className="text-slate-700">{sub.name}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 px-4 py-2">Nenhuma subárea ativa nessa área</p>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {consultant ? 'Salvar' : 'Criar Consultor'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}