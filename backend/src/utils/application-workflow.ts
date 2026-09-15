import { ApplicationStatus } from '../constants/enums';

export const applicationStatusTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.DRAFT]: [ApplicationStatus.READY_TO_LOGIN, ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED],
  [ApplicationStatus.READY_TO_LOGIN]: [ApplicationStatus.LOGIN_PENDING, ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED],
  [ApplicationStatus.LOGIN_PENDING]: [ApplicationStatus.LOGGED_IN, ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED],
  [ApplicationStatus.LOGGED_IN]: [ApplicationStatus.UNDER_PROCESS, ApplicationStatus.QUERY, ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED],
  [ApplicationStatus.UNDER_PROCESS]: [ApplicationStatus.QUERY, ApplicationStatus.SANCTIONED, ApplicationStatus.DOCUMENTATION, ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED],
  [ApplicationStatus.QUERY]: [ApplicationStatus.UNDER_PROCESS, ApplicationStatus.DOCUMENTATION, ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED],
  [ApplicationStatus.SANCTIONED]: [ApplicationStatus.DOCUMENTATION, ApplicationStatus.WITHDRAWN, ApplicationStatus.CLOSED],
  [ApplicationStatus.DOCUMENTATION]: [ApplicationStatus.SANCTIONED, ApplicationStatus.WITHDRAWN, ApplicationStatus.CLOSED],
  [ApplicationStatus.DISBURSEMENT_PENDING]: [], [ApplicationStatus.PART_DISBURSED]: [], [ApplicationStatus.FULLY_DISBURSED]: [],
  [ApplicationStatus.REJECTED]: [], [ApplicationStatus.WITHDRAWN]: [], [ApplicationStatus.CLOSED]: [],
};
