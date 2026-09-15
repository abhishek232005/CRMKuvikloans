import { EntityManager } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { Customer, Lead, Lender, LenderProduct, LoanProduct } from '../entities/crm.entities';
import { Agreement, ApplicationDocument, CreditAssessment, Document, DocumentChecklist, EligibilityCheck, LoanApplication, LoanQuery, Sanction } from '../entities/lifecycle.entities';
import { AuditLog } from '../entities/work-finance.entities';
import { ApplicationStatus, AuditAction, CustomerLifecycleStatus, DocumentStatus, QueryStatus, RecordStatus } from '../constants/enums';
import { AppError } from '../middleware/error-handler';
import { nextBusinessId } from './business-id.service';
import { evaluateEligibility } from './product-management.service';
import { applicationStatusTransitions } from '../utils/application-workflow';

export const editableApplicationStatuses = new Set([ApplicationStatus.DRAFT]);

export { applicationStatusTransitions } from '../utils/application-workflow';

export type ApplicationInput = {
  customerId: string; leadId?: string; productId: string; lenderId?: string; assignedRmId?: string;
  requestedAmount: number; productDetails?: Record<string, unknown>;
};

async function activeUser(manager: EntityManager, id: string) {
  const { User } = await import('../entities/access.entities');
  const user = await manager.getRepository(User).findOneBy({ id });
  if (!user || user.status !== RecordStatus.ACTIVE) throw new AppError(400, 'Assigned employee must be active');
}

export async function validateApplicationReferences(manager: EntityManager, input: ApplicationInput) {
  const customer = await manager.getRepository(Customer).findOneBy({ id: input.customerId });
  if (!customer) throw new AppError(404, 'Customer not found');
  if (customer.lifecycleStatus === CustomerLifecycleStatus.INACTIVE) throw new AppError(400, 'Inactive customers cannot receive new applications');
  const product = await manager.getRepository(LoanProduct).findOneBy({ id: input.productId });
  if (!product || product.status !== RecordStatus.ACTIVE) throw new AppError(400, 'Loan product must be active');
  if (input.leadId) {
    const lead = await manager.getRepository(Lead).findOneBy({ id: input.leadId });
    if (!lead) throw new AppError(404, 'Lead not found');
    if (lead.customerId !== input.customerId) throw new AppError(400, 'Lead must belong to the selected customer');
  }
  if (input.lenderId) {
    const lender = await manager.getRepository(Lender).findOneBy({ id: input.lenderId });
    if (!lender || lender.status !== RecordStatus.ACTIVE) throw new AppError(400, 'Lender must be active');
    const mapping = await manager.getRepository(LenderProduct).findOneBy({ lenderId: input.lenderId, productId: input.productId, status: RecordStatus.ACTIVE });
    if (!mapping) throw new AppError(400, 'Selected lender is not active for this product');
  }
  if (input.assignedRmId) await activeUser(manager, input.assignedRmId);
  return { customer, product };
}

export async function writeApplicationAudit(manager: EntityManager, userId: string | undefined, action: AuditAction, applicationId: string, changes: Record<string, unknown>) {
  await manager.getRepository(AuditLog).save({ userId, action, module: 'applications', entityType: 'LoanApplication', entityId: applicationId, newValue: changes });
}

export async function syncCustomerLifecycle(manager: EntityManager, customerId: string, status: ApplicationStatus) {
  const lifecycle = status === ApplicationStatus.SANCTIONED ? CustomerLifecycleStatus.LOAN_APPROVED
    : [ApplicationStatus.READY_TO_LOGIN, ApplicationStatus.LOGIN_PENDING, ApplicationStatus.LOGGED_IN, ApplicationStatus.UNDER_PROCESS, ApplicationStatus.QUERY, ApplicationStatus.DOCUMENTATION].includes(status)
      ? CustomerLifecycleStatus.LOAN_PROCESSING : undefined;
  if (!lifecycle) return;
  const customer = await manager.getRepository(Customer).findOneBy({ id: customerId });
  if (customer && customer.lifecycleStatus !== CustomerLifecycleStatus.INACTIVE) {
    customer.lifecycleStatus = lifecycle;
    await manager.getRepository(Customer).save(customer);
  }
}

export async function createApplication(input: ApplicationInput, userId?: string) {
  return AppDataSource.transaction(async manager => {
    await validateApplicationReferences(manager, input);
    const application = await manager.getRepository(LoanApplication).save({
      ...input,
      businessId: await nextBusinessId(manager, 'application'),
      requestedAmount: input.requestedAmount.toFixed(2),
      status: ApplicationStatus.DRAFT,
    });
    await writeApplicationAudit(manager, userId, AuditAction.CREATE, application.id, { customerId: application.customerId, productId: application.productId, status: application.status });
    return application;
  });
}

export async function changeApplicationStatus(application: LoanApplication, status: ApplicationStatus, userId?: string) {
  if (status === ApplicationStatus.DISBURSEMENT_PENDING || status === ApplicationStatus.PART_DISBURSED || status === ApplicationStatus.FULLY_DISBURSED) throw new AppError(400, 'Disbursement statuses are available in Phase 8');
  if (!applicationStatusTransitions[application.status].includes(status)) throw new AppError(400, `Cannot change application from ${application.status} to ${status}`);
  return AppDataSource.transaction(async manager => {
    application.status = status;
    await manager.getRepository(LoanApplication).save(application);
    await syncCustomerLifecycle(manager, application.customerId, status);
    await writeApplicationAudit(manager, userId, AuditAction.STATUS_CHANGE, application.id, { status });
    return application;
  });
}

export async function runApplicationEligibility(application: LoanApplication, values: Record<string, unknown> | undefined, userId?: string) {
  const result = await evaluateEligibility({ customerId: application.customerId, productId: application.productId, leadId: application.leadId, loanAmount: Number(application.requestedAmount), values });
  const check = await AppDataSource.getRepository(EligibilityCheck).save({ applicationId: application.id, lenderId: application.lenderId, matchLevel: result.recommendations[0]?.matchLevel ?? 'ALTERNATIVE', input: { values: values ?? {} }, result });
  await AppDataSource.transaction(manager => writeApplicationAudit(manager, userId, AuditAction.UPDATE, application.id, { eligibilityCheckId: check.id, matchLevel: check.matchLevel }));
  return { check, result };
}

export async function applicationDetail(id: string, includeAudit: boolean) {
  const application = await AppDataSource.getRepository(LoanApplication).findOne({ where: { id }, relations: ['customer', 'lead', 'product', 'lender', 'assignedRm'] });
  if (!application) throw new AppError(404, 'Loan application not found');
  const [documents, creditAssessment, queries, sanction, agreement, eligibilityChecks, auditHistory] = await Promise.all([
    AppDataSource.getRepository(ApplicationDocument).find({ where: { applicationId: id }, relations: ['document', 'checklist'], order: { createdAt: 'DESC' } }),
    AppDataSource.getRepository(CreditAssessment).findOneBy({ applicationId: id }),
    AppDataSource.getRepository(LoanQuery).find({ where: { applicationId: id }, order: { createdAt: 'DESC' } }),
    AppDataSource.getRepository(Sanction).findOneBy({ applicationId: id }),
    AppDataSource.getRepository(Agreement).findOneBy({ applicationId: id }),
    AppDataSource.getRepository(EligibilityCheck).find({ where: { applicationId: id }, order: { createdAt: 'DESC' } }),
    includeAudit ? AppDataSource.getRepository(AuditLog).find({ where: { module: 'applications', entityType: 'LoanApplication', entityId: id }, order: { createdAt: 'DESC' } }) : Promise.resolve(undefined),
  ]);
  const safeDocuments = documents.map(item => ({
    ...item,
    document: item.document ? {
      id: item.document.id,
      businessId: item.document.businessId,
      originalFileName: item.document.originalFileName,
      mimeType: item.document.mimeType,
      sizeBytes: item.document.sizeBytes,
      status: item.document.status,
      versionNumber: item.document.versionNumber,
      createdAt: item.document.createdAt,
    } : undefined,
  }));
  return {
    application,
    allowedNextStatuses: applicationStatusTransitions[application.status]
      .filter(status => ![ApplicationStatus.DISBURSEMENT_PENDING, ApplicationStatus.PART_DISBURSED, ApplicationStatus.FULLY_DISBURSED].includes(status)),
    documents: safeDocuments,
    creditAssessment,
    queries,
    sanction,
    agreement,
    eligibilityChecks,
    auditHistory,
  };
}

export async function attachDocument(applicationId: string, documentId: string, checklistId?: string, userId?: string) {
  return AppDataSource.transaction(async manager => {
    const [application, document] = await Promise.all([manager.getRepository(LoanApplication).findOneBy({ id: applicationId }), manager.getRepository(Document).findOneBy({ id: documentId })]);
    if (!application) throw new AppError(404, 'Loan application not found');
    if (!document) throw new AppError(404, 'Document not found');
    if (checklistId && !await manager.getRepository(DocumentChecklist).existsBy({ id: checklistId })) throw new AppError(400, 'Document checklist item not found');
    const existing = await manager.getRepository(ApplicationDocument).findOneBy({ applicationId, documentId });
    if (existing) throw new AppError(409, 'Document is already attached to this application');
    const attached = await manager.getRepository(ApplicationDocument).save({ applicationId, documentId, checklistId, status: document.status });
    await writeApplicationAudit(manager, userId, AuditAction.UPDATE, applicationId, { documentAttached: document.businessId, checklistId });
    return attached;
  });
}

export async function saveCreditAssessment(applicationId: string, input: Partial<Pick<CreditAssessment, 'creditScore' | 'foir' | 'riskRating' | 'creditStatus' | 'remarks'>>, userId?: string) {
  return AppDataSource.transaction(async manager => {
    if (!await manager.getRepository(LoanApplication).existsBy({ id: applicationId })) throw new AppError(404, 'Loan application not found');
    let assessment = await manager.getRepository(CreditAssessment).findOneBy({ applicationId });
    assessment = manager.getRepository(CreditAssessment).merge(assessment ?? manager.getRepository(CreditAssessment).create({ applicationId }), input);
    const saved = await manager.getRepository(CreditAssessment).save(assessment);
    await writeApplicationAudit(manager, userId, AuditAction.UPDATE, applicationId, { creditAssessmentId: saved.id, creditStatus: saved.creditStatus, riskRating: saved.riskRating });
    return saved;
  });
}

export async function createLoanQuery(applicationId: string, input: Omit<Pick<LoanQuery, 'lenderId' | 'assignedToId' | 'queryType' | 'description' | 'priority' | 'dueDate'>, never>, userId?: string) {
  return AppDataSource.transaction(async manager => {
    const application = await manager.getRepository(LoanApplication).findOneBy({ id: applicationId });
    if (!application) throw new AppError(404, 'Loan application not found');
    if (input.assignedToId) await activeUser(manager, input.assignedToId);
    const query = await manager.getRepository(LoanQuery).save({ ...input, applicationId, businessId: await nextBusinessId(manager, 'query'), status: input.assignedToId ? QueryStatus.ASSIGNED : QueryStatus.OPEN });
    if ([ApplicationStatus.UNDER_PROCESS, ApplicationStatus.LOGGED_IN].includes(application.status)) { application.status = ApplicationStatus.QUERY; await manager.getRepository(LoanApplication).save(application); await syncCustomerLifecycle(manager, application.customerId, application.status); }
    await writeApplicationAudit(manager, userId, AuditAction.CREATE, applicationId, { queryId: query.id, queryType: query.queryType, priority: query.priority });
    return query;
  });
}

export async function updateLoanQuery(applicationId: string, queryId: string, input: Partial<Pick<LoanQuery, 'assignedToId' | 'status' | 'response' | 'priority' | 'dueDate'>>, userId?: string) {
  return AppDataSource.transaction(async manager => {
    const query = await manager.getRepository(LoanQuery).findOneBy({ id: queryId, applicationId });
    if (!query) throw new AppError(404, 'Loan query not found');
    if (input.assignedToId) await activeUser(manager, input.assignedToId);
    Object.assign(query, input);
    const saved = await manager.getRepository(LoanQuery).save(query);
    await writeApplicationAudit(manager, userId, AuditAction.UPDATE, applicationId, { queryId, status: saved.status });
    return saved;
  });
}

export async function saveSanction(applicationId: string, input: Omit<Sanction, 'id' | 'applicationId' | 'application' | 'createdAt' | 'updatedAt' | 'deletedAt'>, userId?: string) {
  return AppDataSource.transaction(async manager => {
    const application = await manager.getRepository(LoanApplication).findOneBy({ id: applicationId });
    if (!application) throw new AppError(404, 'Loan application not found');
    if (![ApplicationStatus.UNDER_PROCESS, ApplicationStatus.QUERY, ApplicationStatus.DOCUMENTATION, ApplicationStatus.SANCTIONED].includes(application.status)) throw new AppError(400, 'Application must be under processing before sanction');
    let sanction = await manager.getRepository(Sanction).findOneBy({ applicationId });
    sanction = manager.getRepository(Sanction).merge(sanction ?? manager.getRepository(Sanction).create({ applicationId }), input);
    const saved = await manager.getRepository(Sanction).save(sanction);
    application.status = ApplicationStatus.SANCTIONED;
    application.approvedAmount = saved.sanctionAmount;
    await manager.getRepository(LoanApplication).save(application);
    await syncCustomerLifecycle(manager, application.customerId, application.status);
    await writeApplicationAudit(manager, userId, AuditAction.APPROVE, applicationId, { sanctionId: saved.id, sanctionAmount: saved.sanctionAmount });
    return saved;
  });
}

export async function acceptSanction(applicationId: string, accepted: boolean, userId?: string) {
  return AppDataSource.transaction(async manager => {
    const sanction = await manager.getRepository(Sanction).findOneBy({ applicationId });
    if (!sanction) throw new AppError(404, 'Sanction not found');
    sanction.customerAccepted = accepted;
    sanction.acceptedAt = accepted ? new Date() : undefined;
    const saved = await manager.getRepository(Sanction).save(sanction);
    await writeApplicationAudit(manager, userId, AuditAction.UPDATE, applicationId, { sanctionAccepted: accepted });
    return saved;
  });
}

export async function saveAgreement(applicationId: string, input: Pick<Agreement, 'documentId' | 'esignStatus' | 'signedAt'>, userId?: string) {
  return AppDataSource.transaction(async manager => {
    const [application, sanction] = await Promise.all([manager.getRepository(LoanApplication).findOneBy({ id: applicationId }), manager.getRepository(Sanction).findOneBy({ applicationId })]);
    if (!application) throw new AppError(404, 'Loan application not found');
    if (!sanction?.customerAccepted) throw new AppError(400, 'Customer must accept the sanction before agreement');
    if (input.documentId && !await manager.getRepository(Document).existsBy({ id: input.documentId })) throw new AppError(400, 'Agreement document not found');
    let agreement = await manager.getRepository(Agreement).findOneBy({ applicationId });
    agreement = manager.getRepository(Agreement).merge(agreement ?? manager.getRepository(Agreement).create({ applicationId }), input);
    const saved = await manager.getRepository(Agreement).save(agreement);
    await writeApplicationAudit(manager, userId, AuditAction.UPDATE, applicationId, { agreementId: saved.id, esignStatus: saved.esignStatus, signed: Boolean(saved.signedAt) });
    return saved;
  });
}
