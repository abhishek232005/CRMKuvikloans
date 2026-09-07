export enum RecordStatus { ACTIVE = 'active', INACTIVE = 'inactive' }
export enum CustomerLifecycleStatus { NEW = 'NEW', ACTIVE = 'ACTIVE', LOAN_PROCESSING = 'LOAN_PROCESSING', LOAN_APPROVED = 'LOAN_APPROVED', LOAN_DISBURSED = 'LOAN_DISBURSED', LOAN_COMPLETED = 'LOAN_COMPLETED', INACTIVE = 'INACTIVE' }
export enum LeadStatus { NEW = 'new', ASSIGNED = 'assigned', CONTACTED = 'contacted', INTERESTED = 'interested', PROFILED = 'profiled', ELIGIBILITY_CHECKED = 'eligibility_checked', DOCUMENTS_PENDING = 'documents_pending', DOCUMENTS_RECEIVED = 'documents_received', READY_FOR_LOGIN = 'ready_for_login', LOGIN_INITIATED = 'login_initiated', LOST = 'lost', ON_HOLD = 'on_hold' }
export enum ApplicationStatus { DRAFT = 'draft', READY_TO_LOGIN = 'ready_to_login', LOGIN_PENDING = 'login_pending', LOGGED_IN = 'logged_in', UNDER_PROCESS = 'under_process', QUERY = 'query', SANCTIONED = 'sanctioned', DOCUMENTATION = 'documentation', DISBURSEMENT_PENDING = 'disbursement_pending', PART_DISBURSED = 'part_disbursed', FULLY_DISBURSED = 'fully_disbursed', REJECTED = 'rejected', WITHDRAWN = 'withdrawn', CLOSED = 'closed' }
export enum Priority { LOW = 'low', MEDIUM = 'medium', HIGH = 'high', URGENT = 'urgent' }
export enum TaskStatus { PENDING = 'pending', IN_PROGRESS = 'in_progress', COMPLETED = 'completed', CANCELLED = 'cancelled', OVERDUE = 'overdue' }
export enum DocumentStatus { NOT_REQUIRED = 'not_required', PENDING = 'pending', UPLOADED = 'uploaded', VERIFIED = 'verified', REJECTED = 'rejected', REUPLOAD_REQUIRED = 'reupload_required', APPROVED = 'approved' }
export enum QueryStatus { OPEN = 'open', ASSIGNED = 'assigned', IN_PROGRESS = 'in_progress', RESOLVED = 'resolved', REJECTED = 'rejected', CLOSED = 'closed' }
export enum DisbursementStatus { PENDING = 'pending', PART_DISBURSED = 'part_disbursed', FULLY_DISBURSED = 'fully_disbursed', FAILED = 'failed', CANCELLED = 'cancelled' }
export enum PaymentStatus { PENDING = 'pending', PROCESSING = 'processing', PAID = 'paid', FAILED = 'failed', CANCELLED = 'cancelled' }
export enum ProductCategory { RETAIL = 'retail', BUSINESS = 'business', OTHER = 'other' }
export enum AuditAction { CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LOGIN = 'login', LOGOUT = 'logout', ASSIGN = 'assign', STATUS_CHANGE = 'status_change', VERIFY = 'verify', APPROVE = 'approve', PAYOUT = 'payout' }
