import assert from 'node:assert/strict';
import { AppDataSource } from '../config/data-source';
import { ApplicationStatus, DocumentStatus, LeadStatus, Priority, QueryStatus } from '../constants/enums';
import { Customer, Lead, LeadSource, LoanProduct } from '../entities/crm.entities';
import { Document, LoanApplication, LoanQuery } from '../entities/lifecycle.entities';
import { AuditLog } from '../entities/work-finance.entities';
import { getDashboardOverview } from '../services/dashboard.service';
import { resolveDashboardRange } from '../utils/dashboard-range';
import { requireTestDatabaseName } from './integration-db.guard';

const prefix = `QA-DASH-${String(Date.now()).slice(-8)}`;
const ids: Record<string, string> = {};

async function run() {
  requireTestDatabaseName(process.env.DB_NAME ?? '');
  await AppDataSource.initialize();
  try {
    const product = await AppDataSource.getRepository(LoanProduct).findOneOrFail({ where: {} });
    const source = await AppDataSource.getRepository(LeadSource).findOne({ where: {} });
    const customer = await AppDataSource.getRepository(Customer).save({ businessId: `${prefix}-CUSTOMER`, fullName: `${prefix} Customer`, mobile: `9${String(Date.now()).slice(-9)}` });
    ids.customer = customer.id;
    const lead = await AppDataSource.getRepository(Lead).save({ businessId: `${prefix}-LEAD`, customerId: customer.id, sourceId: source?.id, productId: product.id, requiredAmount: '250000.00', status: LeadStatus.INTERESTED });
    ids.lead = lead.id;
    const application = await AppDataSource.getRepository(LoanApplication).save({ businessId: `${prefix}-APPLICATION`, customerId: customer.id, leadId: lead.id, productId: product.id, requestedAmount: '250000.00', status: ApplicationStatus.UNDER_PROCESS });
    ids.application = application.id;
    const phaseEightApplication = await AppDataSource.getRepository(LoanApplication).save({ businessId: `${prefix}-PHASE8`, customerId: customer.id, productId: product.id, requestedAmount: '100000.00', status: ApplicationStatus.PART_DISBURSED });
    ids.phaseEightApplication = phaseEightApplication.id;
    const document = await AppDataSource.getRepository(Document).save({ businessId: `${prefix}-DOCUMENT`, storageKey: 'redacted-test-storage-key', originalFileName: 'dashboard-test.pdf', mimeType: 'application/pdf', sizeBytes: 100, checksumSha256: '0'.repeat(64), status: DocumentStatus.VERIFIED });
    ids.document = document.id;
    const query = await AppDataSource.getRepository(LoanQuery).save({ businessId: `${prefix}-QUERY`, applicationId: application.id, queryType: 'Document', description: 'Dashboard aggregate fixture', priority: Priority.MEDIUM, status: QueryStatus.OPEN });
    ids.query = query.id;
    const audit = await AppDataSource.getRepository(AuditLog).save({ action: 'create' as never, module: 'applications', entityType: 'LoanApplication', entityId: application.id, newValue: { storageKey: 'must-not-be-returned', pan: 'must-not-be-returned' } });
    ids.audit = audit.id;

    const data = await getDashboardOverview(resolveDashboardRange({ preset: 'today' }), true);
    assert.ok(data.kpis.leads >= 1);
    assert.ok(data.kpis.applications >= 2);
    assert.ok(data.kpis.pendingQueries >= 1);
    assert.ok(data.leadOverview.byStatus.some(row => row.label === LeadStatus.INTERESTED));
    assert.ok(data.applicationOverview.byStatus.some(row => row.label === ApplicationStatus.UNDER_PROCESS));
    assert.ok(!data.applicationOverview.byStatus.some(row => row.label === ApplicationStatus.PART_DISBURSED));
    assert.ok(data.documents.byStatus.some(row => row.label === DocumentStatus.VERIFIED));
    assert.ok(data.activity.items.some(item => item.module === 'applications' && item.action === 'create'));
    assert.ok(!JSON.stringify(data).includes('must-not-be-returned'));
    assert.ok(!JSON.stringify(data).includes('redacted-test-storage-key'));
    assert.ok(!JSON.stringify(data).includes('checksumSha256'));
    const withoutAudit = await getDashboardOverview(resolveDashboardRange({ preset: 'today' }), false);
    assert.deepEqual(withoutAudit.activity, { available: false, items: [] });
    console.info('Dashboard integration checks passed.');
  } finally {
    if (ids.audit) await AppDataSource.getRepository(AuditLog).delete(ids.audit);
    if (ids.query) await AppDataSource.getRepository(LoanQuery).delete(ids.query);
    if (ids.document) await AppDataSource.getRepository(Document).delete(ids.document);
    if (ids.application) await AppDataSource.getRepository(LoanApplication).delete(ids.application);
    if (ids.phaseEightApplication) await AppDataSource.getRepository(LoanApplication).delete(ids.phaseEightApplication);
    if (ids.lead) await AppDataSource.getRepository(Lead).delete(ids.lead);
    if (ids.customer) await AppDataSource.getRepository(Customer).delete(ids.customer);
    await AppDataSource.destroy();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
