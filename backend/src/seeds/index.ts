import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/data-source';
import { env } from '../config/env';
import { Permission, Role, RolePermission, User, UserRole } from '../entities/access.entities';
import { Lender, LenderProduct, LeadSource, LoanProduct, ProductPolicy } from '../entities/crm.entities';
import { CommissionRule } from '../entities/work-finance.entities';
import { EligibilityRule, ProductField, ProductWorkflowStage } from '../entities/product-management.entities';
import { ProductCategory } from '../constants/enums';
import { DocumentChecklist } from '../entities/lifecycle.entities';

const roles = ['super_admin', 'business_head', 'sales_manager', 'sales_executive', 'credit_operations', 'legal_technical', 'accounts', 'channel_partner'];
const permissions = ['users.view', 'users.manage', 'roles.view', 'roles.manage', 'customers.view', 'customers.create', 'customers.update', 'customers.delete', 'leads.view', 'leads.create', 'leads.update', 'leads.assign', 'applications.view', 'applications.create', 'applications.update', 'products.manage', 'lenders.manage', 'documents.view', 'documents.upload', 'documents.verify', 'documents.manage', 'sanctions.approve', 'disbursements.manage', 'payouts.manage', 'reports.view', 'audit.view'];
const products = [
  ['PERSONAL_LOAN', 'Personal Loan', ProductCategory.RETAIL], ['HOME_LOAN', 'Home Loan', ProductCategory.RETAIL], ['LAP', 'Loan Against Property', ProductCategory.RETAIL], ['BUSINESS_LOAN', 'Business Loan', ProductCategory.BUSINESS],
  ['NEW_VEHICLE_LOAN', 'New Vehicle Loan', ProductCategory.RETAIL], ['USED_VEHICLE_LOAN', 'Used Vehicle Loan', ProductCategory.RETAIL], ['EDUCATION_LOAN', 'Education Loan', ProductCategory.RETAIL], ['GOLD_LOAN', 'Gold Loan', ProductCategory.RETAIL], ['WORKING_CAPITAL', 'Working Capital', ProductCategory.BUSINESS], ['TERM_LOAN', 'Term Loan', ProductCategory.BUSINESS], ['EQUIPMENT_FINANCE', 'Equipment Finance', ProductCategory.BUSINESS], ['MUDRA_LOAN', 'Mudra Loan', ProductCategory.BUSINESS], ['MSME_LOAN', 'MSME Loan', ProductCategory.BUSINESS], ['CREDIT_CARD', 'Credit Card', ProductCategory.RETAIL], ['INSURANCE_FINANCE', 'Insurance Finance', ProductCategory.OTHER], ['OTHER_LOAN', 'Other Loan', ProductCategory.OTHER],
] as const;

async function seed() {
  await AppDataSource.initialize();
  await AppDataSource.transaction(async manager => {
    for (const code of roles) await manager.getRepository(Role).upsert({ code, name: code.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ') }, ['code']);
    for (const code of permissions) await manager.getRepository(Permission).upsert({ code, module: code.split('.')[0], name: code }, ['code']);
    const adminRole = await manager.getRepository(Role).findOneByOrFail({ code: 'super_admin' });
    for (const permission of await manager.getRepository(Permission).find()) await manager.createQueryBuilder().insert().into(RolePermission).values({ roleId: adminRole.id, permissionId: permission.id }).orIgnore().execute();
    await manager.getRepository(User).upsert({ email: env.SEED_ADMIN_EMAIL, passwordHash: await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12), firstName: 'Kuvik', lastName: 'Administrator' }, ['email']);
    const admin = await manager.getRepository(User).findOneByOrFail({ email: env.SEED_ADMIN_EMAIL });
    await manager.createQueryBuilder().insert().into(UserRole).values({ userId: admin.id, roleId: adminRole.id }).orIgnore().execute();
    for (const [code, name, category] of products) await manager.getRepository(LoanProduct).upsert({ code, name, category }, ['code']);
    for (const product of await manager.getRepository(LoanProduct).find()) {
      await manager.getRepository(ProductWorkflowStage).upsert([{ productId: product.id, code: 'ENQUIRY', name: 'Enquiry', stageOrder: 1 }, { productId: product.id, code: 'ELIGIBILITY', name: 'Eligibility', stageOrder: 2 }, { productId: product.id, code: 'DOCUMENTS', name: 'Documents', stageOrder: 3 }], ['productId', 'code']);
      await manager.getRepository(ProductField).upsert([{ productId: product.id, fieldKey: 'employmentType', label: 'Employment type', fieldType: 'select', section: 'Applicant', options: ['salaried', 'self_employed'], displayOrder: 1 }, { productId: product.id, fieldKey: 'tenureMonths', label: 'Requested tenure (months)', fieldType: 'number', section: 'Loan', displayOrder: 2 }], ['productId', 'fieldKey']);
      const ruleRepository = manager.getRepository(EligibilityRule);
      const existingRules = await ruleRepository.find({ where: { productId: product.id, ruleType: 'MIN_CIBIL' }, order: { createdAt: 'ASC' } });
      if (existingRules.length) {
        Object.assign(existingRules[0], { operator: 'GTE', ruleValue: 650, valueType: 'number', priority: 10 });
        await ruleRepository.save(existingRules[0]);
        if (existingRules.length > 1) await ruleRepository.softRemove(existingRules.slice(1));
      } else await ruleRepository.save({ productId: product.id, ruleType: 'MIN_CIBIL', operator: 'GTE', ruleValue: 650, valueType: 'number', priority: 10 });
      await manager.getRepository(DocumentChecklist).upsert([{ productId: product.id, documentType: 'PAN', category: 'KYC', isRequired: true }, { productId: product.id, documentType: 'ADDRESS_PROOF', category: 'KYC', isRequired: true }], ['productId', 'documentType']);
    }
    for (const name of ['Website', 'WhatsApp', 'Facebook', 'Google', 'Telecalling', 'DSA', 'Referral', 'Branch', 'Existing Customer']) await manager.getRepository(LeadSource).upsert({ name }, ['name']);
    await manager.getRepository(Lender).upsert({ businessId: 'KUV-LENDER-000001', code: 'DEMO_BANK', name: 'Demo Bank' }, ['code']);
    const lender = await manager.getRepository(Lender).findOneByOrFail({ code: 'DEMO_BANK' });
    const personalLoan = await manager.getRepository(LoanProduct).findOneByOrFail({ code: 'PERSONAL_LOAN' });
    await manager.createQueryBuilder().insert().into(LenderProduct).values({ lenderId: lender.id, productId: personalLoan.id }).orIgnore().execute();
    const mapping = await manager.getRepository(LenderProduct).findOneByOrFail({ lenderId: lender.id, productId: personalLoan.id });
    await manager.getRepository(ProductPolicy).upsert({ lenderProductId: mapping.id, name: 'Default Personal Loan Policy', rules: { minCreditScore: 650, minMonthlyIncome: 25000 } }, ['lenderProductId', 'name']);
    await manager.getRepository(CommissionRule).upsert({ name: 'Default DSA Commission', payoutPercent: '1.0000' }, ['name']);
  });
  await AppDataSource.destroy();
  console.info('Development seed completed.');
}
seed().catch((error: unknown) => { console.error(error); process.exit(1); });
