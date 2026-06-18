import { describe, expect, it } from 'vitest';
import {
  distributeRandomIntegerHours,
  isDistributionFeasible,
  minDaysForHours,
  sumHours,
  validateScheduleDistribution,
} from './scheduleHours';

describe('scheduleHours', () => {
  it('calcula minDaysForHours corretamente', () => {
    expect(minDaysForHours(30, 4)).toBe(8);
    expect(minDaysForHours(30, 8)).toBe(4);
    expect(minDaysForHours(0, 8)).toBe(0);
  });

  it('identifica distribuição inviável (30h em 6 dias com máx 4h)', () => {
    expect(isDistributionFeasible(30, 6, 4)).toBe(false);
    expect(validateScheduleDistribution(
      [{ description: 'A', days: '6', hours: '30' }],
      30,
      4,
    ).feasible).toBe(false);
  });

  it('distribui soma exata quando viável', () => {
    for (let i = 0; i < 20; i += 1) {
      const hours = distributeRandomIntegerHours(30, 8, { maxPerDay: 8 });
      expect(sumHours(hours)).toBe(30);
      expect(hours).toHaveLength(8);
      expect(hours.every((h) => h <= 8 && h >= 1)).toBe(true);
    }
  });

  it('nunca excede maxPerDay', () => {
    const hours = distributeRandomIntegerHours(24, 6, { maxPerDay: 4 });
    expect(sumHours(hours)).toBe(24);
    expect(hours.every((h) => h <= 4)).toBe(true);
  });

  it('valida mínimo global de dias nas atividades', () => {
    const result = validateScheduleDistribution(
      [{ description: 'A', days: '6', hours: '30' }],
      30,
      4,
    );
    expect(result.minDaysRequired).toBe(8);
    expect(result.totalSlots).toBe(6);
    expect(result.message).toContain('pelo menos 8 dia(s)');
  });
});
