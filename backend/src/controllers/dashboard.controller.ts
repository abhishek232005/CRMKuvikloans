import type { RequestHandler } from 'express';
import { z } from 'zod';
import { getDashboardOverview } from '../services/dashboard.service';
import { resolveDashboardRange } from '../utils/dashboard-range';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const query = z.object({
  preset: z.enum(['today', 'last_7_days', 'last_30_days', 'this_month', 'custom']).default('last_30_days'),
  from: date,
  to: date,
});

export const overview: RequestHandler = async (req, res, next) => {
  try {
    const range = resolveDashboardRange(query.parse(req.query));
    const data = await getDashboardOverview(range, Boolean(req.auth?.permissions.includes('audit.view')));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
