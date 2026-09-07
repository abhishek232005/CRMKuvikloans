import type { AuthenticatedUser } from '../services/auth.service';
declare global { namespace Express { interface Request { auth?: AuthenticatedUser; } } }
export {};
