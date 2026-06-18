/**
 * Distribuição aleatória de horas inteiras por dia de atendimento,
 * com unicidade de padrão entre projetos do mesmo consultor.
 */

export class DistributionInfeasibleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DistributionInfeasibleError';
  }
}

/** Assinatura ordenada das horas por fase (ex.: "3,5,4,6") */
export function patternSignature(hoursArray) {
  return (hoursArray || []).map((h) => Math.round(Number(h) || 0)).join(',');
}

/** Média arredondada para o campo legado hours_per_day */
export function averageHoursPerDay(hoursArray) {
  const arr = hoursArray || [];
  if (arr.length === 0) return 0;
  const sum = arr.reduce((a, b) => a + (Number(b) || 0), 0);
  return Math.round(sum / arr.length);
}

export function parseMaxHoursPerDay(value, fallback = 8) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.max(1, Math.round(Number(fallback) || 8));
  }
  return Math.max(1, Math.round(parsed));
}

export function sumHours(hoursArray) {
  return (hoursArray || []).reduce(
    (total, hours) => total + Math.round(Number(hours) || 0),
    0,
  );
}

export function minDaysForHours(totalHours, maxHoursPerDay) {
  const total = Math.max(0, Math.round(Number(totalHours) || 0));
  if (total === 0) return 0;
  const max = parseMaxHoursPerDay(maxHoursPerDay);
  return Math.ceil(total / max);
}

export function isDistributionFeasible(totalHours, numDays, maxHoursPerDay, minPerDay = 1) {
  const total = Math.round(Number(totalHours) || 0);
  const n = Math.max(0, parseInt(numDays, 10) || 0);
  if (n === 0) return total === 0;

  const max = parseMaxHoursPerDay(maxHoursPerDay);
  let min = Math.max(0, minPerDay ?? 1);
  while (total < n * min && min > 0) {
    min -= 1;
  }

  return total <= n * max && total >= n * min;
}

export function countActivitySlots(activities, maxHoursPerDay) {
  let total = 0;
  for (const act of activities || []) {
    const actHours = parseFloat(act.hours) || 0;
    const numDays = act.days
      ? Math.max(1, parseInt(act.days, 10) || 1)
      : minDaysForHours(actHours, maxHoursPerDay);
    total += numDays;
  }
  return total;
}

export function validateScheduleDistribution(activities, totalHours, maxHoursPerDay) {
  const max = parseMaxHoursPerDay(maxHoursPerDay);
  const fromActivities = (activities || []).reduce(
    (sum, act) => sum + (parseFloat(act.hours) || 0),
    0,
  );
  const total =
    Math.round(fromActivities) || Math.round(Number(totalHours) || 0);
  const totalSlots = countActivitySlots(activities, max);
  const minDaysRequired = minDaysForHours(total, max);

  const activityErrors = (activities || [])
    .map((act, idx) => {
      if (!act.days) return null;
      const days = Math.max(1, parseInt(act.days, 10) || 1);
      const actHours = Math.round(parseFloat(act.hours) || 0);
      const minForAct = minDaysForHours(actHours, max);
      if (days < minForAct) {
        return { idx, days, minForAct, actHours };
      }
      return null;
    })
    .filter(Boolean);

  const feasible =
    activityErrors.length === 0 &&
    totalSlots >= minDaysRequired &&
    isDistributionFeasible(total, totalSlots, max);

  let message = null;
  if (!feasible) {
    if (activityErrors.length > 0) {
      const first = activityErrors[0];
      message =
        `A atividade ${first.idx + 1} precisa de pelo menos ${first.minForAct} dia(s) para ${first.actHours}h (máximo ${max} h/dia).`;
    } else if (totalSlots < minDaysRequired) {
      message = `Com máximo de ${max} h/dia, são necessários pelo menos ${minDaysRequired} dias para ${total} horas (você definiu ${totalSlots}).`;
    } else {
      message = `Não é possível distribuir ${total} horas em ${totalSlots} dias com máximo de ${max} h/dia.`;
    }
  }

  return {
    feasible,
    totalSlots,
    minDaysRequired,
    totalHours: total,
    maxHoursPerDay: max,
    activityErrors,
    message,
  };
}

/**
 * Distribui totalHours em numDays inteiros (soma exata quando viável).
 * @returns {number[]}
 */
export function distributeRandomIntegerHours(totalHours, numDays, options = {}) {
  const total = Math.round(Number(totalHours) || 0);
  const n = Math.max(0, parseInt(numDays, 10) || 0);
  if (n === 0) return [];
  if (total <= 0) return Array(n).fill(0);

  let minPerDay = options.minPerDay ?? 1;
  const maxPerDay =
    options.maxPerDay != null
      ? parseMaxHoursPerDay(options.maxPerDay)
      : Math.max(8, Math.ceil(total / n) + 2);

  while (total < n * minPerDay && minPerDay > 0) {
    minPerDay -= 1;
  }

  if (minPerDay <= 0 && total < n) {
    const hours = Array(n).fill(0);
    let rem = total;
    const indices = [...Array(n).keys()].sort(() => Math.random() - 0.5);
    for (const i of indices) {
      if (rem <= 0) break;
      hours[i] = 1;
      rem -= 1;
    }
    if (sumHours(hours) !== total) {
      throw new DistributionInfeasibleError(
        `Não é possível distribuir ${total} horas em ${n} dias.`,
      );
    }
    return hours;
  }

  if (!isDistributionFeasible(total, n, maxPerDay, minPerDay)) {
    throw new DistributionInfeasibleError(
      `Não é possível distribuir ${total} horas em ${n} dias com máximo de ${maxPerDay} h/dia.`,
    );
  }

  const hours = Array(n).fill(minPerDay);
  let remaining = total - n * minPerDay;

  while (remaining > 0) {
    const eligible = [];
    for (let i = 0; i < n; i += 1) {
      if (hours[i] < maxPerDay) eligible.push(i);
    }
    if (eligible.length === 0) break;

    const idx = eligible[Math.floor(Math.random() * eligible.length)];
    hours[idx] += 1;
    remaining -= 1;
  }

  if (remaining > 0) {
    for (let i = 0; i < n && remaining > 0; i += 1) {
      const add = Math.min(maxPerDay - hours[i], remaining);
      if (add > 0) {
        hours[i] += add;
        remaining -= add;
      }
    }
  }

  if (sumHours(hours) !== total) {
    throw new DistributionInfeasibleError(
      `Falha ao distribuir ${total} horas em ${n} dias com máximo de ${maxPerDay} h/dia.`,
    );
  }

  return hours;
}

/**
 * Gera distribuição cuja assinatura não está em usedPatterns.
 * @returns {number[]}
 */
export function buildUniqueDailyHours({
  totalHours,
  numDays,
  usedPatterns = new Set(),
  maxAttempts = 50,
  ...distOptions
}) {
  const used =
    usedPatterns instanceof Set ? usedPatterns : new Set(usedPatterns || []);

  let last = distributeRandomIntegerHours(totalHours, numDays, distOptions);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = distributeRandomIntegerHours(totalHours, numDays, distOptions);
    const sig = patternSignature(candidate);
    if (!used.has(sig)) {
      return candidate;
    }
    last = candidate;
  }

  console.warn(
    '[scheduleHours] Não foi possível gerar padrão único após',
    maxAttempts,
    'tentativas; usando último padrão gerado.',
  );
  return last;
}

/** Padrões já usados a partir de projetos (schedule_config ou hours_per_day legado) */
export function collectUsedPatternsFromProjects(projects, excludeProjectId) {
  const patterns = new Set();

  for (const p of projects || []) {
    if (!p || p.id === excludeProjectId) continue;

    const fromConfig = (p.schedule_config || [])
      .filter((r) => !r.isDayOff && !r.is_day_off)
      .map((r) => Math.round(parseFloat(r.hours) || 0));

    if (fromConfig.length > 0) {
      patterns.add(patternSignature(fromConfig));
      continue;
    }

    if (p.hours_per_day != null && p.hours_per_day !== '') {
      patterns.add(String(Math.round(parseFloat(p.hours_per_day))));
    }
  }

  return patterns;
}

/** Mescla padrões de agendas já geradas (project_schedule) */
export function collectUsedPatternsFromSchedules(schedules, excludeProjectId) {
  const patterns = new Set();
  const byProject = {};

  for (const s of schedules || []) {
    if (!s || s.project_id === excludeProjectId) continue;
    if (s.status === 'cancelled' || s.location === 'FOLGA') continue;

    if (!byProject[s.project_id]) byProject[s.project_id] = [];
    byProject[s.project_id].push({
      date: s.date || '',
      hours: Math.round(parseFloat(s.hours) || 0),
    });
  }

  for (const entries of Object.values(byProject)) {
    entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const hours = entries.map((e) => e.hours);
    if (hours.length > 0) patterns.add(patternSignature(hours));
  }

  return patterns;
}

/** Padrões do consultor: projetos + sessões geradas */
export async function collectUsedPatternsForConsultant(
  consultantId,
  excludeProjectId,
  api,
) {
  const patterns = new Set();
  if (!consultantId || !api) return patterns;

  const [projects, schedules] = await Promise.all([
    api.entities.Project.filter({ consultant_id: consultantId }),
    api.entities.ProjectSchedule.filter({ consultant_id: consultantId }),
  ]);

  collectUsedPatternsFromProjects(projects, excludeProjectId).forEach((p) =>
    patterns.add(p),
  );
  collectUsedPatternsFromSchedules(schedules, excludeProjectId).forEach((p) =>
    patterns.add(p),
  );

  return patterns;
}

/** Calcula numDays e gera horas únicas para agenda por estimated_hours */
export async function buildDailyHoursForEstimatedProject(
  config,
  consultantId,
  excludeProjectId,
  api,
) {
  const maxHpd = parseMaxHoursPerDay(
    config.max_hours_per_day ?? config.hours_per_day,
    8,
  );
  const totalH = Math.round(parseFloat(config.estimated_hours) || 0);
  const numDays = minDaysForHours(totalH, maxHpd);
  if (numDays === 0 || totalH === 0) return [];

  const usedPatterns = await collectUsedPatternsForConsultant(
    consultantId,
    excludeProjectId,
    api,
  );

  return buildUniqueDailyHours({
    totalHours: totalH,
    numDays,
    usedPatterns,
    maxPerDay: maxHpd,
  });
}

/** Aplica horas aleatórias aos slots de trabalho (mantém folgas) */
export function applyRandomHoursToWorkSlots(
  workSlots,
  totalHours,
  usedPatterns,
  options = {},
) {
  const numDays = workSlots.length;
  if (numDays === 0) return workSlots;

  const fromSlots = workSlots.reduce(
    (sum, slot) => sum + (parseFloat(slot.hours) || 0),
    0,
  );
  const total =
    totalHours != null
      ? Math.round(Number(totalHours) || 0)
      : Math.round(fromSlots);

  const maxPerDay = parseMaxHoursPerDay(
    options.maxPerDay ?? options.max_hours_per_day,
    8,
  );

  if (!isDistributionFeasible(total, numDays, maxPerDay)) {
    return null;
  }

  try {
    const dailyHours = buildUniqueDailyHours({
      totalHours: total,
      numDays,
      usedPatterns,
      maxPerDay,
      ...options,
    });

    return workSlots.map((slot, i) => ({
      ...slot,
      hours: dailyHours[i] ?? slot.hours,
    }));
  } catch (error) {
    if (error instanceof DistributionInfeasibleError) {
      return null;
    }
    throw error;
  }
}
