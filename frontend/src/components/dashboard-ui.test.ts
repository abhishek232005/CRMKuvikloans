import { describe, expect, it } from 'vitest';
import { dashboardRequestEnabled, permittedDashboardQuickActions } from './dashboard-ui';

describe('dashboard UI state', () => {
  it('waits for both custom dates before requesting analytics', () => {
    expect(dashboardRequestEnabled('custom', '', '')).toBe(false);
    expect(dashboardRequestEnabled('custom', '2026-09-01', '')).toBe(false);
    expect(dashboardRequestEnabled('custom', '2026-09-01', '2026-09-15')).toBe(true);
  });

  it('allows preset analytics requests immediately', () => {
    expect(dashboardRequestEnabled('today', '', '')).toBe(true);
    expect(dashboardRequestEnabled('last_30_days', '', '')).toBe(true);
  });

  it('shows only quick actions allowed by the current role', () => {
    const actions = permittedDashboardQuickActions(permission => permission === 'applications.create' || permission === 'documents.upload');
    expect(actions.map(action => action.label)).toEqual(['New Application', 'Upload Document']);
  });
});
