import type { EntityManager } from 'typeorm';
import { BusinessIdSequence } from '../entities/work-finance.entities';
import { type BusinessIdScope, formatBusinessId } from '../utils/business-id';
export { formatBusinessId } from '../utils/business-id';

export async function ensureBusinessIdSequenceAtLeast(manager: EntityManager, scope: BusinessIdScope, minimum: bigint | number | string): Promise<void> {
  const repository = manager.getRepository(BusinessIdSequence);
  let sequence = await repository.createQueryBuilder('sequence').setLock('pessimistic_write').where('sequence.scope = :scope', { scope }).getOne();
  const minimumValue = BigInt(minimum);
  if (!sequence) {
    await repository.save(repository.create({ scope, lastValue: minimumValue.toString() }));
    return;
  }
  if (BigInt(sequence.lastValue) < minimumValue) {
    sequence.lastValue = minimumValue.toString();
    await repository.save(sequence);
  }
}

export async function nextBusinessId(manager: EntityManager, scope: BusinessIdScope): Promise<string> { const repository = manager.getRepository(BusinessIdSequence); let sequence = await repository.createQueryBuilder('sequence').setLock('pessimistic_write').where('sequence.scope = :scope', { scope }).getOne(); if (!sequence) { sequence = repository.create({ scope, lastValue: '0' }); await repository.save(sequence); } sequence.lastValue = (BigInt(sequence.lastValue) + 1n).toString(); await repository.save(sequence); return formatBusinessId(scope, sequence.lastValue); }
