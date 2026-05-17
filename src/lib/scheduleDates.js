/**
 * Geração de datas de agenda respeitando normas:
 * - no máximo N dias de atendimento por semana (2 ou 3)
 * - dias de atendimento não podem ser consecutivos no calendário
 */

const HOLIDAYS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'];

export function isHoliday(dateStr) {
  if (!dateStr) return false;
  return HOLIDAYS.includes(String(dateStr).slice(5));
}

/** Segunda-feira da semana (ISO) como chave yyyy-MM-dd */
export function getWeekKey(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function calendarDayDiff(a, b) {
  const da = new Date(`${a}T12:00:00`);
  const db = new Date(`${b}T12:00:00`);
  return Math.round(Math.abs(db - da) / 86400000);
}

function isBlockedCalendarDay(dateStr, { consider_sundays, consider_holidays, skipDates }) {
  const d = new Date(`${dateStr}T12:00:00`);
  const dow = d.getDay();
  if (dow === 0 && consider_sundays !== 'yes') return true;
  if (consider_holidays !== 'yes' && isHoliday(dateStr)) return true;
  if (skipDates?.has(dateStr)) return true;
  return false;
}

function canScheduleWorkDay(
  dateStr,
  { consider_sundays, consider_holidays, skipDates, max_work_days_per_week, lastWorkDate, weekCounts },
) {
  if (isBlockedCalendarDay(dateStr, { consider_sundays, consider_holidays, skipDates })) {
    return false;
  }

  const maxPerWeek = parseInt(max_work_days_per_week, 10);
  if (!maxPerWeek || maxPerWeek < 2) {
    return true;
  }

  const weekKey = getWeekKey(dateStr);
  if ((weekCounts.get(weekKey) || 0) >= maxPerWeek) {
    return false;
  }

  if (lastWorkDate && calendarDayDiff(lastWorkDate, dateStr) <= 1) {
    return false;
  }

  return true;
}

/**
 * Atribui N datas de trabalho (yyyy-MM-dd), respeitando regras de norma quando max_work_days_per_week é 2 ou 3.
 * Sem max_work_days_per_week (ou valor inválido), mantém dias úteis consecutivos (comportamento legado).
 */
export function assignWorkDates({
  start_date,
  count,
  consider_sundays = 'no',
  consider_holidays = 'no',
  skipDates = new Set(),
  max_work_days_per_week,
}) {
  const needed = Math.max(0, parseInt(count, 10) || 0);
  if (!start_date || needed === 0) return [];

  const opts = {
    consider_sundays,
    consider_holidays,
    skipDates,
    max_work_days_per_week,
  };

  const useNormRules = [2, 3].includes(parseInt(max_work_days_per_week, 10));
  const dates = [];
  const weekCounts = new Map();
  let lastWorkDate = null;
  let current = new Date(`${start_date}T12:00:00`);
  let iterations = 0;
  const maxIterations = useNormRules ? 2000 : 1500;

  while (dates.length < needed && iterations < maxIterations) {
    iterations++;
    const dateStr = current.toISOString().slice(0, 10);

    const ok = useNormRules
      ? canScheduleWorkDay(dateStr, { ...opts, lastWorkDate, weekCounts })
      : !isBlockedCalendarDay(dateStr, opts);

    if (ok) {
      dates.push(dateStr);
      if (useNormRules) {
        const weekKey = getWeekKey(dateStr);
        weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
        lastWorkDate = dateStr;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/** Para projetos com horas estimadas: retorna [{ date, hours }] */
export function generateScheduleDates(config, skipDates = new Set()) {
  const { start_date, estimated_hours, hours_per_day, consider_sundays, consider_holidays, max_work_days_per_week } =
    config;
  if (!start_date || !estimated_hours || !hours_per_day) return [];

  const hpd = parseFloat(hours_per_day);
  const totalH = parseFloat(estimated_hours);
  const workDaysNeeded = Math.ceil(totalH / hpd);

  const workDateStrings = assignWorkDates({
    start_date,
    count: workDaysNeeded,
    consider_sundays,
    consider_holidays,
    skipDates,
    max_work_days_per_week,
  });

  return workDateStrings.map((date, index) => {
    const hoursThisDay = Math.min(hpd, totalH - index * hpd);
    return { date, hours: Math.round(hoursThisDay * 10) / 10 };
  });
}

/** Previsão de término considerando regras de norma */
export function estimateScheduleEndDate(config, extraOffDays = 0) {
  const hpd = parseFloat(config.hours_per_day);
  const totalH = parseFloat(config.estimated_hours);
  if (!config.start_date || !hpd || !totalH) return null;

  const workDays = Math.ceil(totalH / hpd) + (parseInt(extraOffDays, 10) || 0);
  const dates = assignWorkDates({
    start_date: config.start_date,
    count: workDays,
    consider_sundays: config.consider_sundays,
    consider_holidays: config.consider_holidays,
    skipDates: new Set(),
    max_work_days_per_week: config.max_work_days_per_week,
  });

  if (dates.length === 0) return null;
  const last = dates[dates.length - 1];
  const [y, m, d] = last.split('-');
  return `${d}/${m}/${y}`;
}
