import { AppDataSource } from '../config/data-source';
import { Customer, Lender, LenderProduct, LoanProduct, ProductPolicy } from '../entities/crm.entities';
import { EligibilityResult, EligibilityRule, ProductField, ProductWorkflowStage } from '../entities/product-management.entities';
import { RecordStatus } from '../constants/enums';
import { AppError } from '../middleware/error-handler';
import { DocumentChecklist } from '../entities/lifecycle.entities';

export async function productDetail(id: string) {
  const product = await AppDataSource.getRepository(LoanProduct).findOneBy({ id });
  if (!product) throw new AppError(404, 'Product not found');
  const [fields, workflow, mappings, rules, checklist] = await Promise.all([
    AppDataSource.getRepository(ProductField).find({ where: { productId: id }, order: { displayOrder: 'ASC' } }),
    AppDataSource.getRepository(ProductWorkflowStage).find({ where: { productId: id }, order: { stageOrder: 'ASC' } }),
    AppDataSource.getRepository(LenderProduct).find({ where: { productId: id }, relations: ['lender'] }),
    AppDataSource.getRepository(EligibilityRule).find({ where: { productId: id }, order: { priority: 'ASC' } }),
    AppDataSource.getRepository(DocumentChecklist).find({ where: { productId: id }, order: { documentType: 'ASC' } }),
  ]);
  const policies = mappings.length ? await AppDataSource.getRepository(ProductPolicy).createQueryBuilder('policy').where('policy.lender_product_id IN (:...ids)', { ids: mappings.map(item => item.id) }).getMany() : [];
  return { product, fields, workflow, checklist, lenders: mappings.map(mapping => ({ ...mapping.lender, mappingId: mapping.id, policy: policies.find(policy => policy.lenderProductId === mapping.id) })), rules };
}

const fieldValues: Record<string, string> = { MIN_CIBIL: 'creditScore', MIN_INCOME: 'monthlyIncome', MIN_BUSINESS_VINTAGE: 'businessVintageMonths', MIN_TURNOVER: 'turnover', MAX_LTV: 'ltv', AGE_RANGE: 'age', EMPLOYMENT_TYPE: 'employmentType', PROPERTY_TYPE: 'propertyType', GEOGRAPHY: 'city' };
function compare(value: unknown, operator: string, expected: unknown) { const actualNumber = Number(value); const expectedNumber = Number(expected); if (operator === 'GTE') return actualNumber >= expectedNumber; if (operator === 'LTE') return actualNumber <= expectedNumber; if (operator === 'EQ') return String(value).toLowerCase() === String(expected).toLowerCase(); if (operator === 'IN') return Array.isArray(expected) && expected.map(String).includes(String(value)); return false; }

export async function evaluateEligibility(input: { customerId: string; productId: string; leadId?: string; loanAmount: number; values?: Record<string, unknown> }) {
  const customer = await AppDataSource.getRepository(Customer).findOneBy({ id: input.customerId });
  if (!customer) throw new AppError(404, 'Customer not found');
  const mappings = await AppDataSource.getRepository(LenderProduct).find({ where: { productId: input.productId, status: RecordStatus.ACTIVE }, relations: ['lender'] });
  const rules = await AppDataSource.getRepository(EligibilityRule).find({ where: { productId: input.productId, status: RecordStatus.ACTIVE } });
  const values: Record<string, unknown> = { ...input.values, creditScore: customer.creditScore, monthlyIncome: Number(customer.monthlyIncome ?? 0), businessVintageMonths: customer.businessVintageMonths, employmentType: customer.employmentType, city: customer.city, loanAmount: input.loanAmount };
  const recommendations = mappings.filter(mapping => mapping.lender.status === RecordStatus.ACTIVE).map(mapping => {
    const applicable = rules.filter(rule => !rule.lenderId || rule.lenderId === mapping.lenderId);
    const failedRules = applicable.filter(rule => !compare(values[fieldValues[rule.ruleType] ?? rule.ruleType], rule.operator, rule.ruleValue)).map(rule => rule.ruleType);
    const passed = applicable.length - failedRules.length; const score = applicable.length ? passed / applicable.length : 1;
    const max = Number(mapping.lender.maxLoanAmount ?? input.loanAmount); const eligibleLoanAmount = Math.min(input.loanAmount, max);
    return { lenderId: mapping.lender.id, lender: mapping.lender.name, score, matchLevel: score >= .8 ? 'HIGH_MATCH' : score >= .5 ? 'MEDIUM_MATCH' : 'ALTERNATIVE', reasons: applicable.filter(rule => !failedRules.includes(rule.ruleType)).map(rule => `${rule.ruleType} satisfied`), failedRules, eligibleLoanAmount, recommendedTenure: undefined };
  }).sort((a, b) => b.score - a.score);
  const record = await AppDataSource.getRepository(EligibilityResult).save({ customerId: input.customerId, productId: input.productId, leadId: input.leadId, input: { loanAmount: input.loanAmount, values: input.values ?? {} }, recommendations });
  return { resultId: record.id, customerId: input.customerId, productId: input.productId, recommendations };
}
