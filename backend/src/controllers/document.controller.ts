import type { RequestHandler } from 'express';
import { z } from 'zod';
import { DocumentStatus } from '../constants/enums';
import { changeVerification, getDownload, listDocuments, storeDocument, versions } from '../services/document.service';
import { Customer, Lead, LoanProduct } from '../entities/crm.entities';
import { AppDataSource } from '../config/data-source';

const optionalUuid = z.preprocess(value => value === '' ? undefined : value, z.string().uuid().optional());
const links = z.object({ documentType: z.string().trim().min(1).max(100), customerId: optionalUuid, leadId: optionalUuid, applicationId: optionalUuid, productId: optionalUuid, previousDocumentId: optionalUuid });
export const upload: RequestHandler = async (req, res, next) => { try { const data = links.parse(req.body); const document = await storeDocument({ ...data, file: req.file!, uploadedById: req.auth!.id }); res.status(201).json({ success: true, data: document }); } catch (error) { next(error); } };
export const list: RequestHandler = async (req, res, next) => { try { const filters = z.object({ customerId: optionalUuid, leadId: optionalUuid, applicationId: optionalUuid, productId: optionalUuid }).parse(req.query); res.json({ success: true, data: await listDocuments(filters) }); } catch (error) { next(error); } };
export const download: RequestHandler = async (req, res, next) => { try { const { document, contents } = await getDownload(String(req.params.id)); res.type(document.mimeType).setHeader('Content-Disposition', `attachment; filename="${document.originalFileName.replace(/"/g, '')}"`).send(contents); } catch (error) { next(error); } };
export const verify: RequestHandler = async (req, res, next) => { try { res.json({ success: true, data: await changeVerification(String(req.params.id), req.auth!.id, DocumentStatus.VERIFIED) }); } catch (error) { next(error); } };
export const reject: RequestHandler = async (req, res, next) => { try { const { reason } = z.object({ reason: z.string().min(3).max(1000) }).parse(req.body); res.json({ success: true, data: await changeVerification(String(req.params.id), req.auth!.id, DocumentStatus.REJECTED, reason) }); } catch (error) { next(error); } };
export const history: RequestHandler = async (req, res, next) => { try { res.json({ success: true, data: await versions(String(req.params.id)) }); } catch (error) { next(error); } };
export const referenceData: RequestHandler = async (_req, res, next) => { try { const [customers, leads, products] = await Promise.all([AppDataSource.getRepository(Customer).find({ select: ['id', 'businessId', 'fullName'], order: { fullName: 'ASC' } }), AppDataSource.getRepository(Lead).find({ select: ['id', 'businessId'], order: { createdAt: 'DESC' } }), AppDataSource.getRepository(LoanProduct).find({ select: ['id', 'name'], order: { name: 'ASC' } })]); res.json({ success: true, data: { customers, leads, products } }); } catch (error) { next(error); } };
