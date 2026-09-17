import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { env } from '../config/env';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/access.entities';
import { requireTestDatabaseName } from './integration-db.guard';

const temporaryEmail = `qa-dashboard-${Date.now()}@test.local`;

async function run() {
  requireTestDatabaseName(process.env.DB_NAME ?? '');
  await AppDataSource.initialize();
  const server = app.listen(0);
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a local port');
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    const unauthenticated = await fetch(`${baseUrl}/dashboard/overview`);
    assert.equal(unauthenticated.status, 401);

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.local', password: 'Test-Password-Only-For-Tests' }),
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json() as { data: { accessToken: string } };
    const authorized = await fetch(`${baseUrl}/dashboard/overview?preset=last_7_days`, { headers: { authorization: `Bearer ${loginBody.data.accessToken}` } });
    assert.equal(authorized.status, 200);
    const authorizedBody = await authorized.json() as { data: unknown };
    const serialized = JSON.stringify(authorizedBody.data);
    assert.ok(!serialized.includes('storageKey'));
    assert.ok(!serialized.includes('checksumSha256'));
    assert.ok(!serialized.includes('newValue'));
    assert.ok(!serialized.includes('oldValue'));

    const invalidRange = await fetch(`${baseUrl}/dashboard/overview?preset=custom&from=2026-09-15&to=2026-09-01`, { headers: { authorization: `Bearer ${loginBody.data.accessToken}` } });
    assert.equal(invalidRange.status, 400);

    const restricted = await AppDataSource.getRepository(User).save({ email: temporaryEmail, firstName: 'Dashboard', lastName: 'Restricted', passwordHash: await bcrypt.hash('Not-Used-In-UI-Tests', 10) });
    const restrictedToken = jwt.sign({ sub: restricted.id }, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    const forbidden = await fetch(`${baseUrl}/dashboard/overview`, { headers: { authorization: `Bearer ${restrictedToken}` } });
    assert.equal(forbidden.status, 403);
    await AppDataSource.getRepository(User).delete(restricted.id);
    console.info('Dashboard API authorization checks passed.');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await AppDataSource.getRepository(User).delete({ email: temporaryEmail });
    await AppDataSource.destroy();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
