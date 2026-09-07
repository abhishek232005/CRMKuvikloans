import type { MigrationInterface, QueryRunner } from 'typeorm';
const tables = ['payouts', 'commissions', 'commission_rules', 'sub_dsas', 'dsa_partners', 'audit_logs', 'notifications', 'communications', 'follow_ups', 'tasks', 'disbursements', 'agreements', 'sanctions', 'loan_queries', 'credit_assessments', 'application_documents', 'document_checklists', 'documents', 'eligibility_checks', 'loan_applications', 'leads', 'product_policies', 'lender_products', 'lenders', 'loan_products', 'campaigns', 'lead_sources', 'customers', 'user_roles', 'role_permissions', 'users', 'teams', 'branches', 'permissions', 'roles', 'business_id_sequences'];
/** Initial baseline migration. Schema is built solely during this migration; runtime synchronize remains disabled. */
export class InitialSchema1725648000000 implements MigrationInterface {
  name = 'InitialSchema1725648000000';
  public async up(queryRunner: QueryRunner): Promise<void> { await queryRunner.connection.driver.createSchemaBuilder().build(); }
  public async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0'); for (const table of tables) await queryRunner.dropTable(table, true); await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1'); }
}
