import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerFinancialProfile1725907200000 implements MigrationInterface {
  name = 'CustomerFinancialProfile1725907200000';
  async up(q: QueryRunner): Promise<void> {
    await q.query("ALTER TABLE customers ADD COLUMN existing_loans DECIMAL(15,2) NULL, ADD COLUMN credit_card_outstanding DECIMAL(15,2) NULL, ADD COLUMN banking_relationship VARCHAR(255) NULL, ADD COLUMN itr_details VARCHAR(255) NULL, ADD COLUMN gst_details VARCHAR(255) NULL, ADD COLUMN business_vintage_months INT NULL");
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE customers DROP COLUMN existing_loans, DROP COLUMN credit_card_outstanding, DROP COLUMN banking_relationship, DROP COLUMN itr_details, DROP COLUMN gst_details, DROP COLUMN business_vintage_months');
  }
}
