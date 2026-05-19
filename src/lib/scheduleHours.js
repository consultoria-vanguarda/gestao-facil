/**
 * Distribuição aleatória de horas inteiras por dia de atendimento,
 * com unicidade de padrão entre projetos do mesmo consultor.
 */

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

/**
 * Distribui totalHours em numDays inteiros (soma exata).
 * @returns {number[]}
 */
export function distributeRandomIntegerHours(totalHours, numDays, options = {}) {
  const total = Math.round(Number(totalHours) || 0);
  const n = Math.max(0, parseInt(numDays, 10) || 0);
  if (n === 0) return [];
  if (total <= 0) return Array(n).fill(0);

  let minPerDay = options.minPerDay ?? 1;
  let maxPerDay =
    options.maxPerDay ?? Math.max(8, Math.ceil(total / n) + 2);

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
    return hours;
  }

  const hours = Array(n).fill(minPerDay);
  let remaining = total - n * minPerDay;

  const maxIterations = Math.max(remaining * n * 20, n * 50);
  let iterations = 0;

  while (remaining > 0 && iterations < maxIterations) {
    iterations += 1;
    const idx = Math.floor(Math.random() * n);
    if (hours[idx] < maxPerDay) {
      hours[idx] += 1;
      remaining -= 1;
    }
  }

  if (remaining > 0) {
    for (let i = 0; i < n && remaining > 0; i++) {
      const add = Math.min(maxPerDay - hours[i], remaining);
      if (add > 0) {
        hours[i] += add;
        remaining -= add;
      }
    }
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
  const hpd = parseFloat(config.hours_per_day) || 4;
  const totalH = Math.round(parseFloat(config.estimated_hours) || 0);
  const numDays = Math.ceil(totalH / hpd) || 0;
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
  });
}

/** Aplica horas aleatórias aos slots de trabalho (mantém folgas) */
export function applyRandomHoursToWorkSlots(workSlots, totalHours, usedPatterns) {
  const numDays = workSlots.length;
  if (numDays === 0) return workSlots;

  const total =
    totalHours != null
      ? Math.round(Number(totalHours) || 0)
      : Math.round(
          workSlots.reduce((s, slot) => s + (parseFloat(slot.hours) || 0), 0),
        );

  const dailyHours = buildUniqueDailyHours({
    totalHours: total,
    numDays,
    usedPatterns,
  });

  return workSlots.map((slot, i) => ({
    ...slot,
    hours: dailyHours[i] ?? slot.hours,
  }));
}
