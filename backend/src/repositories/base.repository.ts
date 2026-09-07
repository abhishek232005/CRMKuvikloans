import type { DeepPartial, EntityTarget, EntityManager, ObjectLiteral, Repository } from 'typeorm';
/** Small repository factory used by later services to keep persistence access consistent. */
export const repositoryFor = <T extends ObjectLiteral>(manager: EntityManager, target: EntityTarget<T>): Repository<T> => manager.getRepository(target);
export const createAndSave = async <T extends ObjectLiteral>(manager: EntityManager, target: EntityTarget<T>, data: DeepPartial<T>): Promise<T> => manager.getRepository(target).save(manager.getRepository(target).create(data));
