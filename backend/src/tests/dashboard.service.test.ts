import { describe, expect, it } from 'vitest';
import { AppError } from '../middleware/error-handler';
import { resolveDashboardRange } from '../utils/dashboard-range';

describe('dashboard date ranges', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');

  it('resolves the inclusive seven-day reporting window', () => {
    const range = resolveDashboardRange({ preset: 'last_7_days' }, now);
    expect(range.from).toBe('2026-09-09');
    expect(range.to).toBe('2026-09-15');
  });

  it('accepts a valid inclusive custom range', () => {
    const range = resolveDashboardRange({ preset: 'custom', from: '2026-09-01', to: '2026-09-15' }, now);
    expect(range.from).toBe('2026-09-01');
    expect(range.to).toBe('2026-09-15');
  });

  it('rejects incomplete and reversed custom ranges', () => {
    expect(() => resolveDashboardRange({ preset: 'custom', from: '2026-09-01' }, now)).toThrow(AppError);
    expect(() => resolveDashboardRange({ preset: 'custom', from: '2026-09-15', to: '2026-09-01' }, now)).toThrow('Custom date range is invalid');
  });
});
