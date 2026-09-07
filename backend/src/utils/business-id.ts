const prefixes: Record<string, string> = { customer: 'KUV-CUST', lead: 'KUV-LEAD', application: 'KUV-APP', lender: 'KUV-LENDER', partner: 'KUV-PARTNER', sub_dsa: 'KUV-SUBDSA', document: 'KUV-DOC', query: 'KUV-QUERY', disbursement: 'KUV-DISB', task: 'KUV-TASK', follow_up: 'KUV-FOLLOW', communication: 'KUV-COMM', payout: 'KUV-PAYOUT' };
export type BusinessIdScope = keyof typeof prefixes;
export const formatBusinessId = (scope: BusinessIdScope, sequence: bigint | number | string) => `${prefixes[scope]}-${sequence.toString().padStart(6, '0')}`;
