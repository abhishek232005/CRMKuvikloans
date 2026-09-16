import { AppDataSource } from '../config/data-source';
import type { EntityTarget, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ApplicationStatus, LeadStatus, QueryStatus } from '../constants/enums';
import { Customer, Lead } from '../entities/crm.entities';
import { Agreement, CreditAssessment, Document, EligibilityCheck, LoanApplication, LoanQuery, Sanction } from '../entities/lifecycle.entities';
import { AuditLog } from '../entities/work-finance.entities';
import type { DashboardRange } from '../utils/dashboard-range';

type CountRow = { value: string | null; count: string };

const phaseEightStatuses = [
  ApplicationStatus.DISBURSEMENT_PENDING,
  ApplicationStatus.PART_DISBURSED,
  ApplicationStatus.FULLY_DISBURSED,
];

const inProgressStatuses = [
  ApplicationStatus.READY_TO_LOGIN,
  ApplicationStatus.LOGIN_PENDING,
  ApplicationStatus.LOGGED_IN,
  ApplicationStatus.UNDER_PROCESS,
  ApplicationStatus.QUERY,
  ApplicationStatus.DOCUMENTATION,
];

function addRange<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, alias: string, range: DashboardRange) {
  return query.andWhere(`${alias}.created_at BETWEEN :dashboardFrom AND :dashboardTo`, {
    dashboardFrom: range.startsAt,
    dashboardTo: range.endsAt,
  });
}

function toCount(value: string | number | undefined) {
  return Number(value ?? 0);
}

async function countCreated<T extends ObjectLiteral>(entity: EntityTarget<T>, alias: string, range: DashboardRange) {
  return addRange(AppDataSource.getRepository(entity).createQueryBuilder(alias), alias, range).getCount();
}

export async function getDashboardOverview(range: DashboardRange, includeAudit: boolean) {
  const customers = await AppDataSource.getRepository(Customer).count();
  const leads = await countCreated(Lead, 'lead', range);
  const applicationsQuery = addRange(AppDataSource.getRepository(LoanApplication).createQueryBuilder('application'), 'application', range);
  const applications = await applicationsQuery.getCount();
  const sanctionedApplications = await addRange(AppDataSource.getRepository(LoanApplication).createQueryBuilder('application'), 'application', range)
    .andWhere('application.status = :sanctioned', { sanctioned: ApplicationStatus.SANCTIONED })
    .getCount();
  const activeLeads = await addRange(AppDataSource.getRepository(Lead).createQueryBuilder('lead'), 'lead', range)
    .andWhere('lead.status NOT IN (:...inactiveStatuses)', { inactiveStatuses: [LeadStatus.LOST, LeadStatus.ON_HOLD] })
    .getCount();
  const applicationsInProgress = await addRange(AppDataSource.getRepository(LoanApplication).createQueryBuilder('application'), 'application', range)
    .andWhere('application.status IN (:...statuses)', { statuses: inProgressStatuses })
    .getCount();
  const rejectedApplications = await addRange(AppDataSource.getRepository(LoanApplication).createQueryBuilder('application'), 'application', range)
    .andWhere('application.status = :rejected', { rejected: ApplicationStatus.REJECTED })
    .getCount();
  const pendingQueries = await addRange(AppDataSource.getRepository(LoanQuery).createQueryBuilder('query'), 'query', range)
    .andWhere('query.status IN (:...openStatuses)', { openStatuses: [QueryStatus.OPEN, QueryStatus.ASSIGNED, QueryStatus.IN_PROGRESS] })
    .getCount();

  const [leadByStatus, leadBySource, applicationByStatus, applicationByProduct, applicationByLender, documentByStatus, queryByStatus, creditByStatus, sanctionSummary, funnel, recentActivity] = await Promise.all([
    addRange(AppDataSource.getRepository(Lead).createQueryBuilder('lead'), 'lead', range)
      .select('lead.status', 'value').addSelect('COUNT(*)', 'count').groupBy('lead.status').orderBy('count', 'DESC').getRawMany<CountRow>(),
    addRange(AppDataSource.getRepository(Lead).createQueryBuilder('lead').leftJoin('lead.source', 'source'), 'lead', range)
      .select("COALESCE(source.name, 'Unattributed')", 'value').addSelect('COUNT(*)', 'count').groupBy('source.name').orderBy('count', 'DESC').getRawMany<CountRow>(),
    addRange(AppDataSource.getRepository(LoanApplication).createQueryBuilder('application'), 'application', range)
      .andWhere('application.status NOT IN (:...phaseEightStatuses)', { phaseEightStatuses })
      .select('application.status', 'value').addSelect('COUNT(*)', 'count').groupBy('application.status').orderBy('count', 'DESC').getRawMany<CountRow>(),
    addRange(AppDataSource.getRepository(LoanApplication).createQueryBuilder('application').leftJoin('application.product', 'product'), 'application', range)
      .select('product.name', 'value').addSelect('COUNT(*)', 'count').groupBy('product.name').orderBy('count', 'DESC').getRawMany<CountRow>(),
    addRange(AppDataSource.getRepository(LoanApplication).createQueryBuilder('application').leftJoin('application.lender', 'lender'), 'application', range)
      .andWhere('application.lender_id IS NOT NULL')
      .select('lender.name', 'name').addSelect('COUNT(*)', 'applications')
      .addSelect('SUM(CASE WHEN application.status = :sanctioned THEN 1 ELSE 0 END)', 'approved')
      .setParameter('sanctioned', ApplicationStatus.SANCTIONED)
      .groupBy('lender.name').orderBy('applications', 'DESC').getRawMany<{ name: string; applications: string; approved: string }>(),
    addRange(AppDataSource.getRepository(Document).createQueryBuilder('document'), 'document', range)
      .select('document.status', 'value').addSelect('COUNT(*)', 'count').groupBy('document.status').orderBy('count', 'DESC').getRawMany<CountRow>(),
    addRange(AppDataSource.getRepository(LoanQuery).createQueryBuilder('query'), 'query', range)
      .select('query.status', 'value').addSelect('COUNT(*)', 'count').groupBy('query.status').orderBy('count', 'DESC').getRawMany<CountRow>(),
    addRange(AppDataSource.getRepository(CreditAssessment).createQueryBuilder('credit'), 'credit', range)
      .select("COALESCE(NULLIF(credit.credit_status, ''), 'unspecified')", 'value').addSelect('COUNT(*)', 'count').groupBy('credit.credit_status').orderBy('count', 'DESC').getRawMany<CountRow>(),
    addRange(AppDataSource.getRepository(Sanction).createQueryBuilder('sanction'), 'sanction', range)
      .select('COUNT(*)', 'total').addSelect('SUM(CASE WHEN sanction.customer_accepted = 1 THEN 1 ELSE 0 END)', 'accepted').getRawOne<{ total: string; accepted: string }>(),
    Promise.all([
      countCreated(Lead, 'lead', range),
      countCreated(EligibilityCheck, 'eligibility', range),
      countCreated(Document, 'document', range),
      countCreated(LoanApplication, 'application', range),
      countCreated(CreditAssessment, 'credit', range),
      countCreated(LoanQuery, 'query', range),
      countCreated(Sanction, 'sanction', range),
      countCreated(Agreement, 'agreement', range),
    ]),
    includeAudit
      ? addRange(AppDataSource.getRepository(AuditLog).createQueryBuilder('audit'), 'audit', range)
        .select(['audit.id AS id', 'audit.module AS module', 'audit.action AS action', 'audit.entity_type AS entityType', 'audit.created_at AS createdAt'])
        .orderBy('audit.created_at', 'DESC').take(10).getRawMany<{ id: string; module: string; action: string; entityType: string; createdAt: Date }>()
      : Promise.resolve([]),
  ]);

  const toBreakdown = (rows: CountRow[]) => rows.map(row => ({ label: row.value ?? 'Unspecified', count: toCount(row.count) }));
  const totalDocuments = documentByStatus.reduce((sum: number, row: CountRow) => sum + toCount(row.count), 0);
  const queryBreakdown = toBreakdown(queryByStatus);
  const sanctionTotal = toCount(sanctionSummary?.total);
  const sanctionsAccepted = toCount(sanctionSummary?.accepted);

  return {
    range: { preset: range.preset, from: range.from, to: range.to },
    kpis: { customers, leads, applications, sanctionedApplications, activeLeads, applicationsInProgress, rejectedApplications, pendingQueries },
    leadOverview: { byStatus: toBreakdown(leadByStatus), bySource: toBreakdown(leadBySource) },
    applicationOverview: { byStatus: toBreakdown(applicationByStatus) },
    products: toBreakdown(applicationByProduct),
    lenders: applicationByLender.map((row: { name: string; applications: string; approved: string }) => ({ name: row.name, applications: toCount(row.applications), approved: toCount(row.approved) })),
    documents: { total: totalDocuments, byStatus: toBreakdown(documentByStatus) },
    operations: {
      queries: { total: queryBreakdown.reduce((sum: number, row: { label: string; count: number }) => sum + row.count, 0), byStatus: queryBreakdown },
      credit: { total: creditByStatus.reduce((sum: number, row: CountRow) => sum + toCount(row.count), 0), byStatus: toBreakdown(creditByStatus) },
      sanctions: { total: sanctionTotal, accepted: sanctionsAccepted, pendingAcceptance: sanctionTotal - sanctionsAccepted },
    },
    funnel: [
      ['Leads', funnel[0]], ['Eligibility', funnel[1]], ['Documents', funnel[2]], ['Applications', funnel[3]],
      ['Credit assessments', funnel[4]], ['Queries', funnel[5]], ['Sanctions', funnel[6]], ['Agreements', funnel[7]],
    ].map(([label, count]) => ({ label, count: Number(count) })),
    activity: { available: includeAudit, items: recentActivity },
  };
}
