import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../config/data-source';
import { Customer, Lead, Lender, LenderProduct, LoanProduct } from '../entities/crm.entities';
import { User } from '../entities/access.entities';
import { CustomerLifecycleStatus } from '../constants/enums';
import { ApplicationDocument, DocumentChecklist, LoanApplication, LoanQuery } from '../entities/lifecycle.entities';
import { ApplicationStatus, Priority, QueryStatus, RecordStatus } from '../constants/enums';
import { AppError } from '../middleware/error-handler';
import { Agreement, Sanction } from '../entities/lifecycle.entities';
import { ProductField } from '../entities/product-management.entities';
import { applicationDetail, attachDocument, changeApplicationStatus, createApplication, createLoanQuery, editableApplicationStatuses, runApplicationEligibility, saveAgreement, saveCreditAssessment, saveSanction, updateLoanQuery, validateApplicationReferences, writeApplicationAudit, acceptSanction } from '../services/application.service';

const optionalUuid = z.preprocess(value => value === '' ? undefined : value, z.string().uuid().optional());
const applicationInput = z.object({ customerId: z.string().uuid(), leadId: optionalUuid, productId: z.string().uuid(), lenderId: optionalUuid, assignedRmId: optionalUuid, requestedAmount: z.coerce.number().positive(), productDetails: z.record(z.unknown()).optional() });
const listInput = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().optional(), status: z.preprocess(value => value === '' ? undefined : value, z.nativeEnum(ApplicationStatus).optional()), customerId: optionalUuid, productId: optionalUuid, lenderId: optionalUuid, assignedRmId: optionalUuid });
const creditInput = z.object({ creditScore: z.coerce.number().int().min(300).max(900).optional(), foir: z.coerce.number().min(0).max(100).optional(), riskRating: z.string().trim().max(40).optional(), creditStatus: z.string().trim().max(40).optional(), remarks: z.string().trim().max(3000).optional() });
const queryInput = z.object({ lenderId: optionalUuid, assignedToId: optionalUuid, queryType: z.string().trim().min(1).max(100), description: z.string().trim().min(1).max(5000), priority: z.nativeEnum(Priority).default(Priority.MEDIUM), dueDate: z.coerce.date().optional() });
const sanctionInput = z.object({ sanctionAmount: z.coerce.number().positive(), interestRate: z.coerce.number().min(0).max(100).optional(), tenureMonths: z.coerce.number().int().positive().max(600).optional(), emi: z.coerce.number().positive().optional(), sanctionDate: z.coerce.date(), conditions: z.string().trim().max(5000).optional() });

export const referenceData: RequestHandler = async (_req, res, next) => { try {
  const [customers, leads, products, lenders, users] = await Promise.all([
    AppDataSource.getRepository(Customer).createQueryBuilder('customer').select(['customer.id', 'customer.businessId', 'customer.fullName', 'customer.mobile']).where('customer.lifecycle_status != :inactive', { inactive: CustomerLifecycleStatus.INACTIVE }).orderBy('customer.fullName', 'ASC').getMany(),
    AppDataSource.getRepository(Lead).find({ select: ['id', 'businessId', 'customerId', 'productId', 'requiredAmount'], order: { createdAt: 'DESC' } }),
    AppDataSource.getRepository(LoanProduct).find({ where: { status: RecordStatus.ACTIVE }, select: ['id', 'name', 'code'] }),
    AppDataSource.getRepository(Lender).find({ where: { status: RecordStatus.ACTIVE }, select: ['id', 'name'] }),
    AppDataSource.getRepository(User).find({ where: { status: RecordStatus.ACTIVE }, select: ['id', 'firstName', 'lastName', 'email'] }),
  ]);
  res.json({ success: true, data: { customers, leads, products, lenders, users } });
} catch (error) { next(error); } };
export const productFields: RequestHandler = async (req, res, next) => { try { res.json({ success: true, data: await AppDataSource.getRepository(ProductField).find({ where: { productId: String(req.params.productId), status: RecordStatus.ACTIVE }, order: { displayOrder: 'ASC' } }) }); } catch (error) { next(error); } };
export const productLenders: RequestHandler = async (req, res, next) => { try {
  const product = await AppDataSource.getRepository(LoanProduct).findOneBy({ id: String(req.params.productId), status: RecordStatus.ACTIVE });
  if (!product) throw new AppError(404, 'Active loan product not found');
  const mappings = await AppDataSource.getRepository(LenderProduct).find({ where: { productId: product.id, status: RecordStatus.ACTIVE }, relations: ['lender'] });
  res.json({ success: true, data: mappings.filter(mapping => mapping.lender.status === RecordStatus.ACTIVE).map(mapping => ({ id: mapping.lender.id, name: mapping.lender.name })) });
} catch (error) { next(error); } };

export const listApplications: RequestHandler = async (req, res, next) => { try {
  const q = listInput.parse(req.query); const qb = AppDataSource.getRepository(LoanApplication).createQueryBuilder('application').leftJoinAndSelect('application.customer', 'customer').leftJoinAndSelect('application.lead', 'lead').leftJoinAndSelect('application.product', 'product').leftJoinAndSelect('application.lender', 'lender').leftJoinAndSelect('application.assignedRm', 'assignedRm');
  if (q.search) qb.andWhere('(application.business_id LIKE :search OR customer.full_name LIKE :search OR customer.mobile LIKE :search)', { search: `%${q.search}%` });
  for (const [column, value] of Object.entries({ 'application.status': q.status, 'application.customer_id': q.customerId, 'application.product_id': q.productId, 'application.lender_id': q.lenderId, 'application.assigned_rm_id': q.assignedRmId })) if (value) qb.andWhere(`${column} = :${column.replace('.', '_')}`, { [column.replace('.', '_')]: value });
  const [data, total] = await qb.orderBy('application.createdAt', 'DESC').skip((q.page - 1) * q.limit).take(q.limit).getManyAndCount();
  res.json({ success: true, data, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
} catch (error) { next(error); } };

export const create: RequestHandler = async (req, res, next) => { try { const application = await createApplication(applicationInput.parse(req.body), req.auth?.id); res.status(201).json({ success: true, message: 'Loan application created successfully', data: application }); } catch (error) { next(error); } };
export const detail: RequestHandler = async (req, res, next) => { try { res.json({ success: true, data: await applicationDetail(String(req.params.id), Boolean(req.auth?.permissions.includes('audit.view'))) }); } catch (error) { next(error); } };
export const update: RequestHandler = async (req, res, next) => { try {
  const input = applicationInput.partial().parse(req.body); const application = await AppDataSource.getRepository(LoanApplication).findOneBy({ id: String(req.params.id) });
  if (!application) throw new AppError(404, 'Loan application not found');
  if (!editableApplicationStatuses.has(application.status)) throw new AppError(400, 'Only draft applications can be edited');
  const candidate = { customerId: input.customerId ?? application.customerId, leadId: input.leadId ?? application.leadId, productId: input.productId ?? application.productId, lenderId: input.lenderId ?? application.lenderId, assignedRmId: input.assignedRmId ?? application.assignedRmId, requestedAmount: input.requestedAmount ?? Number(application.requestedAmount), productDetails: input.productDetails ?? application.productDetails };
  await AppDataSource.transaction(async manager => { await validateApplicationReferences(manager, candidate); Object.assign(application, input, input.requestedAmount !== undefined ? { requestedAmount: input.requestedAmount.toFixed(2) } : {}); await manager.getRepository(LoanApplication).save(application); await writeApplicationAudit(manager, req.auth?.id, 'update' as never, application.id, { changedFields: Object.keys(input) }); });
  res.json({ success: true, message: 'Loan application updated successfully', data: application });
} catch (error) { next(error); } };
export const setStatus: RequestHandler = async (req, res, next) => { try { const status = z.object({ status: z.nativeEnum(ApplicationStatus) }).parse(req.body).status; const application = await AppDataSource.getRepository(LoanApplication).findOneBy({ id: String(req.params.id) }); if (!application) throw new AppError(404, 'Loan application not found'); res.json({ success: true, data: await changeApplicationStatus(application, status, req.auth?.id) }); } catch (error) { next(error); } };
export const assign: RequestHandler = async (req, res, next) => { try { const assignedRmId = z.object({ assignedRmId: z.string().uuid() }).parse(req.body).assignedRmId; const application = await AppDataSource.getRepository(LoanApplication).findOneBy({ id: String(req.params.id) }); if (!application) throw new AppError(404, 'Loan application not found'); await AppDataSource.transaction(async manager => { await validateApplicationReferences(manager, { customerId: application.customerId, leadId: application.leadId, productId: application.productId, lenderId: application.lenderId, assignedRmId, requestedAmount: Number(application.requestedAmount) }); application.assignedRmId = assignedRmId; await manager.getRepository(LoanApplication).save(application); await writeApplicationAudit(manager, req.auth?.id, 'assign' as never, application.id, { assignedRmId }); }); res.json({ success: true, data: application }); } catch (error) { next(error); } };
export const evaluate: RequestHandler = async (req, res, next) => { try { const values = z.object({ values: z.record(z.unknown()).optional() }).parse(req.body).values; const application = await AppDataSource.getRepository(LoanApplication).findOneBy({ id: String(req.params.id) }); if (!application) throw new AppError(404, 'Loan application not found'); res.json({ success: true, data: await runApplicationEligibility(application, values, req.auth?.id) }); } catch (error) { next(error); } };
export const checklist: RequestHandler = async (req, res, next) => { try { const application = await AppDataSource.getRepository(LoanApplication).findOneBy({ id: String(req.params.id) }); if (!application) throw new AppError(404, 'Loan application not found'); const data = await AppDataSource.getRepository(DocumentChecklist).createQueryBuilder('checklist').where('(checklist.product_id = :productId OR checklist.product_id IS NULL)', { productId: application.productId }).orderBy('checklist.documentType', 'ASC').getMany(); res.json({ success: true, data }); } catch (error) { next(error); } };
export const attach: RequestHandler = async (req, res, next) => { try { const body = z.object({ documentId: z.string().uuid(), checklistId: optionalUuid }).parse(req.body); res.status(201).json({ success: true, data: await attachDocument(String(req.params.id), body.documentId, body.checklistId, req.auth?.id) }); } catch (error) { next(error); } };
export const credit: RequestHandler = async (req, res, next) => { try { const input = creditInput.parse(req.body); res.json({ success: true, data: await saveCreditAssessment(String(req.params.id), { ...input, foir: input.foir?.toFixed(2) }, req.auth?.id) }); } catch (error) { next(error); } };
export const createQuery: RequestHandler = async (req, res, next) => { try { res.status(201).json({ success: true, data: await createLoanQuery(String(req.params.id), queryInput.parse(req.body), req.auth?.id) }); } catch (error) { next(error); } };
export const updateQuery: RequestHandler = async (req, res, next) => { try { const input = z.object({ assignedToId: optionalUuid, status: z.nativeEnum(QueryStatus).optional(), response: z.string().trim().max(5000).optional(), priority: z.nativeEnum(Priority).optional(), dueDate: z.coerce.date().optional() }).parse(req.body); res.json({ success: true, data: await updateLoanQuery(String(req.params.id), String(req.params.queryId), input, req.auth?.id) }); } catch (error) { next(error); } };
export const upsertSanction: RequestHandler = async (req, res, next) => { try { const input = sanctionInput.parse(req.body); res.json({ success: true, data: await saveSanction(String(req.params.id), { ...input, sanctionAmount: input.sanctionAmount.toFixed(2), interestRate: input.interestRate?.toFixed(3), emi: input.emi?.toFixed(2), sanctionDate: input.sanctionDate.toISOString().slice(0, 10), customerAccepted: false }, req.auth?.id) }); } catch (error) { next(error); } };
export const sanctionAcceptance: RequestHandler = async (req, res, next) => { try { const accepted = z.object({ accepted: z.boolean() }).parse(req.body).accepted; res.json({ success: true, data: await acceptSanction(String(req.params.id), accepted, req.auth?.id) }); } catch (error) { next(error); } };
export const upsertAgreement: RequestHandler = async (req, res, next) => { try { const input = z.object({ documentId: optionalUuid, esignStatus: z.string().trim().max(40).optional(), signedAt: z.coerce.date().optional() }).parse(req.body); res.json({ success: true, data: await saveAgreement(String(req.params.id), input, req.auth?.id) }); } catch (error) { next(error); } };
