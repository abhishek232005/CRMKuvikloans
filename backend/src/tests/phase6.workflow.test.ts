import { describe, expect, it } from 'vitest';
import { ApplicationStatus } from '../constants/enums';
import { applicationStatusTransitions } from '../utils/application-workflow';

describe('Phase 6 application workflow', () => {
  it('allows the normal login and processing path', () => {
    expect(applicationStatusTransitions[ApplicationStatus.DRAFT]).toContain(ApplicationStatus.READY_TO_LOGIN);
    expect(applicationStatusTransitions[ApplicationStatus.READY_TO_LOGIN]).toContain(ApplicationStatus.LOGIN_PENDING);
    expect(applicationStatusTransitions[ApplicationStatus.LOGIN_PENDING]).toContain(ApplicationStatus.LOGGED_IN);
    expect(applicationStatusTransitions[ApplicationStatus.LOGGED_IN]).toContain(ApplicationStatus.UNDER_PROCESS);
    expect(applicationStatusTransitions[ApplicationStatus.UNDER_PROCESS]).toContain(ApplicationStatus.SANCTIONED);
  });

  it('never enters a Phase 8 disbursement state', () => {
    for (const transitions of Object.values(applicationStatusTransitions)) {
      expect(transitions).not.toContain(ApplicationStatus.DISBURSEMENT_PENDING);
      expect(transitions).not.toContain(ApplicationStatus.PART_DISBURSED);
      expect(transitions).not.toContain(ApplicationStatus.FULLY_DISBURSED);
    }
  });

  it('keeps terminal outcomes immutable', () => {
    expect(applicationStatusTransitions[ApplicationStatus.REJECTED]).toEqual([]);
    expect(applicationStatusTransitions[ApplicationStatus.WITHDRAWN]).toEqual([]);
    expect(applicationStatusTransitions[ApplicationStatus.CLOSED]).toEqual([]);
  });
});
