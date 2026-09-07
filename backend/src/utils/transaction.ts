import type { DataSource, EntityManager } from 'typeorm';
export const withTransaction = <T>(dataSource: DataSource, work: (manager: EntityManager) => Promise<T>) => dataSource.transaction(work);
