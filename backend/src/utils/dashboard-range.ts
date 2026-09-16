import { AppError } from '../middleware/error-handler';

export type DashboardPreset = 'today' | 'last_7_days' | 'last_30_days' | 'this_month' | 'custom';

export type DashboardRangeInput = {
  preset: DashboardPreset;
  from?: string;
  to?: string;
};

export type DashboardRange = {
  preset: DashboardPreset;
  from: string;
  to: string;
  startsAt: Date;
  endsAt: Date;
};

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function resolveDashboardRange(input: DashboardRangeInput, now = new Date()): DashboardRange {
  const today = dateKey(now);
  const end = endOfDay(today);
  let start: Date;

  if (input.preset === 'custom') {
    if (!input.from || !input.to) throw new AppError(400, 'Custom date range requires both from and to dates');
    start = startOfDay(input.from);
    const customEnd = endOfDay(input.to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(customEnd.getTime()) || start > customEnd) {
      throw new AppError(400, 'Custom date range is invalid');
    }
    return { preset: input.preset, from: input.from, to: input.to, startsAt: start, endsAt: customEnd };
  }

  if (input.preset === 'today') start = startOfDay(today);
  else if (input.preset === 'this_month') start = startOfDay(`${today.slice(0, 8)}01`);
  else {
    const days = input.preset === 'last_7_days' ? 6 : 29;
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - days));
  }

  return { preset: input.preset, from: dateKey(start), to: today, startsAt: start, endsAt: end };
}
