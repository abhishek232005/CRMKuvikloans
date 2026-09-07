import { describe, expect, it } from 'vitest';
import { decryptField, encryptField, maskSensitive } from '../utils/field-crypto';
import { formatBusinessId } from '../utils/business-id';
describe('database foundation utilities', () => {
  it('creates stable business IDs', () => expect(formatBusinessId('customer', 12)).toBe('KUV-CUST-000012'));
  it('encrypts, decrypts, and masks sensitive values', () => { const encrypted = encryptField('ABCDE1234F'); expect(encrypted).not.toContain('ABCDE1234F'); expect(decryptField(encrypted)).toBe('ABCDE1234F'); expect(maskSensitive('ABCDE1234F')).toBe('******234F'); });
});
