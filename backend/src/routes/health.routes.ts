import { Router } from 'express';
export const healthRouter = Router();
healthRouter.get('/', (_req, res) => res.status(200).json({ success: true, message: 'Kuvik CRM API is healthy', data: { service: 'kuvik-crm-api', timestamp: new Date().toISOString() } }));
