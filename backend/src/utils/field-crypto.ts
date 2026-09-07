import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../config/env';
const key = () => createHash('sha256').update(env.FIELD_ENCRYPTION_KEY).digest();
export const encryptField = (value?: string | null): string | null => { if (!value) return null; const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv); const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.'); };
export const decryptField = (value?: string | null): string | null => { if (!value) return null; const [iv, tag, encrypted] = value.split('.'); const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url')); decipher.setAuthTag(Buffer.from(tag, 'base64url')); return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'); };
export const maskSensitive = (value?: string | null, visible = 4) => !value ? null : `${'*'.repeat(Math.max(0, value.length - visible))}${value.slice(-visible)}`;
