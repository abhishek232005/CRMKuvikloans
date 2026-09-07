import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableForeignKey, TableIndex } from 'typeorm';
export class AuthSessions1725734400000 implements MigrationInterface {
  name = 'AuthSessions1725734400000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: 'auth_sessions', columns: [{ name: 'id', type: 'char', length: '36', isPrimary: true }, { name: 'user_id', type: 'char', length: '36' }, { name: 'token_hash', type: 'varchar', length: '64', isUnique: true }, { name: 'expires_at', type: 'datetime' }, { name: 'revoked_at', type: 'datetime', isNullable: true }, { name: 'ip_address', type: 'varchar', length: '64', isNullable: true }, { name: 'user_agent', type: 'text', isNullable: true }, { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' }, { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }] }));
    await queryRunner.createTable(new Table({ name: 'password_reset_tokens', columns: [{ name: 'id', type: 'char', length: '36', isPrimary: true }, { name: 'user_id', type: 'char', length: '36' }, { name: 'token_hash', type: 'varchar', length: '64', isUnique: true }, { name: 'expires_at', type: 'datetime' }, { name: 'used_at', type: 'datetime', isNullable: true }, { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' }, { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }] }));
    for (const table of ['auth_sessions', 'password_reset_tokens']) await queryRunner.createForeignKey(table, new TableForeignKey({ columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createIndex('auth_sessions', new TableIndex({ name: 'IDX_AUTH_SESSION_USER', columnNames: ['user_id'] }));
    await queryRunner.createIndex('password_reset_tokens', new TableIndex({ name: 'IDX_PASSWORD_RESET_USER', columnNames: ['user_id'] }));
  }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.dropTable('password_reset_tokens'); await queryRunner.dropTable('auth_sessions'); }
}
