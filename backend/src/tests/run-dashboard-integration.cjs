process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'kuvik_crm_test';
require('ts-node/register/transpile-only');
require('./dashboard.integration.ts');
