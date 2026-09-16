import { Router } from 'express';
import * as controller from '../controllers/dashboard.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);
dashboardRouter.get('/dashboard/overview', requirePermission('reports.view'), controller.overview);
