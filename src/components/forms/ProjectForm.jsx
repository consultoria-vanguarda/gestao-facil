import React, { useState, useEffect } from 'react';
import { Loader2, X, AlertTriangle, Plus, Trash2, Pencil, Check, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { api } from '@/api/appApi';
import { SERVICE_AREAS, getSubareas } from '../utils/serviceAreas';
import { getConsultingHourlyRate, getDiagnosticRate } from '../utils/hourlyRateTables';
import { format } from 'date-fns';
import MoneyInput from "@/components/ui/MoneyInput";
import PhoneInput from "@/components/ui/PhoneInput";
import { parseMoneyBRToNumber, validateISODate, validatePhone } from "@/lib/validators";

const TYPE_LABELS = {
  diagnostic: 'Diagnóstico',
  consulting: 'Consultoria',
  instructional: 'Instrutoria',
  lecture: 'Palestra',
  public_policies: 'Políticas Públicas',
  other: 'Outro'
};

const emptyForm = {
  client_id: '', consultant_id: '', project_type: '',
  area: '', subarea: '', custom_area: '', custom_subarea: '',
  objective: '', client_needs: '', service_detail: '', produto_final: '',
  activities: [],
  activity_groups: {}, // { groupId: [{ activityIdx, hours }] }
  schedule_config: [], // [{ date, activityIdx, hours, modality, delivery }]
  km_rodado: '', start_date: '', hours_per_day: '4',
  consider_sundays: 'no', consider_holidays: 'no',
  days_off: '0', days_off_position: 'end',
  estimated_hours: '', contracted_value: '', hourly_rate: '',
  subsidy_percent: '70', payment_method: '',
  sebrae_manager_name: '', sebrae_manager_phone: '',
  sebrae_regional_name: 'Cleber Chagas', sebrae_regional_phone: '(61)3601-5300',
  status: 'planning', notes: ''
};

function RichTextArea({ name, value, onChange, rows = 4, style, placeholder, inputRef }) {
  const applyFormat = (marker) => {
    const el = inputRef?.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const wrapped = `${marker}${selected}${marker}`;
    onChange({
      target: {
        name,
        value: `${before}${wrapped}${after}`,
      },
    });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + marker.length, end + marker.length);
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
        <button
          type="button"
          onClick={() => applyFormat('**')}
          title="Negrito"
          style={{
            border: '1px solid #cbd5e1',
            backgroundColor: 'white',
            borderRadius: '4px',
            padding: '2px 8px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => applyFormat('*')}
          title="Itálico"
          style={{
            border: '1px solid #cbd5e1',
            backgroundColor: 'white',
            borderRadius: '4px',
            padding: '2px 8px',
            fontStyle: 'italic',
            cursor: 'pointer',
          }}
        >
          I
        </button>
      </div>
      <textarea
        ref={inputRef}
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        style={style}
        placeholder={placeholder}
      />
    </div>
  );
}

function isHoliday(date) {
  const holidays = ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25'];
  const md = `${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  return holidays.includes(md);
}

// skipDates: Set of yyyy-MM-dd dates to skip (explicit off days)
function generateScheduleRows(formData, activities, skipDates = new Set()) {
  const { start_date, hours_per_day, consider_sundays, consider_holidays, days_off, days_off_position } = formData;
  if (!start_date || !hours_per_day || activities.length === 0) return [];

  const hpd = parseFloat(hours_per_day) || 4;
  const daysOffCount = parseInt(days_off) || 0;

  // Flatten activities into day slots with correct hour distribution
  const activityDays = [];
  activities.forEach((act) => {
    const numDays = act.days ? Math.max(1, parseInt(act.days)) : Math.ceil((parseFloat(act.hours) || 0) / hpd);
    const totalHrs = parseFloat(act.hours) || hpd;
    const totalInt = Math.round(totalHrs);
    const baseH = Math.floor(totalInt / numDays);
    const extraDays = totalInt % numDays;
    for (let d = 0; d < numDays; d++) {
      activityDays.push({
        activity: act.description,
        hours: baseH + (d < extraDays ? 1 : 0),
        modality: act.modality || '',
        delivery: act.delivery || '',
      });
    }
  });

  // Only insert positional off-day slots when NOT using explicit skipDates
  let slots = [...activityDays];
  if (daysOffCount > 0 && skipDates.size === 0) {
    const offSlot = { activity: 'FOLGA', hours: 0, isDayOff: true };
    const offSlots = Array(daysOffCount).fill(null).map(() => ({ ...offSlot }));
    if (days_off_position === 'start') slots = [...offSlots, ...slots];
    else if (days_off_position === 'middle') {
      const mid = Math.floor(slots.length / 2);
      slots = [...slots.slice(0, mid), ...offSlots, ...slots.slice(mid)];
    } else slots = [...slots, ...offSlots];
  }

  // Assign dates, skipping weekends/holidays AND explicit off dates
  const rows = [];
  let current = new Date(start_date + 'T12:00:00');
  for (const slot of slots) {
    while (true) {
      const dow = current.getDay();
      const skipSunday = dow === 0 && consider_sundays !== 'yes';
      const skipHoliday = consider_holidays !== 'yes' && isHoliday(current);
      const dateStr = current.toISOString().split('T')[0];
      const skipOff = skipDates.has(dateStr);
      if (!skipSunday && !skipHoliday && !skipOff) break;
      current = new Date(current);
      current.setDate(current.getDate() + 1);
    }
    rows.push({ date: format(current, 'dd/MM/yyyy'), ...slot });
    current = new Date(current);
    current.setDate(current.getDate() + 1);
  }
  return rows;
}

export default function ProjectForm({ open, onClose, project, onSave, loading, clients, consultants, serviceModels }) {
  const [formData, setFormData] = useState(emptyForm);
  const [consultantConflicts, setConsultantConflicts] = useState([]);
  const [newActivity, setNewActivity] = useState({ description: '', days: '', hours: '', modality: '', delivery: '' });
  const [editingActivityIdx, setEditingActivityIdx] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);
  const [scheduleRows, setScheduleRows] = useState([]);
  const [nextGroupId, setNextGroupId] = useState(1);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupFormData, setGroupFormData] = useState({});
  const skipAutoCalcRef = React.useRef(false);
  // Days-off confirmation state
  const [daysOffProposal, setDaysOffProposal] = useState(null); // array of { date: 'dd/MM/yyyy' } or null
  const [daysOffConfirmed, setDaysOffConfirmed] = useState(false);

  // Public Policies state
  const [ppArea, setPpArea] = useState('');
  const [ppSubarea, setPpSubarea] = useState('');
  const [ppStartDate, setPpStartDate] = useState('');
  const [ppEndDate, setPpEndDate] = useState('');
  const [ppNumPhases, setPpNumPhases] = useState('');
  const [ppFile, setPpFile] = useState(null);
  const [ppUploading, setPpUploading] = useState(false);
  const [ppParsing, setPpParsing] = useState(false);
  const [ppParsedData, setPpParsedData] = useState(null);
  const [ppParseError, setPpParseError] = useState('');
  const [ppFileUrl, setPpFileUrl] = useState('');
  const objectiveRef = React.useRef(null);
  const needsRef = React.useRef(null);
  const detailRef = React.useRef(null);
  const produtoFinalRef = React.useRef(null);
  const notesRef = React.useRef(null);

  useEffect(() => {
    if (open && project) {
      setFormData({
        client_id: project.client_id || '',
        consultant_id: project.consultant_id || '',
        project_type: project.project_type || '',
        area: project.area || '',
        subarea: project.subarea || '',
        custom_area: project.custom_area || '',
        custom_subarea: project.custom_subarea || '',
        objective: project.objective || '',
        client_needs: project.client_needs || '',
        service_detail: project.service_detail || '',
        produto_final: project.produto_final || '',
        activities: project.activities || [],
        activity_groups: project.activity_groups || {},
        schedule_config: project.schedule_config || [],
        km_rodado: project.km_rodado || '',
        start_date: project.start_date || '',
        hours_per_day: project.hours_per_day || '4',
        consider_sundays: project.consider_sundays || 'no',
        consider_holidays: project.consider_holidays || 'no',
        days_off: project.days_off !== undefined ? String(project.days_off) : '0',
        days_off_position: project.days_off_position || 'end',
        estimated_hours: project.estimated_hours || '',
        contracted_value: project.contracted_value || '',
        hourly_rate: project.hourly_rate || '',
        subsidy_percent: project.subsidy_percent !== undefined ? String(project.subsidy_percent) : '70',
        payment_method: project.payment_method || '',
        sebrae_manager_name: project.sebrae_manager_name || '',
        sebrae_manager_phone: project.sebrae_manager_phone || '',
        sebrae_regional_name: project.sebrae_regional_name || 'Cleber Chagas',
        sebrae_regional_phone: project.sebrae_regional_phone || '(61)3601-5300',
        status: project.status || 'planning',
        notes: project.notes || ''
      });
      setConsultantConflicts([]);
      // Se o projeto já tem schedule_config salvo, restaurar o cronograma e marcar folgas como confirmadas
      if (project.schedule_config && project.schedule_config.length > 0) {
        setScheduleRows(project.schedule_config);
        setDaysOffConfirmed(true);
      } else {
        setDaysOffConfirmed(false);
      }
      // Restaurar nextGroupId baseado em grupos existentes
      const maxGroupNum = Math.max(
        0,
        ...Object.keys(project.activity_groups || {})
          .map(k => parseInt(k.replace('group_', '')) || 0)
      );
      setNextGroupId(maxGroupNum + 1);
    } else if (open && !project) {
      setFormData(emptyForm);
      setConsultantConflicts([]);
      setScheduleRows([]);
      setNextGroupId(1);
    }
  }, [open, project]);

  // Recalculate schedule when relevant fields change
  useEffect(() => {
    if (formData.project_type === 'consulting' && formData.activities.length > 0) {
      const hasGrouping = Object.keys(formData.activity_groups || {}).length > 0;

      if (hasGrouping && formData.schedule_config && formData.schedule_config.length > 0) {
        // Se há agrupamento, usar schedule_config customizado
        setScheduleRows(formData.schedule_config);
      } else if (!hasGrouping) {
        // Se NÃO há agrupamento e folgas estão confirmadas, usar schedule_config salvo
        if (daysOffConfirmed && formData.schedule_config && formData.schedule_config.length > 0) {
          setScheduleRows(formData.schedule_config);
        } else if (!daysOffConfirmed) {
          // Auto-gerar o cronograma somente se folgas não foram confirmadas manualmente
          setScheduleRows(generateScheduleRows(formData, formData.activities));
        }
      }
    }
  }, [formData.start_date, formData.hours_per_day, formData.consider_sundays,
      formData.consider_holidays, formData.days_off, formData.days_off_position,
      formData.activities, formData.project_type, formData.schedule_config, formData.activity_groups,
      daysOffConfirmed]);

  // Auto-calculate estimated hours from activities
  useEffect(() => {
    if (formData.activities.length > 0) {
      const total = formData.activities.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
      if (total > 0) setFormData(prev => ({ ...prev, estimated_hours: String(total) }));
    }
  }, [formData.activities]);

  // Auto-calculate contracted value from table
  // IMPORTANT: If project has activity_groups, update contracted_value with calculatedTotalFromBreakdown
  // This effect runs when groups change to keep contracted_value in sync for display purposes
  useEffect(() => {
    if (Object.keys(formData.activity_groups || {}).length > 0) {
      // Recalculate total from breakdown and update contracted_value
      const km = parseFloat(formData.km_rodado) || 0;
      if (km > 0 && formData.activities.length > 0) {
        const usedActivityHours = {};
        let total = 0;
        for (const entries of Object.values(formData.activity_groups || {})) {
          const groupHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
          if (groupHours > 0) {
            const rate = getConsultingHourlyRate(km, groupHours);
            if (rate) total += Math.round(rate * groupHours * 100) / 100;
            entries.forEach(e => { usedActivityHours[e.activityIdx] = (usedActivityHours[e.activityIdx] || 0) + e.hours; });
          }
        }
        formData.activities.forEach((act, idx) => {
          const remaining = (parseFloat(act.hours) || 0) - (usedActivityHours[idx] || 0);
          if (remaining > 0) {
            const rate = getConsultingHourlyRate(km, remaining);
            if (rate) total += Math.round(rate * remaining * 100) / 100;
          }
        });
        if (total > 0) {
          setFormData(prev => ({ ...prev, contracted_value: String(Math.round(total * 100) / 100) }));
        }
      }
      return;
    }

    if (formData.project_type === 'consulting') {
      const km = parseFloat(formData.km_rodado) || 0;
      if (formData.activities.length > 0 && km > 0) {
        // Per-activity calculation: each activity's total hours → rate → value
        let totalValue = 0;
        let representativeRate = null;
        for (const act of formData.activities) {
          const actHours = parseFloat(act.hours) || 0;
          if (actHours > 0) {
            const rate = getConsultingHourlyRate(km, actHours);
            if (rate) {
              totalValue += rate * actHours;
              if (!representativeRate) representativeRate = rate;
            }
          }
        }
        if (totalValue > 0) {
          setFormData(prev => ({
            ...prev,
            hourly_rate: representativeRate ? String(representativeRate) : prev.hourly_rate,
            contracted_value: String(Math.round(totalValue * 100) / 100)
          }));
          return;
        }
      }
      // Fallback: use total hours when no per-activity km-based calc available
      const hours = parseFloat(formData.estimated_hours) || 0;
      const km2 = parseFloat(formData.km_rodado) || 0;
      if (hours > 0 && km2 > 0) {
        const rate = getConsultingHourlyRate(km2, hours);
        if (rate) {
          setFormData(prev => ({
            ...prev,
            hourly_rate: String(rate),
            contracted_value: String(rate * hours)
          }));
        }
      }
    }
    if (formData.project_type === 'diagnostic') {
      const km = parseFloat(formData.km_rodado) || 0;
      const rate = getDiagnosticRate(km);
      if (rate) {
        setFormData(prev => ({ ...prev, contracted_value: String(rate) }));
      }
    }
  }, [formData.km_rodado, formData.estimated_hours, formData.project_type, formData.activities, formData.activity_groups, formData.hours_per_day]);

  // Check consultant availability
  useEffect(() => {
    const { consultant_id, start_date } = formData;
    if (!consultant_id || !start_date) { setConsultantConflicts([]); return; }

    Promise.all([
      api.entities.ProjectSchedule.filter({ consultant_id }),
      api.entities.Project.filter({ consultant_id })
    ]).then(([schedules, projects]) => {
      const activeProjectIds = new Set(projects.map(p => p.id));
      const conflicts = schedules.filter(s =>
        s.status !== 'cancelled' &&
        s.date && s.date >= start_date &&
        activeProjectIds.has(s.project_id)
      );
      setConsultantConflicts(conflicts);
    });
  }, [formData.consultant_id, formData.start_date]);

  // Generate proposed off-day dates based on position/count
  const generateDaysOffProposal = (updatedFormData) => {
    const { start_date, hours_per_day, consider_sundays, consider_holidays, days_off, days_off_position, activities } = updatedFormData;
    if (!start_date || !activities || activities.length === 0) return null;
    const daysOffCount = parseInt(days_off) || 0;
    if (daysOffCount === 0) return null;

    const hpd = parseFloat(hours_per_day) || 4;
    const activityDays = [];
    activities.forEach((act) => {
      const numDays = act.days ? Math.max(1, parseInt(act.days)) : Math.ceil((parseFloat(act.hours) || 0) / hpd);
      for (let d = 0; d < numDays; d++) activityDays.push({});
    });
    const totalWorkDays = activityDays.length;

    // Calculate off-day positions in the slot sequence
    let offPositions = [];
    if (days_off_position === 'start') {
      offPositions = Array.from({ length: daysOffCount }, (_, i) => i);
    } else if (days_off_position === 'middle') {
      const mid = Math.floor(totalWorkDays / 2);
      offPositions = Array.from({ length: daysOffCount }, (_, i) => mid + i);
    } else {
      offPositions = Array.from({ length: daysOffCount }, (_, i) => totalWorkDays + i);
    }

    const totalSlots = totalWorkDays + daysOffCount;
    let current = new Date(start_date + 'T12:00:00');
    const proposal = [];
    let slotIdx = 0;
    for (let s = 0; s < totalSlots; s++) {
      while (true) {
        const dow = current.getDay();
        const skipSunday = dow === 0 && consider_sundays !== 'yes';
        const skipHoliday = consider_holidays !== 'yes' && isHoliday(current);
        if (!skipSunday && !skipHoliday) break;
        current = new Date(current);
        current.setDate(current.getDate() + 1);
      }
      if (offPositions.includes(slotIdx)) {
        proposal.push({ date: format(current, 'yyyy-MM-dd'), displayDate: format(current, 'dd/MM/yyyy') });
      }
      slotIdx++;
      current = new Date(current);
      current.setDate(current.getDate() + 1);
    }
    return proposal;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'consultant_id') {
      setFormData(prev => ({ ...prev, [name]: value, area: '', subarea: '' }));
    } else if (name === 'days_off' || name === 'days_off_position') {
      const updatedFormData = { ...formData, [name]: value, schedule_config: [] };
      setFormData(updatedFormData);
      setDaysOffConfirmed(false);
      // Generate proposal for days off dates
      if (parseInt(name === 'days_off' ? value : formData.days_off) > 0) {
        const proposal = generateDaysOffProposal(updatedFormData);
        setDaysOffProposal(proposal);
      } else {
        setDaysOffProposal(null);
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDaysOffDateChange = (idx, newDate) => {
    setDaysOffProposal(prev => prev.map((d, i) => i === idx ? { date: newDate, displayDate: newDate.split('-').reverse().join('/') } : d));
  };

  const handleConfirmDaysOff = () => {
    if (!daysOffProposal) return;

    // Build off-day rows using the confirmed (possibly edited) dates from proposal
    const offRows = daysOffProposal.map(d => ({
      date: d.displayDate,
      activity: 'FOLGA',
      hours: 0,
      isDayOff: true,
      modality: '',
      delivery: '',
    }));

    // Build skipDates set (yyyy-MM-dd) to pass to generateScheduleRows
    const skipDates = new Set(daysOffProposal.map(d => d.date)); // d.date is yyyy-MM-dd

    // Regenerate work rows, skipping the off-day dates so all work slots are preserved
    const workRows = generateScheduleRows({ ...formData, days_off: '0' }, formData.activities, skipDates);

    // Merge and sort
    const parseRowDate = (dateStr) => {
      if (!dateStr) return new Date(0);
      if (dateStr.includes('/')) {
        const [dd, mm, yyyy] = dateStr.split('/');
        return new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
      }
      return new Date(dateStr + 'T12:00:00');
    };
    const merged = [...workRows, ...offRows].sort((a, b) => parseRowDate(a.date) - parseRowDate(b.date));

    setScheduleRows(merged);
    setFormData(prev => ({ ...prev, schedule_config: merged }));
    setDaysOffConfirmed(true);
    setDaysOffProposal(null);
  };

  const handleAddActivity = () => {
    if (!newActivity.description) return;
    const newActivityId = formData.activities.length;
    setFormData(prev => ({
      ...prev,
      activities: [...prev.activities, { ...newActivity, id: newActivityId }]
    }));
    setNewActivity({ description: '', days: '', hours: '', modality: '', delivery: '' });
  };

  const handleOpenGroupModal = () => {
    setGroupFormData({});
    setGroupModalOpen(true);
  };

  const handleAddGroup = () => {
    const groupEntries = Object.entries(groupFormData).map(([idx, hours]) => ({
      activityIdx: parseInt(idx),
      hours: parseFloat(hours) || 0
    })).filter(e => e.hours > 0);

    if (groupEntries.length < 1) {
      alert('Selecione pelo menos uma atividade');
      return;
    }

    // Validar se as horas não ultrapassam o disponível
    for (const entry of groupEntries) {
      const activity = formData.activities[entry.activityIdx];
      if (!activity) continue;
      const activityTotal = parseFloat(activity.hours) || 0;
      const alreadyGrouped = Object.values(formData.activity_groups || {}).reduce((sum, group) => {
        const groupPart = group.find(g => g.activityIdx === entry.activityIdx);
        return sum + (groupPart ? groupPart.hours : 0);
      }, 0);
      if (alreadyGrouped + entry.hours > activityTotal) {
        alert(`Atividade ${entry.activityIdx + 1}: apenas ${activityTotal - alreadyGrouped}h disponível(eis)`);
        return;
      }
    }

    const groupId = `group_${nextGroupId}`;
    setNextGroupId(prev => prev + 1);
    setFormData(prev => ({
      ...prev,
      activity_groups: {
        ...prev.activity_groups,
        [groupId]: groupEntries
      }
    }));
    setGroupModalOpen(false);
    setGroupFormData({});
  };

  const handleUnGroupActivities = (groupId) => {
    setFormData(prev => {
      const newGroups = { ...prev.activity_groups };
      delete newGroups[groupId];
      return { ...prev, activity_groups: newGroups };
    });
  };

  const getActivityGroupsHours = (actIdx) => {
    // Retorna total de horas já agrupadas dessa atividade
    let total = 0;
    for (const group of Object.values(formData.activity_groups || {})) {
      const part = group.find(g => g.activityIdx === actIdx);
      if (part) total += part.hours;
    }
    return total;
  };

  const getActivityUsedHours = (actIdx) => {
    const activity = formData.activities[actIdx];
    const totalHours = parseFloat(activity.hours) || 0;
    const usedHours = getActivityGroupsHours(actIdx);
    return totalHours - usedHours;
  };

  const handleActivityFieldChange = (idx, field, value) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.map((a, i) => i === idx ? { ...a, [field]: value } : a)
    }));
  };

  const handleRemoveActivity = (idx) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.filter((_, i) => i !== idx)
    }));
  };

  const handleStartEditActivity = (idx) => {
    setEditingActivityIdx(idx);
    setEditingActivity({ ...formData.activities[idx] });
  };

  const handleSaveEditActivity = () => {
    if (!editingActivity.description) return;
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.map((a, i) => i === editingActivityIdx ? { ...editingActivity } : a)
    }));
    setEditingActivityIdx(null);
    setEditingActivity(null);
  };

  const handleCancelEditActivity = () => {
    setEditingActivityIdx(null);
    setEditingActivity(null);
  };

  const handleScheduleDeliveryChange = (idx, value) => {
    const updatedRows = scheduleRows.map((r, i) => i === idx ? { ...r, delivery: value } : r);
    setScheduleRows(updatedRows);
    // Persist to schedule_config
    setFormData(prev => ({ ...prev, schedule_config: updatedRows }));
  };

  const handleScheduleDateChange = (idx, newDate) => {
    const updatedRows = scheduleRows.map((r, i) => i === idx ? { ...r, date: newDate } : r);
    setScheduleRows(updatedRows);
    // Persist to schedule_config
    setFormData(prev => ({ ...prev, schedule_config: updatedRows }));
  };

  const handleScheduleActivityChange = (idx, activityIdx) => {
    const activity = formData.activities[activityIdx];
    const updatedRows = scheduleRows.map((r, i) => 
      i === idx ? { ...r, activity: activity.description || `Atividade ${activityIdx + 1}`, activityIdx } : r
    );
    setScheduleRows(updatedRows);
    setFormData(prev => ({ ...prev, schedule_config: updatedRows }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.client_id || !formData.consultant_id || !formData.start_date || !formData.project_type) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    if (!validateISODate(formData.start_date)) {
      alert('Informe uma data de início válida.');
      return;
    }
    if (isConsulting && (!formData.sebrae_manager_name || !formData.sebrae_manager_phone)) {
      alert('Informe o Gestor Responsável (nome e telefone)');
      return;
    }
    if (isConsulting && formData.sebrae_manager_phone && !validatePhone(formData.sebrae_manager_phone)) {
      alert('Informe um telefone válido para o Gestor Responsável.');
      return;
    }
    if (isConsulting && formData.sebrae_regional_phone && !validatePhone(formData.sebrae_regional_phone)) {
      alert('Informe um telefone válido para o Gerente Regional.');
      return;
    }

    const selectedClient = clients?.find(c => c.id === formData.client_id);
    const dateStr = formData.start_date ? new Date(formData.start_date + 'T12:00:00').toLocaleDateString('pt-BR') : '';
    const autoName = selectedClient ? `${selectedClient.company_name} - ${dateStr}` : dateStr;

    // Usar o valor calculado pelo breakdown de grupos quando disponível
    const contractedFieldValue = parseMoneyBRToNumber(formData.contracted_value);
    if (calculatedTotalFromBreakdown <= 0 && (!Number.isFinite(contractedFieldValue) || contractedFieldValue < 0)) {
      alert('Informe um Valor Contratado (R$) válido.');
      return;
    }
    const finalContractedValue = calculatedTotalFromBreakdown > 0
      ? calculatedTotalFromBreakdown
      : (Number.isFinite(contractedFieldValue) ? contractedFieldValue : 0);

    // Calcular phase_value para cada fase do schedule_config
    // Se há agrupamentos: cada fase (linha do cronograma) corresponde a um grupo ou atividade individual
    // O valor de cada fase é calculado com base nas horas e no valor/hora correspondente
    // Se schedule_config está vazio mas scheduleRows tem dados, usar scheduleRows (garante que folgas confirmadas sejam persistidas)
    let enrichedScheduleConfig = (formData.schedule_config && formData.schedule_config.length > 0)
      ? formData.schedule_config
      : scheduleRows;
    if (isConsulting && formData.schedule_config && formData.schedule_config.length > 0 && formData.km_rodado) {
      const km = parseFloat(formData.km_rodado) || 0;
      const hasGrouping = Object.keys(formData.activity_groups || {}).length > 0;

      if (hasGrouping) {
        // Com agrupamento: calcular valor de cada fase baseado nas horas da fase e taxa correspondente
        // Cada fase no schedule_config tem horas → buscar taxa → calcular valor
        const phaseValues = formData.schedule_config
          .filter(r => !r.isDayOff)
          .map(r => {
            const hours = parseFloat(r.hours) || 0;
            const rate = getConsultingHourlyRate(km, hours);
            return rate ? Math.round(rate * hours * 100) / 100 : 0;
          });

        // Ajuste na última fase para fechar o total exato
        const sumWithoutLast = phaseValues.slice(0, -1).reduce((s, v) => s + v, 0);
        const lastPhaseValue = Math.round((finalContractedValue - sumWithoutLast) * 100) / 100;
        if (phaseValues.length > 0) phaseValues[phaseValues.length - 1] = Math.max(0, lastPhaseValue);

        let valueIdx = 0;
        enrichedScheduleConfig = formData.schedule_config.map(r => {
          if (r.isDayOff) return r;
          const pv = phaseValues[valueIdx++] || 0;
          return { ...r, phase_value: pv };
        });
      } else {
        // Sem agrupamento: distribuição proporcional por horas
        const totalH = enrichedScheduleConfig.filter(r => !r.isDayOff).reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
        if (totalH > 0) {
          const phaseValues = enrichedScheduleConfig
            .filter(r => !r.isDayOff)
            .map(r => Math.round((finalContractedValue * (parseFloat(r.hours) || 0) / totalH) * 100) / 100);
          const sumWithoutLast = phaseValues.slice(0, -1).reduce((s, v) => s + v, 0);
          if (phaseValues.length > 0) phaseValues[phaseValues.length - 1] = Math.max(0, Math.round((finalContractedValue - sumWithoutLast) * 100) / 100);
          let valueIdx = 0;
          enrichedScheduleConfig = enrichedScheduleConfig.map(r => {
            if (r.isDayOff) return r;
            return { ...r, phase_value: phaseValues[valueIdx++] || 0 };
          });
        }
      }
    }

    const dataToSave = {
      name: autoName,
      client_id: formData.client_id,
      consultant_id: formData.consultant_id,
      project_type: formData.project_type,
      pricing_mode: 'fixed',
      area: formData.area || null,
      subarea: formData.subarea || null,
      custom_area: formData.custom_area || null,
      custom_subarea: formData.custom_subarea || null,
      objective: formData.objective || '',
      client_needs: formData.client_needs || '',
      service_detail: formData.service_detail || '',
      produto_final: formData.produto_final || '',
      activities: formData.activities,
      activity_groups: formData.activity_groups || {},
      km_rodado: parseFloat(formData.km_rodado) || 0,
      start_date: formData.start_date,
      hours_per_day: parseFloat(formData.hours_per_day) || 4,
      consider_sundays: formData.consider_sundays,
      consider_holidays: formData.consider_holidays,
      days_off: parseInt(formData.days_off) || 0,
      days_off_position: formData.days_off_position,
      estimated_hours: parseFloat(formData.estimated_hours) || 0,
      contracted_value: finalContractedValue,
      hourly_rate: parseMoneyBRToNumber(formData.hourly_rate) || 0,
      subsidy_percent: parseFloat(formData.subsidy_percent) || 70,
      payment_method: 'avista_cartao',
      sebrae_manager_name: formData.sebrae_manager_name || '',
      sebrae_manager_phone: formData.sebrae_manager_phone || '',
      sebrae_regional_name: formData.sebrae_regional_name || '',
      sebrae_regional_phone: formData.sebrae_regional_phone || '',
      status: formData.status,
      notes: formData.notes || '',
      schedule_generated: false,
      schedule_config: enrichedScheduleConfig
    };

    onSave(dataToSave);
  };

  const isPublicPolicies = formData.project_type === 'public_policies';

  const handlePpFileChange = (e) => {
    const f = e.target.files[0];
    if (f) setPpFile(f);
  };

  const handlePpUploadAndParse = async () => {
    if (!ppFile) return;
    setPpUploading(true);
    setPpParseError('');
    setPpParsedData(null);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file: ppFile });
      setPpFileUrl(file_url);
      setPpUploading(false);
      setPpParsing(true);
      const response = await api.functions.invoke('parsePublicPoliciesPdf', {
        file_url,
        num_phases: ppNumPhases ? parseInt(ppNumPhases) : undefined,
      });
      const result = response.data;
      if (result.success && result.data) {
        setPpParsedData(result.data);
      } else {
        setPpParseError(result.error || 'Erro ao processar o arquivo.');
      }
    } catch (err) {
      setPpParseError('Erro ao fazer upload ou processar o arquivo.');
    } finally {
      setPpUploading(false);
      setPpParsing(false);
    }
  };

  const handlePpCreate = () => {
    if (!formData.consultant_id || !ppParsedData) return;
    if (ppStartDate && !validateISODate(ppStartDate)) {
      alert('Informe uma Data Inicial válida (Políticas Públicas).');
      return;
    }
    if (ppEndDate && !validateISODate(ppEndDate)) {
      alert('Informe uma Data Final válida (Políticas Públicas).');
      return;
    }
    if (ppStartDate && ppEndDate) {
      const startDt = new Date(ppStartDate + 'T12:00:00');
      const endDt = new Date(ppEndDate + 'T12:00:00');
      if (endDt.getTime() < startDt.getTime()) {
        alert('A Data Final deve ser maior ou igual à Data Inicial.');
        return;
      }
    }
    const phases = ppParsedData.phases || [];
    const sortedPhases = [...phases].sort((a, b) => (a.phase_number || 0) - (b.phase_number || 0));
    const firstPhaseDate = sortedPhases.find(p => p.start_date)?.start_date;
    const lastPhaseDate = [...sortedPhases].reverse().find(p => p.start_date)?.start_date;
    const finalStartDate = ppStartDate || firstPhaseDate || new Date().toISOString().split('T')[0];
    const finalEndDate = ppEndDate || lastPhaseDate || finalStartDate;
    const totalValue = sortedPhases.reduce((sum, p) => sum + (p.value || 0), 0);
    const scheduleConfig = sortedPhases.map(p => ({
      date: p.start_date || finalStartDate,
      activity: p.description || `Fase ${p.phase_number}`,
      hours: p.hours || 0,
      phase_value: p.value || 0,
      modality: p.type === 'PRESENCIAL' ? 'Presencial' : 'Remota',
      delivery: '',
      isDayOff: false,
    }));
    const projectData = {
      name: ppParsedData.project_name || 'Políticas Públicas',
      consultant_id: formData.consultant_id,
      client_id: null,
      project_type: 'public_policies',
      area: ppArea || null,
      subarea: ppSubarea || null,
      start_date: finalStartDate,
      end_date: finalEndDate,
      contracted_value: totalValue || ppParsedData.total_value || 0,
      estimated_hours: ppParsedData.total_hours || 0,
      status: 'planning',
      schedule_generated: false,
      schedule_config: scheduleConfig,
      proposal_file_url: ppFileUrl,
      public_policies_data: ppParsedData,
      pricing_mode: 'fixed',
      hours_per_day: 6,
      days_off: 0,
      subsidy_percent: 0,
    };
    onSave(projectData);
  };

  if (!open) return null;

  const selectedClient = clients?.find(c => c.id === formData.client_id);
  const isConsulting = formData.project_type === 'consulting';
  const isDiagnostic = formData.project_type === 'diagnostic';

  const selectedConsultant = consultants?.find(c => c.id === formData.consultant_id);
  const consultantAreas = selectedConsultant?.service_areas || [];
  const areaOptions = consultantAreas.length > 0
    ? consultantAreas.map(sa => ({ value: sa.area, label: SERVICE_AREAS[sa.area]?.label || sa.area }))
    : Object.entries(SERVICE_AREAS).map(([k, v]) => ({ value: k, label: v.label }));
  const selectedConsultantArea = consultantAreas.find(sa => sa.area === formData.area);
  const subareasForArea = selectedConsultant && consultantAreas.length > 0 && selectedConsultantArea
    ? selectedConsultantArea.subareas
    : getSubareas(formData.area);

  // Calcular valor total baseado no breakdown (grupos + atividades restantes)
  let calculatedTotalFromBreakdown = 0;
  if (isConsulting && formData.activities.length > 0 && formData.km_rodado) {
    const km = parseFloat(formData.km_rodado) || 0;
    const usedActivityHours = {};
    
    // Somar grupos
    for (const [_, entries] of Object.entries(formData.activity_groups || {})) {
      const groupHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
      if (groupHours > 0) {
        const rate = getConsultingHourlyRate(km, groupHours);
        if (rate) {
          calculatedTotalFromBreakdown += Math.round(rate * groupHours * 100) / 100;
        }
        entries.forEach(e => {
          usedActivityHours[e.activityIdx] = (usedActivityHours[e.activityIdx] || 0) + e.hours;
        });
      }
    }
    
    // Somar atividades não agrupadas
    formData.activities.forEach((act, idx) => {
      const totalActHours = parseFloat(act.hours) || 0;
      const usedHours = usedActivityHours[idx] || 0;
      const remainingHours = totalActHours - usedHours;
      if (remainingHours > 0) {
        const rate = getConsultingHourlyRate(km, remainingHours);
        if (rate) {
          calculatedTotalFromBreakdown += Math.round(rate * remainingHours * 100) / 100;
        }
      }
    });
  }

  // Usar valor calculado se disponível (km + atividades preenchidos), senão usar valor do campo
  const contractedValueFromField = parseMoneyBRToNumber(formData.contracted_value) || 0;
  const contractedValue = calculatedTotalFromBreakdown > 0
    ? calculatedTotalFromBreakdown
    : contractedValueFromField;
  const subsidyPct = parseFloat(formData.subsidy_percent) || 70;
  const subsidyValue = contractedValue * (subsidyPct / 100);
  const clientValue = contractedValue - subsidyValue;

  const inputStyle = {
    width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '14px', backgroundColor: 'white'
  };
  const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 500, color: '#334155', marginBottom: '4px' };
  const sectionStyle = { marginBottom: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' };
  const sectionTitleStyle = { fontSize: '15px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px', borderBottom: '2px solid #1e3a5f', paddingBottom: '8px' };

  return (
    <div>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'white', zIndex: 50, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', zIndex: 10 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e3a5f' }}>
            {project ? 'Editar Atendimento' : 'Novo Atendimento'}
          </h2>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X style={{ width: '22px', height: '22px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>

          {/* TIPO */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Tipo de Atendimento *</label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {Object.entries(TYPE_LABELS).map(([val, label]) => (
                <label key={val} style={{
                  padding: '10px 20px', border: formData.project_type === val ? '2px solid #1e3a5f' : '1px solid #cbd5e1',
                  borderRadius: '8px', cursor: 'pointer', backgroundColor: formData.project_type === val ? '#eff6ff' : 'white',
                  fontSize: '14px', fontWeight: 500, transition: 'all 0.2s'
                }}>
                  <input type="radio" name="project_type" value={val} checked={formData.project_type === val} onChange={handleChange} style={{ marginRight: '6px' }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* PUBLIC POLICIES FORM */}
          {isPublicPolicies && (() => {
            const ppSelectedConsultant = consultants?.find(c => c.id === formData.consultant_id);
            const ppConsultantAreas = ppSelectedConsultant?.service_areas || [];
            const ppAreaOptions = ppConsultantAreas.length > 0
              ? ppConsultantAreas.map(sa => ({ value: sa.area, label: SERVICE_AREAS[sa.area]?.label || sa.area }))
              : Object.entries(SERVICE_AREAS).map(([k, v]) => ({ value: k, label: v.label }));
            const ppSubareasForArea = ppArea ? getSubareas(ppArea) : [];

            return (
              <div>
                {/* Consultor para PP */}
                <div style={{ ...sectionStyle }}>
                  <div style={sectionTitleStyle}>Consultor</div>
                  <select name="consultant_id" value={formData.consultant_id} onChange={handleChange} required style={inputStyle}>
                    <option value="">Selecione um consultor</option>
                    {consultants?.filter(c => c.status === 'active').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Área / Subárea */}
                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}>Área / Subárea</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Área</label>
                      <select value={ppArea} onChange={e => { setPpArea(e.target.value); setPpSubarea(''); }} style={inputStyle}>
                        <option value="">Selecione</option>
                        {ppAreaOptions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Subárea</label>
                      <select value={ppSubarea} onChange={e => setPpSubarea(e.target.value)} style={inputStyle} disabled={!ppArea}>
                        <option value="">Selecione</option>
                        {ppSubareasForArea.map((s, i) => <option key={i} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Configuração */}
                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}>Configuração do Projeto</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Data Inicial</label>
                      <input type="date" value={ppStartDate} onChange={e => setPpStartDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Data Final</label>
                      <input type="date" value={ppEndDate} onChange={e => setPpEndDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Qtd. de Fases</label>
                      <input type="number" min="1" value={ppNumPhases} onChange={e => setPpNumPhases(e.target.value)} placeholder="Ex: 12" style={inputStyle} />
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                    Se as datas não forem preenchidas, serão extraídas automaticamente do documento.
                  </p>
                </div>

                {/* Upload da Proposta */}
                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}>Upload da Proposta (PDF)</div>
                  <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '24px', textAlign: 'center', marginBottom: '12px', backgroundColor: 'white' }}>
                    <input type="file" accept=".pdf" onChange={handlePpFileChange} id="pp-pdf-upload" style={{ display: 'none' }} />
                    <label htmlFor="pp-pdf-upload" style={{ cursor: 'pointer' }}>
                      {ppFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#1e3a5f' }}>
                          <FileText style={{ width: '20px', height: '20px' }} />
                          <span style={{ fontWeight: 600 }}>{ppFile.name}</span>
                        </div>
                      ) : (
                        <div style={{ color: '#94a3b8' }}>
                          <Upload style={{ width: '32px', height: '32px', margin: '0 auto 8px' }} />
                          <p style={{ fontSize: '14px' }}>Clique para selecionar o arquivo PDF da proposta</p>
                        </div>
                      )}
                    </label>
                  </div>
                  {ppFile && !ppParsedData && (
                    <button type="button" onClick={handlePpUploadAndParse} disabled={ppUploading || ppParsing}
                      style={{ width: '100%', padding: '10px', backgroundColor: ppUploading || ppParsing ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', cursor: ppUploading || ppParsing ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      {(ppUploading || ppParsing) && <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
                      {ppUploading ? 'Enviando arquivo...' : ppParsing ? 'Processando proposta com IA...' : 'Processar Proposta'}
                    </button>
                  )}
                  {ppParseError && (
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <AlertCircle style={{ width: '16px', height: '16px', color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                      <p style={{ color: '#b91c1c', fontSize: '13px' }}>{ppParseError}</p>
                    </div>
                  )}
                </div>

                {/* Preview dados extraídos */}
                {ppParsedData && (
                  <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <CheckCircle style={{ width: '18px', height: '18px', color: '#16a34a' }} />
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#15803d' }}>Proposta processada com sucesso!</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
                      <div style={{ backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px' }}>
                        <p style={{ color: '#64748b', marginBottom: '2px' }}>Projeto/Cliente</p>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>{ppParsedData.project_name}</p>
                      </div>
                      <div style={{ backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px' }}>
                        <p style={{ color: '#64748b', marginBottom: '2px' }}>Valor Total</p>
                        <p style={{ fontWeight: 600, color: '#15803d' }}>R$ {(ppParsedData.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div style={{ backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px' }}>
                        <p style={{ color: '#64748b', marginBottom: '2px' }}>Total de Horas</p>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>{ppParsedData.total_hours}h</p>
                      </div>
                      <div style={{ backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px' }}>
                        <p style={{ color: '#64748b', marginBottom: '2px' }}>Fases identificadas</p>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>{ppParsedData.phases?.length || 0} fases</p>
                      </div>
                    </div>
                    {ppParsedData.phases && ppParsedData.phases.length > 0 && (
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#dcfce7' }}>
                              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #bbf7d0' }}>Fase</th>
                              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #bbf7d0' }}>Descrição</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #bbf7d0' }}>Data</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #bbf7d0' }}>Horas</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #bbf7d0' }}>Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ppParsedData.phases.map((phase, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f0fdf4', backgroundColor: i % 2 === 0 ? 'white' : '#f0fdf4' }}>
                                <td style={{ padding: '5px 8px', fontWeight: 600 }}>{phase.phase_number}</td>
                                <td style={{ padding: '5px 8px' }}>{phase.description}</td>
                                <td style={{ padding: '5px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {phase.start_date ? phase.start_date.split('-').reverse().join('/') : '-'}
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'center' }}>{phase.hours}h</td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500 }}>
                                  R$ {(phase.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer PP */}
                <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', position: 'sticky', bottom: 0, backgroundColor: 'white', borderTop: '1px solid #e2e8f0', margin: '0 -32px', padding: '16px 32px' }}>
                  <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handlePpCreate} disabled={!formData.consultant_id || !ppParsedData || loading}
                    style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: '6px', backgroundColor: !formData.consultant_id || !ppParsedData || loading ? '#94a3b8' : '#15803d', color: 'white', cursor: !formData.consultant_id || !ppParsedData || loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {loading && <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
                    Criar Atendimento
                  </button>
                </div>
              </div>
            );
          })()}

          {/* CONSULTOR (only for non-PP types) */}
          {!isPublicPolicies && (
            <div style={{ ...sectionStyle }}>
              <div style={sectionTitleStyle}>Consultor</div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Consultor *</label>
                <select name="consultant_id" value={formData.consultant_id} onChange={handleChange} required style={inputStyle}>
                  <option value="">Selecione um consultor</option>
                  {consultants?.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {consultantConflicts.length > 0 && (
                <div style={{ padding: '12px', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: 600 }}>
                    <AlertTriangle style={{ width: '16px', height: '16px' }} />
                    Consultor com {consultantConflicts.length} sessão(ões) agendada(s) a partir dessa data
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DADOS DO CLIENTE (somente consultoria) */}
          {isConsulting && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>1. Dados do Cliente</div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Razão Social *</label>
                <select name="client_id" value={formData.client_id} onChange={handleChange} required style={inputStyle}>
                  <option value="">Selecione um cliente</option>
                  {clients?.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              {selectedClient && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>CNPJ</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.document || ''} disabled />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Endereço de Execução</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.address || ''} disabled />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Representante Legal</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.legal_rep_name || ''} disabled />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Código FOCO da Empresa</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.foco_code_company || '-'} disabled />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Código FOCO Representante</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.foco_code_rep || '-'} disabled />
                  </div>
                </div>
              )}
              {!selectedClient && (
                <p style={{ fontSize: '13px', color: '#94a3b8' }}>Selecione um cliente para ver as informações.</p>
              )}
            </div>
          )}

          {/* DADOS DO CLIENTE - Diagnóstico */}
          {isDiagnostic && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Dados do Cliente</div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Razão Social *</label>
                <select name="client_id" value={formData.client_id} onChange={handleChange} required style={inputStyle}>
                  <option value="">Selecione um cliente</option>
                  {clients?.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              {selectedClient && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>CNPJ</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.document || ''} disabled />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Telefone</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.phone || ''} disabled />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Endereço Completo (Cidade e CEP)</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.address || ''} disabled />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Pessoa de Contato</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.contact_person || ''} disabled />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>E-mail</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.email || ''} disabled />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Nome do Representante Legal</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.legal_rep_name || ''} disabled />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Telefone do Representante Legal</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.legal_rep_phone || ''} disabled />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Endereço Completo do Representante Legal</label>
                    <input style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} value={selectedClient.legal_rep_address || ''} disabled />
                  </div>
                </div>
              )}
              {!selectedClient && (
                <p style={{ fontSize: '13px', color: '#94a3b8' }}>Selecione um cliente para ver as informações.</p>
              )}
            </div>
          )}

          {/* Para outros tipos (não consultoria, não diagnóstico), mostrar seleção simples */}
          {!isConsulting && !isDiagnostic && !isPublicPolicies && formData.project_type && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Cliente *</label>
              <select name="client_id" value={formData.client_id} onChange={handleChange} required style={inputStyle}>
                <option value="">Selecione um cliente</option>
                {clients?.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* ÁREA/SUBÁREA */}
          {formData.project_type && formData.project_type !== 'diagnostic' && !isPublicPolicies && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>{isConsulting ? '2.' : ''} Área / Subárea</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Área</label>
                  <select name="area" value={formData.area} onChange={(e) => setFormData(p => ({ ...p, area: e.target.value, subarea: '' }))} style={inputStyle}>
                    <option value="">Selecione</option>
                    {areaOptions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    <option value="custom">Área Personalizada</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Subárea</label>
                  {formData.area && formData.area !== 'custom' ? (
                    <select name="subarea" value={formData.subarea} onChange={handleChange} style={inputStyle}>
                      <option value="">Selecione</option>
                      {subareasForArea.map((s, i) => <option key={i} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input type="text" name="custom_subarea" value={formData.custom_subarea} onChange={handleChange} placeholder="Subárea personalizada" style={inputStyle} />
                  )}
                </div>
              </div>
              {formData.area === 'custom' && (
                <div style={{ marginTop: '12px' }}>
                  <label style={labelStyle}>Área Personalizada</label>
                  <input type="text" name="custom_area" value={formData.custom_area} onChange={handleChange} style={inputStyle} />
                </div>
              )}
              {isConsulting && (
                <div style={{ marginTop: '12px' }}>
                  <label style={labelStyle}>Objetivo</label>
                  <RichTextArea
                    name="objective"
                    value={formData.objective}
                    onChange={handleChange}
                    rows={3}
                    style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                    inputRef={objectiveRef}
                  />
                </div>
              )}
            </div>
          )}

          {/* NECESSIDADES DO CLIENTE */}
          {isConsulting && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>3. Necessidades do Cliente</div>
              <RichTextArea
                name="client_needs"
                value={formData.client_needs}
                onChange={handleChange}
                rows={4}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                placeholder="Descreva as necessidades do cliente..."
                inputRef={needsRef}
              />
            </div>
          )}

          {/* DETALHAMENTO DO SERVIÇO + ATIVIDADES */}
          {isConsulting && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>4. Detalhamento do Serviço e Atividades</div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Detalhamento do Serviço</label>
                <RichTextArea
                  name="service_detail"
                  value={formData.service_detail}
                  onChange={handleChange}
                  rows={4}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                  placeholder="Descreva o serviço a ser realizado..."
                  inputRef={detailRef}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Produto Final a ser disponibilizado ao cliente</label>
                <RichTextArea
                  name="produto_final"
                  value={formData.produto_final}
                  onChange={handleChange}
                  rows={3}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                  placeholder={'PRODUTO FINAL A SER DISPONIBILIZADO PARA O CLIENTE:\n01 (um) PLANO DE NEGÓCIO.\nObs: Os custos de aquisição, implantação e treinamento não fazem parte da presente proposta.'}
                  inputRef={produtoFinalRef}
                />
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Se não preenchido, será usado o texto padrão acima.</p>
              </div>

              <label style={{ ...labelStyle, marginBottom: '8px' }}>Lista de Atividades</label>
              {formData.activities.length > 0 && (
                <div style={{ marginBottom: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: '30px' }}>✓</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Nº</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Atividade</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: '60px' }}>Dias</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: '60px' }}>Horas</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: '120px' }}>Presencial / Remota / Escritório</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Entregas/Relatórios</th>
                        <th style={{ padding: '8px', width: '40px', borderBottom: '1px solid #e2e8f0' }}>Grupo</th>
                        <th style={{ padding: '8px', width: '36px', borderBottom: '1px solid #e2e8f0' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.activities.map((act, idx) => {
                        const actGroupId = Object.entries(formData.activity_groups || {}).find(([_, entries]) => 
                          entries.some(e => e.activityIdx === idx)
                        )?.[0];
                        return editingActivityIdx === idx ? (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#eff6ff' }}>
                            <td style={{ padding: '8px', textAlign: 'center' }}></td>
                            <td style={{ padding: '8px', color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '8px' }}>
                              <input type="text" value={editingActivity.description} onChange={e => setEditingActivity(p => ({ ...p, description: e.target.value }))}
                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #93c5fd', borderRadius: '4px', fontSize: '12px' }} />
                            </td>
                            <td style={{ padding: '8px' }}>
                              <input type="number" min="1" value={editingActivity.days || ''} onChange={e => setEditingActivity(p => ({ ...p, days: e.target.value }))}
                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #93c5fd', borderRadius: '4px', fontSize: '12px' }} />
                            </td>
                            <td style={{ padding: '8px' }}>
                              <input type="number" min="1" value={editingActivity.hours || ''} onChange={e => setEditingActivity(p => ({ ...p, hours: e.target.value }))}
                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #93c5fd', borderRadius: '4px', fontSize: '12px' }} />
                            </td>
                            <td style={{ padding: '8px' }}>
                              <select value={editingActivity.modality || ''} onChange={e => setEditingActivity(p => ({ ...p, modality: e.target.value }))}
                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #93c5fd', borderRadius: '4px', fontSize: '12px' }}>
                                <option value="">-</option>
                                <option value="Presencial">Presencial</option>
                                <option value="Remota">Remota</option>
                                <option value="Escritório">Escritório</option>
                              </select>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <input type="text" value={editingActivity.delivery || ''} onChange={e => setEditingActivity(p => ({ ...p, delivery: e.target.value }))}
                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #93c5fd', borderRadius: '4px', fontSize: '12px' }}
                                placeholder="Ex: Fluxograma de Produção" />
                            </td>
                            <td style={{ padding: '8px' }}></td>
                            <td style={{ padding: '8px', display: 'flex', gap: '4px' }}>
                              <button type="button" onClick={handleSaveEditActivity} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}>
                                <Check style={{ width: '14px', height: '14px' }} />
                              </button>
                              <button type="button" onClick={handleCancelEditActivity} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X style={{ width: '14px', height: '14px' }} />
                              </button>
                            </td>
                          </tr>
                        ) : (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: actGroupId ? '#fef3c7' : 'white' }}>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <input type="checkbox" id={`act_${idx}`} style={{ cursor: 'pointer' }} />
                          </td>
                          <td style={{ padding: '8px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '8px' }}>{act.description}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{act.days || '-'}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{act.hours || '-'}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontSize: '12px', color: '#475569' }}>{act.modality || '-'}</td>
                          <td style={{ padding: '8px', fontSize: '12px', color: '#475569' }}>{act.delivery || '-'}</td>
                          <td style={{ padding: '8px', fontSize: '11px', color: '#ca8a04', fontWeight: 600 }}>
                            {actGroupId ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>{actGroupId}</span>
                                <button type="button" onClick={() => handleUnGroupActivities(actGroupId)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px' }}>
                                  ✕
                                </button>
                              </div>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '8px', display: 'flex', gap: '4px' }}>
                            <button type="button" onClick={() => handleStartEditActivity(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e3a5f' }}>
                              <Pencil style={{ width: '14px', height: '14px' }} />
                            </button>
                            <button type="button" onClick={() => handleRemoveActivity(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                              <Trash2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* Agrupar atividades/parciais */}
                  <div style={{ padding: '8px 12px', backgroundColor: '#fffff0', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <button type="button" onClick={handleOpenGroupModal} style={{ padding: '4px 12px', backgroundColor: '#ca8a04', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>
                      🔗 Novo Grupo Personalizado
                    </button>
                    <span style={{ color: '#92400e' }}>Selecione atividades e horas para criar grupos de cálculo</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 120px 1fr auto', gap: '8px', alignItems: 'end' }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>Descrição da atividade</label>
                  <input type="text" value={newActivity.description} onChange={e => setNewActivity(p => ({ ...p, description: e.target.value }))} style={inputStyle} placeholder="Ex: Definição do Fluxograma" />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>Dias</label>
                  <input type="number" min="1" value={newActivity.days} onChange={e => setNewActivity(p => ({ ...p, days: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>Horas</label>
                  <input type="number" min="1" value={newActivity.hours} onChange={e => setNewActivity(p => ({ ...p, hours: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>Modalidade</label>
                  <select value={newActivity.modality} onChange={e => setNewActivity(p => ({ ...p, modality: e.target.value }))} style={inputStyle}>
                    <option value="">-</option>
                    <option value="Presencial">Presencial</option>
                    <option value="Remota">Remota</option>
                    <option value="Escritório">Escritório</option>
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>Entrega/Relatório</label>
                  <input type="text" value={newActivity.delivery} onChange={e => setNewActivity(p => ({ ...p, delivery: e.target.value }))} style={inputStyle} placeholder="Ex: Fluxograma de Produção" />
                </div>
                <button type="button" onClick={handleAddActivity} style={{ padding: '8px 16px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', height: '37px' }}>
                  <Plus style={{ width: '14px', height: '14px' }} />
                  Adicionar
                </button>
              </div>
            </div>
          )}

          {/* CRONOGRAMA */}
          {isConsulting && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>5. Previsão de Cronograma</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Data de Início *</label>
                  <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Horas Estimadas (calculado)</label>
                  <input type="number" name="estimated_hours" value={formData.estimated_hours} onChange={handleChange} style={{ ...inputStyle, backgroundColor: '#f1f5f9' }} readOnly />
                </div>
                <div>
                  <label style={labelStyle}>Horas por Dia</label>
                  <input type="number" name="hours_per_day" value={formData.hours_per_day} onChange={handleChange} min="0.5" step="0.5" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Considerar Domingos?</label>
                  <select name="consider_sundays" value={formData.consider_sundays} onChange={handleChange} style={inputStyle}>
                    <option value="no">Não</option>
                    <option value="yes">Sim</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Considerar Feriados?</label>
                  <select name="consider_holidays" value={formData.consider_holidays} onChange={handleChange} style={inputStyle}>
                    <option value="no">Não</option>
                    <option value="yes">Sim</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Dias de Folga no Período</label>
                  <input type="number" name="days_off" min="0" value={formData.days_off} onChange={handleChange} style={inputStyle} />
                </div>
                {parseInt(formData.days_off) > 0 && (
                  <div>
                    <label style={labelStyle}>Posição das Folgas</label>
                    <select name="days_off_position" value={formData.days_off_position} onChange={handleChange} style={inputStyle}>
                      <option value="start">No Início</option>
                      <option value="middle">No Meio</option>
                      <option value="end">No Final</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Days-off proposal: show suggested dates for confirmation/editing */}
              {daysOffProposal && daysOffProposal.length > 0 && !daysOffConfirmed && (
                <div style={{ marginBottom: '16px', padding: '14px', backgroundColor: '#fff7ed', border: '2px solid #fb923c', borderRadius: '8px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#c2410c', marginBottom: '10px' }}>
                    📅 Sugestão de datas para as folgas — confirme ou edite antes de aplicar ao calendário:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    {daysOffProposal.map((d, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>Folga {i + 1}</label>
                        <input
                          type="date"
                          value={d.date}
                          onChange={e => handleDaysOffDateChange(i, e.target.value)}
                          style={{ padding: '6px 8px', border: '1px solid #fb923c', borderRadius: '6px', fontSize: '13px', backgroundColor: 'white' }}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmDaysOff}
                    style={{ padding: '8px 20px', backgroundColor: '#ea580c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                  >
                    ✓ Confirmar e aplicar ao calendário
                  </button>
                </div>
              )}
              {daysOffConfirmed && parseInt(formData.days_off) > 0 && (
                <div style={{ marginBottom: '12px', padding: '8px 14px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', fontSize: '13px', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ✓ Folgas confirmadas e aplicadas ao calendário.
                  <button type="button" onClick={() => { setDaysOffConfirmed(false); const p = generateDaysOffProposal(formData); setDaysOffProposal(p); }}
                    style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#059669', fontSize: '12px', textDecoration: 'underline' }}>
                    Editar
                  </button>
                </div>
              )}

              {scheduleRows.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Data</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Atividade</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', width: '60px' }}>Horas</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', width: '120px' }}>Modalidade</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', width: '200px' }}>Entregas/Relatórios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleRows.map((row, idx) => {
                        const hasGrouping = Object.keys(formData.activity_groups || {}).length > 0;
                        const isEditable = hasGrouping;
                        return (
                        <tr key={idx} style={{ backgroundColor: row.isDayOff ? '#fef9c3' : idx % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {row.isDayOff ? row.date : (
                              isEditable ? (
                                <input type="date" value={row.date || ''} onChange={e => handleScheduleDateChange(idx, e.target.value)}
                                  style={{ padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', width: '120px' }} />
                              ) : (
                                <span style={{ padding: '4px 6px', fontSize: '12px' }}>{row.date}</span>
                              )
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: row.isDayOff ? '#ca8a04' : 'inherit' }}>
                            {row.isDayOff ? 'Folga' : (
                              isEditable ? (
                                <select value={row.activityIdx !== undefined ? row.activityIdx : ''} onChange={e => handleScheduleActivityChange(idx, parseInt(e.target.value))}
                                  style={{ width: '100%', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}>
                                  <option value="">Selecione atividade</option>
                                  {formData.activities.map((act, aIdx) => (
                                    <option key={aIdx} value={aIdx}>{act.description || `Atividade ${aIdx + 1}`}</option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ padding: '4px 6px', fontSize: '12px' }}>{row.activity}</span>
                              )
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {row.isDayOff ? '-' : (
                              <span style={{ padding: '4px 6px', fontSize: '12px', display: 'block' }}>{row.hours}</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {!row.isDayOff && (
                              <span style={{ padding: '4px 6px', fontSize: '12px', display: 'block' }}>{row.modality || '-'}</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {!row.isDayOff && (
                              <span style={{ padding: '4px 6px', fontSize: '12px', display: 'block' }}>{row.delivery || '-'}</span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {formData.activities.length === 0 && (
                <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>
                  Adicione atividades no item 4 para gerar o cronograma.
                </p>
              )}
            </div>
          )}

          {/* KM RODADO (para tipos que não sejam diagnóstico - que já tem o campo próprio) */}
          {formData.project_type && !isDiagnostic && !isConsulting && !isPublicPolicies && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>KM Rodado</label>
              <input type="number" name="km_rodado" min="0" value={formData.km_rodado} onChange={handleChange} placeholder="Ex: 150" style={inputStyle} />
            </div>
          )}

          {/* CAMPOS ESPECÍFICOS DE DIAGNÓSTICO */}
          {isDiagnostic && (
            <>
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Informações Relativas à Situação da Empresa / Descrição da Necessidade do Cliente</div>
                <RichTextArea
                  name="client_needs"
                  value={formData.client_needs}
                  onChange={handleChange}
                  rows={5}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                  placeholder="Descreva a situação da empresa e as necessidades do cliente..."
                  inputRef={needsRef}
                />
              </div>
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Orientações Repassadas à Empresa Durante o Diagnóstico</div>
                <RichTextArea
                  name="objective"
                  value={formData.objective}
                  onChange={handleChange}
                  rows={5}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                  placeholder="Descreva as orientações repassadas à empresa durante o diagnóstico..."
                  inputRef={objectiveRef}
                />
              </div>
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Considerações do Consultor</div>
                <RichTextArea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={5}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                  placeholder="Considerações do consultor sobre o diagnóstico..."
                  inputRef={notesRef}
                />
              </div>
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Configuração</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Data de Início *</label>
                    <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Modalidade</label>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      {[{ val: 'presencial', label: 'Presencial' }, { val: 'remota', label: 'A Distância' }].map(opt => (
                        <label key={opt.val} style={{
                          padding: '8px 20px', border: formData.service_detail === opt.val ? '2px solid #1e3a5f' : '1px solid #cbd5e1',
                          borderRadius: '8px', cursor: 'pointer', backgroundColor: formData.service_detail === opt.val ? '#eff6ff' : 'white',
                          fontSize: '14px', fontWeight: 500
                        }}>
                          <input type="radio" name="service_detail" value={opt.val} checked={formData.service_detail === opt.val} onChange={handleChange} style={{ marginRight: '6px' }} />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>KM Rodado</label>
                    <input type="number" name="km_rodado" min="0" value={formData.km_rodado} onChange={handleChange} placeholder="Ex: 150" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Horas Estimadas</label>
                    <input type="number" name="estimated_hours" value={formData.estimated_hours} onChange={handleChange} min="1" step="0.5" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Valor Contratado R$ (calculado pela tabela)</label>
                    <MoneyInput
                      value={formData.contracted_value}
                      onChange={(v) => setFormData(prev => ({ ...prev, contracted_value: v }))}
                      style={{
                        ...inputStyle,
                        backgroundColor: formData.km_rodado ? '#f0fdf4' : 'white',
                        fontWeight: 600,
                        textAlign: 'right',
                      }}
                    />
                    {formData.km_rodado && (
                      <p style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                        ✓ Calculado pela tabela de Diagnósticos para {formData.km_rodado} km
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Para outros tipos (não consultoria, não diagnóstico): configuração de horas e datas */}
          {!isConsulting && !isDiagnostic && !isPublicPolicies && formData.project_type && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Configuração</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Data de Início *</label>
                  <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Horas Estimadas</label>
                  <input type="number" name="estimated_hours" value={formData.estimated_hours} onChange={handleChange} min="1" step="0.5" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Valor Contratado (R$)</label>
                  <MoneyInput
                    value={formData.contracted_value}
                    onChange={(v) => setFormData(prev => ({ ...prev, contracted_value: v }))}
                    min={0}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {/* DISCRIMINAÇÃO DE VALORES */}
          {isConsulting && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>6. Discriminação dos Valores</div>
              {/* KM Rodado - usado apenas para cálculo, não aparece no documento */}
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '6px' }}>
                <label style={labelStyle}>KM Rodado <span style={{ fontSize: '12px', fontWeight: 400, color: '#92400e' }}>(usado para calcular o valor da hora — não consta no documento)</span></label>
                <input type="number" name="km_rodado" min="0" value={formData.km_rodado} onChange={handleChange} placeholder="Ex: 150" style={{ ...inputStyle, maxWidth: '200px' }} />
                {formData.km_rodado && formData.hourly_rate && (
                  <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
                    ✓ Valor/hora calculado: R$ {parseFloat(formData.hourly_rate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para {formData.km_rodado} km
                  </p>
                )}
              </div>

              {/* Breakdown por atividade / grupo - só mostrar se houver agrupamento */}
              {Object.keys(formData.activity_groups || {}).length > 0 && formData.activities.length > 0 && formData.km_rodado && (() => {
                const km = parseFloat(formData.km_rodado) || 0;
                
                // Processar grupos
                const usedActivityHours = {}; // { actIdx: hoursUsed }
                const breakdownItems = [];

                // Adicionar grupos primeiro
                for (const [groupId, entries] of Object.entries(formData.activity_groups || {})) {
                  const groupHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
                  if (groupHours > 0) {
                    const rate = getConsultingHourlyRate(km, groupHours);
                    const groupDesc = entries.map(e => {
                      const activity = formData.activities[e.activityIdx];
                      const label = activity?.description || `Atividade ${e.activityIdx + 1}`;
                      return `${e.hours}h de ${label}`;
                    }).join(' + ');
                    const totalValue = rate ? Math.round(rate * groupHours * 100) / 100 : null;
                    breakdownItems.push({
                      type: 'group',
                      description: groupDesc,
                      groupId,
                      groupHours,
                      rate,
                      totalValue
                    });
                    entries.forEach(e => {
                      usedActivityHours[e.activityIdx] = (usedActivityHours[e.activityIdx] || 0) + e.hours;
                    });
                  }
                }

                // Adicionar atividades não agrupadas (ou parciais)
                formData.activities.forEach((act, idx) => {
                  const totalActHours = parseFloat(act.hours) || 0;
                  const usedHours = usedActivityHours[idx] || 0;
                  const remainingHours = totalActHours - usedHours;

                  if (remainingHours > 0) {
                    const rate = getConsultingHourlyRate(km, remainingHours);
                    const actDays = parseInt(act.days) || 1;
                    const hoursPerDay = actDays > 0 ? (remainingHours / actDays) : remainingHours;
                    const valuePerDay = rate ? rate * hoursPerDay : null;
                    const totalValue = rate ? Math.round(rate * remainingHours * 100) / 100 : null;
                    breakdownItems.push({
                      type: 'single',
                      description: act.description || `Atividade ${idx+1}`,
                      actHours: remainingHours,
                      originalHours: totalActHours,
                      usedHours,
                      actDays,
                      rate,
                      hoursPerDay,
                      valuePerDay,
                      totalValue
                    });
                  }
                });

                if (breakdownItems.length === 0) return null;

                return (
                  <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0369a1', marginBottom: '8px' }}>📊 Cálculo por Atividade / Grupo</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#e0f2fe' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #bae6fd' }}>Item</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>Total Horas</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>Dias</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>Valor/Hora</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>Valor/Dia</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdownItems.map((item, i) => {
                          if (item.type === 'group') {
                            const hoursPerDay = item.groupHours / 1; // aprox
                            const valuePerDay = item.rate ? item.rate * hoursPerDay : null;
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #e0f2fe', backgroundColor: '#fef3c7' }}>
                                <td style={{ padding: '5px 8px', fontWeight: 600, color: '#ca8a04', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  🔗 GRUPO: {item.description}
                                  <button type="button" onClick={() => handleUnGroupActivities(item.groupId)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px', marginLeft: '4px' }}>
                                    ✕
                                  </button>
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>{item.groupHours}h</td>
                                <td style={{ padding: '5px 8px', textAlign: 'center' }}>-</td>
                                <td style={{ padding: '5px 8px', textAlign: 'center', color: item.rate ? '#059669' : '#ef4444', fontWeight: 600 }}>
                                  {item.rate ? `R$ ${item.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'center', color: '#0369a1' }}>
                                  {valuePerDay ? `≈ R$ ${valuePerDay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                                  {item.totalValue ? `R$ ${item.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}
                                </td>
                              </tr>
                            );
                          } else {
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #e0f2fe', backgroundColor: i % 2 === 0 ? 'white' : '#f0f9ff' }}>
                                <td style={{ padding: '5px 8px' }}>
                                  {item.description}
                                  {item.usedHours > 0 && <span style={{ fontSize: '11px', color: '#64748b' }}> (restante de {item.originalHours}h)</span>}
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'center' }}>{item.actHours}h</td>
                                <td style={{ padding: '5px 8px', textAlign: 'center' }}>{item.actDays}</td>
                                <td style={{ padding: '5px 8px', textAlign: 'center', color: item.rate ? '#059669' : '#ef4444' }}>
                                  {item.rate ? `R$ ${item.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'center', color: '#0369a1' }}>
                                  {item.valuePerDay ? `R$ ${item.valuePerDay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                                  {item.totalValue ? `R$ ${item.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}
                                </td>
                              </tr>
                            );
                          }
                        })}
                      </tbody>
                    </table>
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                      ℹ️ Atividades agrupadas (inteiras ou parciais) usam a soma de horas para buscar o valor/hora na tabela SEBRAE.
                    </p>
                  </div>
                );
              })()}

              {/* Modal para criar grupo personalizado */}
              {groupModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                  <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px' }}>Criar Grupo de Atividades</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Selecione as atividades e quantas horas de cada uma deseja agrupar.</p>
                    
                    <div style={{ space: '12px', marginBottom: '16px' }}>
                      {formData.activities.map((act, idx) => {
                        const totalHours = parseFloat(act.hours) || 0;
                        const usedHours = getActivityGroupsHours(idx);
                        const availableHours = totalHours - usedHours;
                        return (
                          <div key={idx} style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                            <div style={{ marginBottom: '6px' }}>
                              <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                {act.description || `Atividade ${idx + 1}`}
                                <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                                  ({availableHours}h disponível)
                                </span>
                              </label>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max={availableHours}
                              step="0.5"
                              placeholder="Quantas horas?"
                              value={groupFormData[idx] || ''}
                              onChange={(e) => setGroupFormData(prev => ({ ...prev, [idx]: e.target.value }))}
                              style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setGroupModalOpen(false);
                          setGroupFormData({});
                        }}
                        style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddGroup}
                        style={{ flex: 1, padding: '8px 12px', backgroundColor: '#ca8a04', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                      >
                        Criar Grupo
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Descrição</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', width: '160px' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px' }}>Valor total da consultoria (Hora Técnica × {formData.estimated_hours || 0}h)</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {contractedValue > 0 ? (
                          <span style={{ fontWeight: 600, fontSize: '14px', color: '#059669' }}>
                            R$ {contractedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <MoneyInput
                            value={formData.contracted_value}
                            onChange={(v) => setFormData(prev => ({ ...prev, contracted_value: v }))}
                            min={0}
                            style={{
                              width: '140px',
                              padding: '6px 8px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              textAlign: 'right',
                            }}
                          />
                        )}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px' }}>Percentual de subsídio concedido</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input type="number" name="subsidy_percent" value={formData.subsidy_percent} onChange={handleChange} min="0" max="100"
                          style={{ width: '80px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'right' }} />
                        <span style={{ marginLeft: '4px', color: '#64748b' }}>%</span>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                      <td style={{ padding: '10px 12px' }}>Valor do subsídio ({subsidyPct}%)</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>
                        R$ {subsidyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#eff6ff' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>Valor a ser pago pelo cliente (30%)</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1e3a5f', fontSize: '16px' }}>
                        R$ {clientValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <label style={labelStyle}>Forma de Pagamento</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[{ label: 'À Vista' }, { label: 'Cartão em até 10x' }].map(opt => (
                    <div key={opt.label} style={{
                      padding: '10px 20px', border: '2px solid #1e3a5f',
                      borderRadius: '8px', backgroundColor: '#eff6ff', fontSize: '14px',
                      display: 'flex', alignItems: 'center', gap: '6px', color: '#1e3a5f', fontWeight: 500
                    }}>
                      <span style={{ color: '#1e3a5f', fontSize: '16px' }}>✓</span>
                      {opt.label}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Ambas as formas de pagamento são oferecidas ao cliente.</p>
              </div>
            </div>
          )}

          {/* PESSOAS DE CONTATO SEBRAE */}
          {isConsulting && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>7. Pessoas de Contato do SEBRAE/GO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Gestor Responsável - Nome *</label>
                  <input type="text" name="sebrae_manager_name" value={formData.sebrae_manager_name} onChange={handleChange} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Gestor Responsável - Telefone *</label>
                  <PhoneInput
                    value={formData.sebrae_manager_phone}
                    onChange={(v) => setFormData(prev => ({ ...prev, sebrae_manager_phone: v }))}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Gerente Regional - Nome</label>
                  <input type="text" name="sebrae_regional_name" value={formData.sebrae_regional_name} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Gerente Regional - Telefone</label>
                  <PhoneInput
                    value={formData.sebrae_regional_phone}
                    onChange={(v) => setFormData(prev => ({ ...prev, sebrae_regional_phone: v }))}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STATUS - only shown when editing, not creating */}
          {project && !isPublicPolicies && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Status</label>
              <select name="status" value={formData.status} onChange={handleChange} style={inputStyle}>
                <option value="planning">Planejamento</option>
                <option value="in_progress">Em Execução</option>
                <option value="completed">Concluído</option>
              </select>
            </div>
          )}

          {/* FOOTER (only for non-PP) */}
          {!isPublicPolicies && (
          <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', position: 'sticky', bottom: 0, backgroundColor: 'white', borderTop: '1px solid #e2e8f0', margin: '0 -32px', padding: '16px 32px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: '6px', backgroundColor: loading ? '#94a3b8' : '#1e3a5f', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading && <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
              {project ? 'Salvar' : 'Criar Atendimento'}
            </button>
          </div>
          )}
        </form>
      </div>
    </div>
  );
}