import React, { useState, useEffect, useMemo } from 'react';
import { SERVICE_AREAS } from '../components/utils/serviceAreas';
import { api } from '@/api/appApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Star, Search, Info, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export default function ServiceAreas() {
  const [expandedAreas, setExpandedAreas] = useState({});
  const [expandedSubareas, setExpandedSubareas] = useState({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const queryClient = useQueryClient();

  // Load saved config from DB
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['serviceAreaConfigs'],
    queryFn: () => api.entities.ServiceAreaConfig.list(),
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.filter({ status: 'active' }),
  });

  // Build a map: areaKey -> { docId, active_subareas[] }
  const configMap = useMemo(() => {
    const map = {};
    configs.forEach(c => {
      map[c.area_key] = { id: c.id, subareas: c.active_subareas || [] };
    });
    return map;
  }, [configs]);

  // Derive which areas are "active" (have at least one active subarea)
  const activeAreaKeys = useMemo(() => {
    const keys = new Set();
    Object.entries(configMap).forEach(([k, v]) => {
      if (v.subareas.length > 0) keys.add(k);
    });
    return keys;
  }, [configMap]);

  // Mutation: toggle a subarea
  const toggleMutation = useMutation({
    mutationFn: async ({ areaKey, subareaId }) => {
      const existing = configMap[areaKey];
      if (existing) {
        const current = existing.subareas;
        const next = current.includes(subareaId)
          ? current.filter(s => s !== subareaId)
          : [...current, subareaId];
        return api.entities.ServiceAreaConfig.update(existing.id, { active_subareas: next });
      } else {
        return api.entities.ServiceAreaConfig.create({ area_key: areaKey, active_subareas: [subareaId] });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['serviceAreaConfigs'] }),
  });

  // Mutation: toggle ALL subareas of an area
  const toggleAreaMutation = useMutation({
    mutationFn: async ({ areaKey }) => {
      const area = SERVICE_AREAS[areaKey];
      const allIds = area.subareas.map(s => s.id);
      const existing = configMap[areaKey];
      const currentActive = existing?.subareas || [];
      const allActive = allIds.every(id => currentActive.includes(id));
      const next = allActive ? [] : allIds;

      if (existing) {
        return api.entities.ServiceAreaConfig.update(existing.id, { active_subareas: next });
      } else {
        return api.entities.ServiceAreaConfig.create({ area_key: areaKey, active_subareas: next });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['serviceAreaConfigs'] }),
  });

  const toggleArea = (key) => setExpandedAreas(p => ({ ...p, [key]: !p[key] }));
  const toggleSubareaExpand = (id) => setExpandedSubareas(p => ({ ...p, [id]: !p[id] }));

  const isSubareaActive = (areaKey, subareaId) => {
    return configMap[areaKey]?.subareas?.includes(subareaId) || false;
  };

  const isAreaFullyActive = (areaKey) => {
    const area = SERVICE_AREAS[areaKey];
    const allIds = area.subareas.map(s => s.id);
    const current = configMap[areaKey]?.subareas || [];
    return allIds.length > 0 && allIds.every(id => current.includes(id));
  };

  const isAreaPartiallyActive = (areaKey) => {
    const current = configMap[areaKey]?.subareas || [];
    return current.length > 0 && !isAreaFullyActive(areaKey);
  };

  const totalActive = Object.keys(SERVICE_AREAS).filter(k => activeAreaKeys.has(k)).length;

  // Map: areaKey -> consultants that have that area
  const consultantsByArea = useMemo(() => {
    const map = {};
    consultants.forEach(c => {
      (c.service_areas || []).forEach(sa => {
        if (!map[sa.area]) map[sa.area] = [];
        map[sa.area].push(c);
      });
    });
    return map;
  }, [consultants]);

  const filteredAreas = Object.entries(SERVICE_AREAS).filter(([key, area]) => {
    const areaActive = activeAreaKeys.has(key);
    if (filter === 'active' && !areaActive) return false;
    if (filter === 'inactive' && areaActive) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchArea = area.label.toLowerCase().includes(q);
      const matchSub = area.subareas.some(s => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
      return matchArea || matchSub;
    }
    return true;
  }).sort((a, b) => SERVICE_AREAS[a[0]].number - SERVICE_AREAS[b[0]].number);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1e3a5f] mb-2">Áreas de Atuação</h1>
        <p className="text-slate-500">Gerencie as áreas e subáreas em que sua empresa atua. As marcadas ficam disponíveis para seleção nos consultores e projetos.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-bold text-[#1e3a5f]">{Object.keys(SERVICE_AREAS).length}</div>
          <div className="text-sm text-slate-500">Áreas Totais</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{totalActive}</div>
          <div className="text-sm text-green-600">Áreas que Atuamos</div>
        </div>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-bold text-slate-600">{Object.keys(SERVICE_AREAS).length - totalActive}</div>
          <div className="text-sm text-slate-500">Demais Áreas</div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 flex gap-4 text-sm flex-wrap items-center">
        <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
        <span className="text-blue-800">
          <strong>Clique no botão da área</strong> para ativar/desativar todas as subáreas, ou clique em cada subárea individualmente para um controle mais preciso.
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar área ou subárea..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[
            { value: 'all', label: 'Todas' },
            { value: 'active', label: '⭐ Que Atuamos' },
            { value: 'inactive', label: 'Demais' }
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === f.value
                  ? 'bg-white text-[#1e3a5f] shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Areas list */}
      <div className="space-y-3">
        {filteredAreas.map(([key, area]) => {
          const isOpen = expandedAreas[key];
          const fullyActive = isAreaFullyActive(key);
          const partiallyActive = isAreaPartiallyActive(key);
          const areaActive = activeAreaKeys.has(key);
          const isMutating = toggleAreaMutation.isPending;

          const displaySubareas = search
            ? area.subareas.filter(s =>
                s.name.toLowerCase().includes(search.toLowerCase()) ||
                s.description?.toLowerCase().includes(search.toLowerCase())
              )
            : area.subareas;

          return (
            <div
              key={key}
              className={`rounded-xl border overflow-hidden transition-all ${
                fullyActive
                  ? 'border-green-300 shadow-sm'
                  : partiallyActive
                  ? 'border-amber-300 shadow-sm'
                  : 'border-slate-200'
              }`}
            >
              {/* Area header */}
              <div className={`flex items-center px-5 py-4 transition-colors ${
                fullyActive ? 'bg-green-50' : partiallyActive ? 'bg-amber-50' : 'bg-white'
              }`}>
                {/* Toggle area button */}
                <button
                  onClick={() => toggleAreaMutation.mutate({ areaKey: key })}
                  disabled={isMutating}
                  title={fullyActive ? 'Desmarcar todas as subáreas' : 'Marcar todas as subáreas'}
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mr-3 transition-colors border-2 ${
                    fullyActive
                      ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
                      : partiallyActive
                      ? 'bg-amber-400 border-amber-400 text-white hover:bg-amber-500'
                      : 'bg-white border-slate-300 text-slate-500 hover:border-[#1e3a5f]'
                  }`}
                >
                  <span className="text-xs font-bold">{area.number}</span>
                </button>

                {/* Expand toggle */}
                <button
                  onClick={() => toggleArea(key)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold ${fullyActive ? 'text-green-800' : partiallyActive ? 'text-amber-800' : 'text-slate-800'}`}>
                        {area.label}
                      </span>
                      {fullyActive && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                      {partiallyActive && <Star className="w-4 h-4 text-amber-400" />}
                    </div>
                    <span className="text-xs text-slate-500">
                      {configMap[key]?.subareas?.length || 0}/{area.subareas.length} subárea{area.subareas.length !== 1 ? 's' : ''} ativa{area.subareas.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  {fullyActive && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Atuamos</Badge>}
                  {partiallyActive && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Parcial</Badge>}
                  {/* Consultants for this area */}
                  {(consultantsByArea[key] || []).length > 0 && (
                    <div className="flex items-center gap-1">
                      {(consultantsByArea[key] || []).slice(0, 4).map(c => (
                        <div
                          key={c.id}
                          title={c.name}
                          className="w-7 h-7 rounded-full bg-[#1e3a5f] text-white text-xs font-semibold flex items-center justify-center border-2 border-white -ml-1 first:ml-0 shadow-sm"
                        >
                          {c.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                      ))}
                      {(consultantsByArea[key] || []).length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-slate-300 text-slate-600 text-xs font-semibold flex items-center justify-center border-2 border-white -ml-1 shadow-sm">
                          +{(consultantsByArea[key] || []).length - 4}
                        </div>
                      )}
                    </div>
                  )}
                  <button onClick={() => toggleArea(key)} className="text-slate-400">
                    {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Subareas */}
              {isOpen && (
                <div className={`border-t divide-y ${fullyActive ? 'border-green-200 divide-green-100' : 'border-slate-100 divide-slate-100'}`}>
                  {displaySubareas.map(sub => {
                    const subKey = `${key}-${sub.id}`;
                    const subOpen = expandedSubareas[subKey];
                    const subActive = isSubareaActive(key, sub.id);
                    return (
                      <div key={sub.id} className="bg-white">
                        <div className="flex items-start gap-3 px-5 py-3">
                          {/* Toggle subarea */}
                          <button
                            onClick={() => toggleMutation.mutate({ areaKey: key, subareaId: sub.id })}
                            disabled={toggleMutation.isPending}
                            className="mt-0.5 flex-shrink-0"
                            title={subActive ? 'Desmarcar subárea' : 'Marcar subárea'}
                          >
                            {subActive
                              ? <CheckCircle2 className="w-5 h-5 text-green-500 hover:text-green-600 transition-colors" />
                              : <Circle className="w-5 h-5 text-slate-300 hover:text-slate-500 transition-colors" />
                            }
                          </button>
                          {/* Subarea info */}
                          <button
                            onClick={() => toggleSubareaExpand(subKey)}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{sub.id}</span>
                              <span className={`text-sm font-medium ${subActive ? 'text-green-800' : 'text-slate-700'}`}>{sub.name}</span>
                            </div>
                            {subOpen && sub.description && (
                              <p className="text-sm text-slate-600 mt-2 leading-relaxed border-l-2 border-slate-200 pl-3">
                                {sub.description}
                              </p>
                            )}
                          </button>
                          {sub.description && (
                            <button onClick={() => toggleSubareaExpand(subKey)}>
                              <Info className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-colors ${subOpen ? 'text-[#1e3a5f]' : 'text-slate-300'}`} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {displaySubareas.length === 0 && (
                    <div className="px-5 py-3 text-sm text-slate-400 text-center">Nenhuma subárea corresponde à busca</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredAreas.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Nenhuma área encontrada para "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}