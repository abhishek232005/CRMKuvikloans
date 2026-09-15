import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
export class AppError extends Error { constructor(public readonly statusCode: number, message: string, public readonly errors?: unknown) { super(message); } }
export const notFound: RequestHandler = (_req, res) => { res.status(404).json({ success: false, message: 'Resource not found' }); };
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => { const status = error instanceof AppError ? error.statusCode : error instanceof ZodError ? 400 : 500; const message = error instanceof AppError ? error.message : error instanceof ZodError ? 'Invalid request data' : 'An unexpected error occurred'; res.status(status).json({ success: false, message, ...(error instanceof AppError && error.errors ? { errors: error.errors } : {}) }); };
