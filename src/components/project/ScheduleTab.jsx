import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/appApi';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, MapPin, CheckCircle, Zap, DollarSign } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ConsultantConflictModal from './ConsultantConflictModal';
import { generateScheduleDates, estimateScheduleEndDate, isHoliday } from '@/lib/scheduleDates';

const statusConfig = {
  scheduled: { label: 'Agendada', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelada', color: 'bg-rose-100 text-rose-700' }
};

// Computes which calendar dates should be skipped (off days) based on project days_off config
function computeAutoSkipDates(project) {
  const { start_date, estimated_hours, hours_per_day, consider_sundays, consider_holidays, days_off, days_off_position } = project;
  const daysOffCount = parseInt(days_off) || 0;
  if (!daysOffCount || !start_date) return new Set();

  const hpd = parseFloat(hours_per_day) || 4;
  const totalH = parseFloat(estimated_hours) || 0;
  const workDays = Math.ceil(totalH / hpd);
  const totalSlots = workDays + daysOffCount;

  let offPositions;
  if (days_off_position === 'start') {
    offPositions = new Set(Array.from({ length: daysOffCount }, (_, i) => i));
  } else if (days_off_position === 'middle') {
    const mid = Math.floor(workDays / 2);
    offPositions = new Set(Array.from({ length: daysOffCount }, (_, i) => mid + i));
  } else {
    offPositions = new Set(Array.from({ length: daysOffCount }, (_, i) => workDays + i));
  }

  let current = new Date(start_date + 'T12:00:00');
  const skipDates = new Set();
  for (let s = 0; s < totalSlots; s++) {
    while (true) {
      const dow = current.getDay();
      const dateStr = current.toISOString().split('T')[0];
      if ((dow === 0 && consider_sundays !== 'yes') || (isHoliday(dateStr) && consider_holidays !== 'yes')) {
        current = addDays(current, 1);
      } else break;
    }
    if (offPositions.has(s)) skipDates.add(current.toISOString().split('T')[0]);
    current = addDays(current, 1);
  }
  return skipDates;
}

// Modal for editing schedule config before regenerating
function ScheduleConfigModal({ open, onClose, project, onGenerate }) {
  const [config, setConfig] = useState({
    start_date: project?.start_date || '',
    estimated_hours: project?.estimated_hours || '',
    hours_per_day: project?.hours_per_day || 4,
    consider_sundays: project?.consider_sundays || 'no',
    consider_holidays: project?.consider_holidays || 'no',
    days_off: project?.days_off || 0,
    max_work_days_per_week: project?.max_work_days_per_week ?? 3,
  });
  const [daysOffDates, setDaysOffDates] = useState([]);

  // Reset when project changes
  React.useEffect(() => {
    if (project && open) {
      const daysOff = project.days_off || 0;
      setConfig({
        start_date: project.start_date || '',
        estimated_hours: project.estimated_hours || '',
        hours_per_day: project.hours_per_day || 4,
        consider_sundays: project.consider_sundays || 'no',
        consider_holidays: project.consider_holidays || 'no',
        days_off: daysOff,
        max_work_days_per_week: project.max_work_days_per_week ?? 3,
      });
      // Pre-fill off dates from schedule_config if available
      const savedOffDates = (project.schedule_config || [])
        .filter(r => r.isDayOff && r.date)
        .map(r => {
          const d = r.date;
          if (d.includes('/')) {
            const p = d.split('/');
            return p[2]?.length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : d;
          }
          return d;
        });
      setDaysOffDates(savedOffDates.length > 0 ? savedOffDates : Array(parseInt(daysOff) || 0).fill(''));
    }
  }, [project, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'days_off') {
      const count = parseInt(value) || 0;
      setDaysOffDates(prev => {
        const updated = [...prev];
        while (updated.length < count) updated.push('');
        return updated.slice(0, count);
      });
    }
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleDaysOffDateChange = (idx, value) => {
    setDaysOffDates(prev => prev.map((d, i) => i === idx ? value : d));
  };

  const previewEndDate = estimateScheduleEndDate(config, parseInt(config.days_off, 10) || 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar e Regenerar Agenda</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data de Início *</label>
            <input type="date" name="start_date" value={config.start_date} onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Horas Estimadas *</label>
            <input type="number" name="estimated_hours" step="0.5" min="0" value={config.estimated_hours} onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="Ex: 40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Horas por dia *</label>
            <input type="number" name="hours_per_day" step="0.5" min="0.5" max="24" value={config.hours_per_day} onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="Ex: 4" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Considerar Domingos?</label>
              <select name="consider_sundays" value={config.consider_sundays} onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
                <option value="no">Não</option>
                <option value="yes">Sim</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Considerar Feriados?</label>
              <select name="consider_holidays" value={config.consider_holidays} onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
                <option value="no">Não</option>
                <option value="yes">Sim</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dias de atendimento por semana (norma) *</label>
            <select
              name="max_work_days_per_week"
              value={String(config.max_work_days_per_week ?? 3)}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white mb-3"
            >
              <option value="2">Até 2 dias por semana (não consecutivos)</option>
              <option value="3">Até 3 dias por semana (não consecutivos)</option>
            </select>
            <p className="text-xs text-slate-500 mb-3">
              A agenda será distribuída sem dias corridos, conforme a norma do programa.
            </p>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dias de folga no período</label>
            <input type="number" name="days_off" step="1" min="0" value={config.days_off} onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="0" />
          </div>
          {parseInt(config.days_off) > 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
              <p className="text-sm font-medium text-orange-800">📅 Datas das folgas (opcional — edite se necessário)</p>
              {daysOffDates.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-orange-700 w-16 shrink-0">Folga {i + 1}</span>
                  <input type="date" value={d} onChange={e => handleDaysOffDateChange(i, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-orange-300 rounded-md text-sm bg-white" />
                </div>
              ))}
              <p className="text-xs text-orange-600">Se não preenchido, as folgas serão distribuídas automaticamente.</p>
            </div>
          )}
          {previewEndDate && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              📅 Previsão de término: <strong>{previewEndDate}</strong>
              {' '}({Math.ceil(parseFloat(config.estimated_hours || 0) / parseFloat(config.hours_per_day || 1))} dias úteis)
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={() => onGenerate(config, daysOffDates.filter(d => d))}>
            <Zap className="w-4 h-4 mr-2" /> Regenerar Agenda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhaseCard({ session, phaseNumber, onUpdate, onComplete, onReopen, phaseValue, updating }) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(session.description || '');
  const cfg = statusConfig[session.status] || statusConfig.scheduled;
  const isToday = session.date === new Date().toISOString().split('T')[0];
  const sessionValue = phaseValue || 0;

  const handleSaveDesc = () => {
    onUpdate({ ...session, description: desc });
    setEditing(false);
  };

  return (
    <div className={`rounded-lg border p-4 transition-all ${
      session.status === 'completed' && session.approved ? 'border-emerald-300 bg-emerald-50'
      : session.status === 'completed' ? 'border-emerald-200 bg-white'
      : isToday ? 'border-blue-300 bg-blue-50'
      : session.status === 'cancelled' ? 'border-slate-100 bg-slate-50 opacity-60'
      : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          session.status === 'completed' ? 'bg-emerald-500 text-white'
          : session.status === 'cancelled' ? 'bg-slate-300 text-slate-600'
          : isToday ? 'bg-blue-500 text-white'
          : 'bg-slate-200 text-slate-700'
        }`}>
          {phaseNumber}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-slate-900">Fase {phaseNumber}</span>
            <span className="text-sm text-slate-500">
              {session.date ? format(parseISO(session.date), "dd 'de' MMMM, yyyy", { locale: ptBR }) : '-'}
            </span>
            {isToday && <Badge className="bg-blue-500 text-white text-xs">Hoje</Badge>}
            <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
            {session.approved && <Badge className="bg-emerald-600 text-white text-xs">✓ Aprovado</Badge>}
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-500 mb-2">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{session.hours || 0}h</span>
            {session.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.location}</span>}
            <span className="flex items-center gap-1 text-slate-700 font-medium">
              <DollarSign className="w-3 h-3" />R$ {sessionValue.toFixed(2)} produzido
            </span>
          </div>

          {editing ? (
            <div className="space-y-2">
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="Descreva o que foi executado nesta fase..." rows={3} className="text-sm" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveDesc} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" disabled={updating}>Salvar</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDesc(session.description || ''); }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div>
              {session.description && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded p-2 mb-2">{session.description}</p>
              )}
              {!session.description && session.status === 'completed' && (
                <p className="text-xs text-slate-400 italic mb-2">Nenhuma descrição inserida</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {session.status !== 'cancelled' && (
                  <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700 text-xs h-7" onClick={() => setEditing(true)}>
                    ✏️ {session.description ? 'Editar' : 'Inserir'} atividade
                  </Button>
                )}
                {session.status === 'scheduled' && (
                  <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 text-xs h-7"
                    onClick={() => onComplete(session)} disabled={updating}>
                    <CheckCircle className="w-3 h-3 mr-1" /> Concluir
                  </Button>
                )}
                {session.status === 'completed' && (
                  <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700 text-xs h-7"
                    onClick={() => onReopen(session)} disabled={updating}>
                    ↩ Voltar para Agendada
                  </Button>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function checkConsultantConflicts(consultantId, proposedDates, currentProjectId) {
  if (!consultantId || !proposedDates.length) return { hasConflicts: false };

  // Get all schedules for this consultant across other projects
  const allSchedules = await api.entities.ProjectSchedule.filter({ consultant_id: consultantId });
  // Exclude current project and cancelled schedules (except day-off slots from Políticas Públicas)
  const otherProjectSchedules = allSchedules.filter(s =>
    s.project_id !== currentProjectId &&
    s.status !== 'cancelled' &&
    s.location !== 'FOLGA'
  );

  if (!otherProjectSchedules.length) return { hasConflicts: false };

  // Fetch each referenced project and keep ONLY those that exist AND are planning/in_progress
  const otherProjectIds = [...new Set(otherProjectSchedules.map(s => s.project_id))];
  const projectDetails = {};
  await Promise.all(otherProjectIds.map(async (pid) => {
    const projs = await api.entities.Project.filter({ id: pid });
    const proj = projs[0];
    // Only consider projects that exist and are active (planning or in_progress)
    if (proj && (proj.status === 'planning' || proj.status === 'in_progress')) {
      projectDetails[pid] = proj.name;
    }
  }));

  // Filter schedules to only those belonging to active projects
  const activeOtherSchedules = otherProjectSchedules.filter(s => projectDetails[s.project_id]);

  if (!activeOtherSchedules.length) return { hasConflicts: false };

  const busyDateSet = new Set(activeOtherSchedules.map(s => s.date));
  const conflictingDates = proposedDates
    .filter(d => busyDateSet.has(d.date))
    .map(d => {
      const matching = activeOtherSchedules.find(s => s.date === d.date);
      return { date: d.date, projectName: projectDetails[matching?.project_id] || 'Outro projeto' };
    });

  if (!conflictingDates.length) return { hasConflicts: false };

  // Suggest first free date after last conflicting date
  const lastConflict = [...conflictingDates].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  let suggest = addDays(parseISO(lastConflict.date), 1);
  for (let i = 0; i < 365; i++) {
    const dateStr = suggest.toISOString().split('T')[0];
    if (!busyDateSet.has(dateStr)) break;
    suggest = addDays(suggest, 1);
  }
  const suggestedStartDate = suggest.toISOString().split('T')[0];

  return { hasConflicts: true, conflictingDates, suggestedStartDate };
}

export default function ScheduleTab({ projectId, consultantId, consultants, project }) {
  const queryClient = useQueryClient();
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState(null);
  const [pendingConfig, setPendingConfig] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => api.entities.ProjectSchedule.filter({ project_id: projectId }),
    enabled: !!projectId,
  });



  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.ProjectSchedule.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.ProjectSchedule.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules', projectId] })
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data) => api.entities.Project.update(projectId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] })
  });

  const applySchedule = async (dates, config) => {
    // Delete ALL existing schedules in parallel batches of 10
    const existing = await api.entities.ProjectSchedule.filter({ project_id: projectId });
    for (let i = 0; i < existing.length; i += 10) {
      await Promise.all(existing.slice(i, i + 10).map(s => api.entities.ProjectSchedule.delete(s.id)));
    }

    // Filter out entries without dates, then separate day-off entries from work entries
    const validDates = dates.filter(d => d.date);

    // For day-off deduplication: if a date is marked as day-off, remove work entries on that same date
    const offDateSet = new Set(validDates.filter(d => d.is_day_off || d.isDayOff).map(d => d.date));
    const finalDates = validDates
      .filter(d => (d.is_day_off || d.isDayOff) || !offDateSet.has(d.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get last work date (non-day-off) for end_date
    const workDates = finalDates.filter(d => !d.is_day_off && !d.isDayOff);
    const endDate = workDates.length > 0 ? workDates[workDates.length - 1].date : null;

    // Build records and bulk create in batches of 50
    const records = finalDates
      .map(d => ({
        project_id: projectId,
        consultant_id: consultantId,
        date: d.date,
        hours: (d.is_day_off || d.isDayOff) ? 0 : (d.hours || 0),
        ...(d.phase_value != null ? { phase_value: d.phase_value } : {}),
        status: (d.is_day_off || d.isDayOff) ? 'cancelled' : 'scheduled',
        description: (d.is_day_off || d.isDayOff) ? 'Folga' : (d.description || ''),
        location: (d.is_day_off || d.isDayOff) ? 'FOLGA' : undefined,
      }));

    for (let i = 0; i < records.length; i += 50) {
      await api.entities.ProjectSchedule.bulkCreate(records.slice(i, i + 50));
    }

    const startDate = finalDates[0]?.date || config.start_date;

    // Save config + end_date back to project (do NOT overwrite schedule_config — managed by ProjectForm)
    await api.entities.Project.update(projectId, {
      start_date: startDate || config.start_date,
      estimated_hours: parseFloat(config.estimated_hours) || 0,
      hours_per_day: parseFloat(config.hours_per_day) || 0,
      consider_sundays: config.consider_sundays,
      consider_holidays: config.consider_holidays,
      days_off: parseInt(config.days_off) || 0,
      max_work_days_per_week: parseInt(config.max_work_days_per_week, 10) || 3,
      schedule_generated: true,
      ...(endDate ? { end_date: endDate } : {})
    });

    queryClient.invalidateQueries({ queryKey: ['schedules', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
  };

  const handleGenerateFromConfig = async (config, explicitDaysOffDates = []) => {
    setConfigModalOpen(false);

    const normalizeDate = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts[2]?.length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    };

    // Determinar datas de folga: explícitas ou calculadas automaticamente pela posição
    let offDates;
    if (explicitDaysOffDates.length > 0) {
      offDates = explicitDaysOffDates.map(d => normalizeDate(d)).filter(Boolean);
    } else if (parseInt(config.days_off) > 0) {
      offDates = [...computeAutoSkipDates(config)];
    } else {
      offDates = [];
    }

    const skipDates = new Set(offDates);
    // Gerar TODAS as fases de trabalho, pulando os dias de folga
    const workDates = generateScheduleDates(config, skipDates);
    if (workDates.length === 0) {
      alert('Configurações insuficientes para gerar agenda.');
      return;
    }

    const offEntries = offDates.map(d => ({ date: d, hours: 0, is_day_off: true, description: 'Folga' }));
    const finalDates = [...workDates, ...offEntries].sort((a, b) => a.date.localeCompare(b.date));

    const result = await checkConsultantConflicts(consultantId, workDates, projectId);
    if (result.hasConflicts) {
      setPendingConfig({ dates: finalDates, config });
      setConflictInfo(result);
      return;
    }
    await applySchedule(finalDates, config);
  };

  const handleGenerateNew = async () => {
    if (schedules.length === 0) {
      // First time: se há schedule_config (vinda do PDF de Políticas Públicas ou de consultoria agrupada)
      const scheduleConfig = project?.schedule_config;
      if (scheduleConfig && scheduleConfig.length > 0) {
        // Normalizar data helper
        const normalizeDate = (dateStr) => {
          if (!dateStr) return null;
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts[2]?.length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return dateStr;
        };

        // Para Políticas Públicas: precisamos incluir os dias de folga (gap entre fases)
        // Construir lista completa de datas: fases + dias intermediários sem atividade (folgas)
        if (project.project_type === 'public_policies') {
          // Para Políticas Públicas: cada entrada do scheduleConfig é uma fase individual
          // Múltiplas fases podem ter a mesma data — CADA UMA vira um registro separado
          const allDates = scheduleConfig
            .filter(r => !r.isDayOff && r.date)
            .map(r => ({
              date: normalizeDate(r.date),
              hours: parseFloat(r.hours) || 0,
              phase_value: r.phase_value ?? undefined,
              description: r.activity || '',
              is_day_off: false,
            }))
            .filter(r => r.date);

          if (allDates.length === 0) {
            alert('Nenhuma fase com data encontrada no cronograma.');
            return;
          }

          const result = await checkConsultantConflicts(consultantId, allDates, projectId);
          if (result.hasConflicts) {
            setPendingConfig({ dates: allDates, config: project });
            setConflictInfo(result);
            return;
          }
          await applySchedule(allDates, project);
          return;
        }

        // Para outros tipos com schedule_config (consultoria agrupada ou com folgas confirmadas)
        const datesFromConfig = scheduleConfig
          .map(r => {
            const dateStr = normalizeDate(r.date);
            return {
              date: dateStr,
              hours: parseFloat(r.hours) || 0,
              phase_value: r.phase_value != null ? r.phase_value : undefined,
              is_day_off: r.isDayOff || false,
              description: r.activity || '',
              modality: r.modality || '',
              delivery: r.delivery || '',
            };
          })
          .filter(r => r.date);

        if (datesFromConfig.length > 0) {
          // Validar: se as horas do config não batem com estimated_hours, usar fallback de auto-geração
          const configWorkHours = datesFromConfig.filter(d => !d.is_day_off).reduce((s, d) => s + (d.hours || 0), 0);
          const estimatedHours = parseFloat(project.estimated_hours) || 0;
          const configIsValid = estimatedHours === 0 || Math.abs(configWorkHours - estimatedHours) <= 0.5;

          if (configIsValid) {
            const offDateSet = new Set(datesFromConfig.filter(d => d.is_day_off).map(d => d.date));
            const workOnlyDates = datesFromConfig.filter(d => !d.is_day_off && !offDateSet.has(d.date));
            const result = await checkConsultantConflicts(consultantId, workOnlyDates, projectId);
            if (result.hasConflicts) {
              setPendingConfig({ dates: datesFromConfig, config: project });
              setConflictInfo(result);
              return;
            }
            await applySchedule(datesFromConfig, project);
            return;
          }
          // config inválido: cai no fallback abaixo
        }
      }

      // Fallback: gerar datas automaticamente, respeitando dias de folga do projeto
      const autoSkipDates = computeAutoSkipDates(project);
      const dates = generateScheduleDates(project, autoSkipDates);
      if (dates.length === 0) {
        setConfigModalOpen(true);
        return;
      }
      const offEntries = [...autoSkipDates].map(d => ({ date: d, hours: 0, is_day_off: true, description: 'Folga' }));
      const allDates = [...dates, ...offEntries].sort((a, b) => a.date.localeCompare(b.date));
      const result = await checkConsultantConflicts(consultantId, dates, projectId);
      if (result.hasConflicts) {
        setPendingConfig({ dates: allDates, config: project });
        setConflictInfo(result);
        return;
      }
      await applySchedule(allDates, project);
    } else {
      // Regenerating: open config modal
      setConfigModalOpen(true);
    }
  };

  const handleConflictProceedAnyway = async () => {
    if (!pendingConfig) return;
    setConflictInfo(null);
    await applySchedule(pendingConfig.dates, pendingConfig.config);
    setPendingConfig(null);
  };

  const handleConflictUseNewDate = async (newStartDate) => {
    if (!pendingConfig) return;

    const normalizeDate = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts[2]?.length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    };

    const scheduleConfig = project?.schedule_config;
    const newConfig = { ...pendingConfig.config, start_date: newStartDate };

    // Se há schedule_config com datas editadas (folgas confirmadas), deslocar todas as datas
    // pelo mesmo offset para preservar as folgas editadas
    if (scheduleConfig && scheduleConfig.length > 0 && project?.project_type !== 'public_policies') {
      const datesFromConfig = scheduleConfig
        .map(r => ({
          date: normalizeDate(r.date),
          hours: parseFloat(r.hours) || 0,
          phase_value: r.phase_value != null ? r.phase_value : undefined,
          is_day_off: r.isDayOff || false,
          description: r.activity || '',
        }))
        .filter(r => r.date);

      if (datesFromConfig.length > 0) {
        // Calcular offset em dias entre a primeira data do config e a nova data de início
        const origFirstDate = new Date(datesFromConfig[0].date + 'T12:00:00');
        const newFirstDate = new Date(newStartDate + 'T12:00:00');
        const dayOffsetMs = newFirstDate - origFirstDate;
        const dayOffset = Math.round(dayOffsetMs / (1000 * 60 * 60 * 24));

        // Aplicar o offset a todas as datas preservando as folgas editadas
        const shiftedDates = datesFromConfig.map(d => ({
          ...d,
          date: addDays(new Date(d.date + 'T12:00:00'), dayOffset).toISOString().split('T')[0],
        }));

        setConflictInfo(null);
        setPendingConfig(null);
        await applySchedule(shiftedDates, newConfig);
        return;
      }
    }

    // Fallback: gerar datas automaticamente, respeitando dias de folga
    const autoSkip = computeAutoSkipDates(newConfig);
    const newWorkDates = generateScheduleDates(newConfig, autoSkip);
    const newOffEntries = [...autoSkip].map(d => ({ date: d, hours: 0, is_day_off: true, description: 'Folga' }));
    const newFinalDates = [...newWorkDates, ...newOffEntries].sort((a, b) => a.date.localeCompare(b.date));
    setConflictInfo(null);
    setPendingConfig(null);
    await applySchedule(newFinalDates, newConfig);
  };

  const handleComplete = async (session) => {
    await updateMutation.mutateAsync({ id: session.id, data: { ...session, status: 'completed' } });

    // Use local schedules data to avoid extra API calls (rate limit prevention)
    const updatedLocally = schedules.map(s => s.id === session.id ? { ...s, status: 'completed' } : s);
    const active = updatedLocally.filter(s => s.status !== 'cancelled');
    const done = updatedLocally.filter(s => s.status === 'completed');
    const prog = active.length > 0 ? Math.round((done.length / active.length) * 100) : 0;

    // Usar o phase_value armazenado na fase (calculado no atendimento)
    // Fallback proporcional apenas para fases antigas sem phase_value
    let phaseAmount = 0;
    if (session.phase_value != null && session.phase_value > 0) {
      phaseAmount = session.phase_value;
    } else {
      const contractedVal = project?.contracted_value || 0;
      if (contractedVal > 0 && totalHoursScheduled > 0) {
        const sessionHours = parseFloat(session.hours) || 0;
        phaseAmount = Math.round((contractedVal * sessionHours / totalHoursScheduled) * 100) / 100;
      } else if (project?.hourly_rate && session.hours > 0) {
        phaseAmount = (parseFloat(session.hours) || 0) * (project.hourly_rate || 0);
      }
    }

    // Label da fase igual ao exibido na agenda: "Fase N"
    const phaseIndex = sortedSchedules.findIndex(s => s.id === session.id);
    const phaseLabel = `Fase ${phaseIndex + 1} — ${session.date ? new Date(session.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}`;

    if (phaseAmount > 0) {
      const existingBillings = await api.entities.BillingEntry.filter({ phase_id: session.id });
      if (existingBillings.length === 0) {
        await api.entities.BillingEntry.create({
          project_id: projectId,
          phase_id: session.id,
          amount: phaseAmount,
          hours: parseFloat(session.hours) || 0,
          status: 'to_bill',
          description: `${phaseLabel} — ${project?.name || 'Projeto'}`,
          phase_date: session.date,
        });
        queryClient.invalidateQueries({ queryKey: ['billings'] });
      }
    }

    // Auto-complete project if all phases are done
    if (active.length > 0 && done.length === active.length) {
      updateProjectMutation.mutate({ progress: 100, status: 'completed' });
    } else {
      updateProjectMutation.mutate({ progress: prog });
    }
  };

  const handleReopen = async (session) => {
    await updateMutation.mutateAsync({ id: session.id, data: { ...session, status: 'scheduled', approved: false } });
    // Use local schedules data to avoid extra API calls (rate limit prevention)
    const updatedLocally = schedules.map(s => s.id === session.id ? { ...s, status: 'scheduled' } : s);
    const total = updatedLocally.filter(s => s.status !== 'cancelled').length;
    const done = updatedLocally.filter(s => s.status === 'completed').length;
    const prog = total > 0 ? Math.round((done / total) * 100) : 0;
    updateProjectMutation.mutate({ progress: prog });
  };

  const handleApprove = (session) => {
    updateMutation.mutate({ id: session.id, data: { ...session, approved: true } });
  };

  const handleUpdate = (session) => {
    updateMutation.mutate({ id: session.id, data: session });
  };

  // Sort and deduplicate by id to avoid any rendering duplicates
  const sortedSchedules = [...new Map(schedules.map(s => [s.id, s])).values()]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const activeSchedules = sortedSchedules.filter(s => s.status !== 'cancelled');
  const completedSchedules = sortedSchedules.filter(s => s.status === 'completed');
  const approvedSchedules = sortedSchedules.filter(s => s.status === 'completed' && s.approved);

  const totalHoursScheduled = activeSchedules.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
  const completedHours = completedSchedules.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
  const approvedHours = approvedSchedules.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);

  // Valor por fase: usar phase_value armazenado na fase (calculado no atendimento)
  // Fallback proporcional apenas se phase_value não estiver armazenado (fases antigas)
  const contractedValue = project?.contracted_value || 0;
  const getPhaseValue = (session) => {
    if (session.phase_value != null && session.phase_value > 0) {
      return session.phase_value;
    }
    // fallback para fases antigas sem phase_value
    if (totalHoursScheduled > 0 && contractedValue > 0) {
      return Math.round((contractedValue * (parseFloat(session.hours) || 0) / totalHoursScheduled) * 100) / 100;
    }
    return (parseFloat(session.hours) || 0) * (project?.hourly_rate || 0);
  };

  const producedValue = completedSchedules.reduce((sum, s) => sum + getPhaseValue(s), 0);
  const approvedValue = approvedSchedules.reduce((sum, s) => sum + getPhaseValue(s), 0);
  const progressPercent = activeSchedules.length > 0
    ? Math.round((completedSchedules.length / activeSchedules.length) * 100) : 0;

  const canGenerate = project?.start_date && project?.estimated_hours && project?.hours_per_day;

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Agenda do Projeto</h3>
              <p className="text-sm text-slate-500">Fases cronológicas de execução</p>
            </div>
            <div className="flex items-center gap-2">
              {project?.status === 'planning' && (
                <Button
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  disabled={statusUpdating}
                  onClick={async () => {
                    setStatusUpdating(true);
                    await api.entities.Project.update(projectId, { status: 'in_progress' });
                    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                    setStatusUpdating(false);
                  }}
                >
                  ▶ Iniciar Execução
                </Button>
              )}
              {project?.status === 'in_progress' && (
                <Button
                  variant="outline"
                  className="border-slate-300 text-slate-600 hover:bg-slate-50"
                  disabled={statusUpdating}
                  onClick={async () => {
                    setStatusUpdating(true);
                    await api.entities.Project.update(projectId, { status: 'planning' });
                    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                    setStatusUpdating(false);
                  }}
                >
                  ↩ Voltar para Planejamento
                </Button>
              )}
              <Button onClick={handleGenerateNew} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                <Zap className="w-4 h-4 mr-2" />
                {schedules.length > 0 ? 'Regenerar Agenda' : 'Gerar Agenda Automática'}
              </Button>
            </div>
          </div>

          {!canGenerate && schedules.length === 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              ⚠️ Configure <strong>Data de Início</strong>, <strong>Horas Estimadas</strong> e <strong>Horas por Dia</strong> para gerar a agenda.
            </div>
          )}

          {activeSchedules.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-900">{activeSchedules.length}</p>
                  <p className="text-xs text-slate-500">Total de Fases</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-700">{completedSchedules.length}</p>
                  <p className="text-xs text-slate-500">Concluídas</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-blue-700">R$ {producedValue.toFixed(0)}</p>
                  <p className="text-xs text-slate-500">Valor Produzido</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-purple-700">R$ {approvedValue.toFixed(0)}</p>
                  <p className="text-xs text-slate-500">Valor Aprovado</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 font-medium">Progresso do Projeto</span>
                  <span className="font-bold text-slate-900">{progressPercent}% ({completedSchedules.length}/{activeSchedules.length} fases)</span>
                </div>
                <Progress value={progressPercent} className="h-3" />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>{completedHours.toFixed(1)}h realizadas de {totalHoursScheduled.toFixed(1)}h</span>
                  <span>{approvedSchedules.length} fase(s) aprovada(s) → R$ {approvedValue.toFixed(2)} a receber</span>
                </div>
              </div>
            </>
          )}

          {sortedSchedules.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhuma fase gerada</p>
              <p className="text-sm mt-1">Clique em "Gerar Agenda Automática" para criar as fases</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSchedules.map((session, index) => (
                <PhaseCard
                  key={session.id}
                  session={session}
                  phaseNumber={index + 1}
                  onUpdate={handleUpdate}
                  onComplete={handleComplete}
                  onReopen={handleReopen}
                  phaseValue={getPhaseValue(session)}
                  updating={updateMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ScheduleConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        project={project}
        onGenerate={handleGenerateFromConfig}
      />

      <ConsultantConflictModal
        open={!!conflictInfo}
        onClose={() => { setConflictInfo(null); setPendingConfig(null); }}
        onProceedAnyway={handleConflictProceedAnyway}
        onUseNewDate={handleConflictUseNewDate}
        conflictInfo={conflictInfo}
      />
    </>
  );
}