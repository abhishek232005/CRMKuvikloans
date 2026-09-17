export type DashboardPreset = 'today' | 'last_7_days' | 'last_30_days' | 'this_month' | 'custom';

export type DashboardQuickAction = {
  label: string;
  to: string;
  permission: string;
};

export const dashboardQuickActions: DashboardQuickAction[] = [
  { label: 'Add Customer', to: '/customers/new', permission: 'customers.create' },
  { label: 'Create Lead', to: '/leads/new', permission: 'leads.create' },
  { label: 'Check Eligibility', to: '/eligibility', permission: 'leads.view' },
  { label: 'New Application', to: '/applications/new', permission: 'applications.create' },
  { label: 'Upload Document', to: '/documents', permission: 'documents.upload' },
];

export function dashboardRequestEnabled(preset: DashboardPreset, from: string, to: string) {
  return preset !== 'custom' || Boolean(from && to);
}

export function permittedDashboardQuickActions(can: (permission: string) => boolean) {
  return dashboardQuickActions.filter(action => can(action.permission));
}
