process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'kuvik_crm_test';
process.env.SEED_ADMIN_EMAIL = 'admin@test.local';
process.env.SEED_ADMIN_PASSWORD = 'Test-Password-Only-For-Tests';
require('ts-node/register/transpile-only');
require('./dashboard.api.integration.ts');
