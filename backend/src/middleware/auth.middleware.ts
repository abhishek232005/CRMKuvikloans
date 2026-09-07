import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getAuthUser } from '../services/auth.service';
import { AppError } from './error-handler';
export const authenticate: RequestHandler = async (req, _res, next) => { try { const header = req.get('authorization'); if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Authentication required'); const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as { sub: string }; req.auth = await getAuthUser(payload.sub); next(); } catch (error) { next(error instanceof AppError ? error : new AppError(401, 'Authentication required')); } };
export const requirePermission = (...permissions: string[]): RequestHandler => (req, _res, next) => { if (!req.auth || !permissions.every(permission => req.auth!.permissions.includes(permission))) return next(new AppError(403, 'You do not have permission to perform this action')); next(); };
