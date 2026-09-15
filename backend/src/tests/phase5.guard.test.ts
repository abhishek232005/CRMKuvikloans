import { describe, expect, it } from 'vitest';
import { requireTestDatabaseName } from './integration-db.guard';

describe('Phase 5 integration database guard', () => {
  it('rejects a normal development database name', () => {
    expect(() => requireTestDatabaseName('kuvik_crm')).toThrow(/TEST_DB_NAME/);
  });

  it('accepts an explicitly named test database', () => {
    expect(requireTestDatabaseName('kuvik_crm_test')).toBe('kuvik_crm_test');
  });
});
