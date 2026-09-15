import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { AppDataSource } from '../config/data-source';
import { env } from '../config/env';
import { DocumentStatus } from '../constants/enums';
import { Document } from '../entities/lifecycle.entities';
import { DocumentLink, DocumentVersion } from '../entities/product-management.entities';
import { CustomerDocument } from '../entities/customer-management.entities';
import { nextBusinessId } from './business-id.service';
import { AppError } from '../middleware/error-handler';

const privateDirectory = path.resolve(env.UPLOAD_DIR);
const allowedMimeTypes = new Set(env.DOCUMENT_ALLOWED_MIME_TYPES.split(',').map(value => value.trim()).filter(Boolean));

export function assertDocumentFile(file: Express.Multer.File | undefined) {
  if (!file) throw new AppError(400, 'A document file is required');
  if (!allowedMimeTypes.has(file.mimetype)) throw new AppError(400, 'This document type is not allowed');
  if (file.size > env.DOCUMENT_MAX_SIZE_MB * 1024 * 1024) throw new AppError(400, 'Document exceeds the configured size limit');
}

function safeName(name: string) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'document';
}

export function safeDocument(document: Document, link?: DocumentLink) {
  return {
    id: document.id, businessId: document.businessId, originalFileName: document.originalFileName,
    mimeType: document.mimeType, sizeBytes: document.sizeBytes, status: document.status,
    versionNumber: document.versionNumber, createdAt: document.createdAt, updatedAt: document.updatedAt,
    ...(link ? { link: { id: link.id, customerId: link.customerId, leadId: link.leadId, applicationId: link.applicationId, productId: link.productId, documentType: link.documentType, verifiedAt: link.verifiedAt, rejectionReason: link.rejectionReason } } : {}),
  };
}

export async function storeDocument(input: { file: Express.Multer.File; uploadedById: string; documentType: string; customerId?: string; leadId?: string; applicationId?: string; productId?: string; previousDocumentId?: string }) {
  assertDocumentFile(input.file);
  await mkdir(privateDirectory, { recursive: true });
  const originalFileName = safeName(input.file.originalname);
  const storageKey = `${randomUUID()}-${originalFileName}`;
  await writeFile(path.join(privateDirectory, storageKey), input.file.buffer, { flag: 'wx' });
  const checksumSha256 = createHash('sha256').update(input.file.buffer).digest('hex');
  return AppDataSource.transaction(async manager => {
    const previous = input.previousDocumentId ? await manager.getRepository(Document).findOneBy({ id: input.previousDocumentId }) : null;
    if (input.previousDocumentId && !previous) throw new AppError(404, 'Previous document not found');
    const document = await manager.getRepository(Document).save({
      businessId: await nextBusinessId(manager, 'document'), storageKey, originalFileName,
      mimeType: input.file.mimetype, sizeBytes: input.file.size, checksumSha256, uploadedById: input.uploadedById,
      status: DocumentStatus.UPLOADED, versionNumber: (previous?.versionNumber ?? 0) + 1,
    });
    const link = await manager.getRepository(DocumentLink).save({ documentId: document.id, documentType: input.documentType, customerId: input.customerId, leadId: input.leadId, applicationId: input.applicationId, productId: input.productId });
    if (input.customerId) await manager.getRepository(CustomerDocument).save({ customerId: input.customerId, documentId: document.id, documentType: input.documentType });
    if (previous) await manager.getRepository(DocumentVersion).save({ documentId: document.id, previousDocumentId: previous.id, versionNumber: document.versionNumber });
    return safeDocument(document, link);
  });
}

export async function listDocuments(filters: { customerId?: string; leadId?: string; applicationId?: string; productId?: string }) {
  const query = AppDataSource.getRepository(DocumentLink).createQueryBuilder('link').innerJoinAndSelect('link.document', 'document').orderBy('link.created_at', 'DESC');
  for (const [key, value] of Object.entries(filters)) if (value) query.andWhere(`link.${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)} = :${key}`, { [key]: value });
  const links = await query.getMany();
  return links.map(link => safeDocument(link.document, link));
}

export async function getDownload(id: string) {
  const document = await AppDataSource.getRepository(Document).findOneBy({ id });
  if (!document) throw new AppError(404, 'Document not found');
  return { document, contents: await readFile(path.join(privateDirectory, document.storageKey)) };
}

export async function changeVerification(id: string, verifiedById: string, status: DocumentStatus.VERIFIED | DocumentStatus.REJECTED, rejectionReason?: string) {
  const document = await AppDataSource.getRepository(Document).findOneBy({ id });
  if (!document) throw new AppError(404, 'Document not found');
  document.status = status;
  await AppDataSource.getRepository(Document).save(document);
  const link = await AppDataSource.getRepository(DocumentLink).findOneBy({ documentId: id });
  if (link) { link.verifiedById = verifiedById; link.verifiedAt = new Date(); link.rejectionReason = status === DocumentStatus.REJECTED ? rejectionReason : undefined; await AppDataSource.getRepository(DocumentLink).save(link); }
  return safeDocument(document, link ?? undefined);
}

export async function versions(id: string) {
  const records = await AppDataSource.getRepository(DocumentVersion).find({ where: { documentId: id }, order: { versionNumber: 'DESC' } });
  return records;
}
