type FinancialProfileInput = {
  annualIncome?: number;
  monthlyIncome?: number;
  existingEmi?: number;
  existingLoans?: number;
  creditCardOutstanding?: number;
  businessVintageMonths?: number;
};

const decimal = (value?: number) => value === undefined ? undefined : value.toFixed(2);

/** Normalizes customer financial values before persistence. */
export function normalizeFinancialProfile(input: FinancialProfileInput) {
  return {
    annualIncome: decimal(input.annualIncome),
    monthlyIncome: decimal(input.monthlyIncome),
    existingEmi: decimal(input.existingEmi),
    existingLoans: decimal(input.existingLoans),
    creditCardOutstanding: decimal(input.creditCardOutstanding),
    businessVintageMonths: input.businessVintageMonths,
  };
}
