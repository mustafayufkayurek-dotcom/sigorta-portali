export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  OFFICE_STAFF = 'office_staff',
  FIELD_STAFF = 'field_staff',
  ADJUSTER = 'adjuster',
  FINANCE = 'finance',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum ClaimStatus {
  NEW = 'new',
  PRE_REVIEW = 'pre_review',
  ADJUSTER_ASSIGNED = 'adjuster_assigned',
  SITE_VISIT_PLANNED = 'site_visit_planned',
  SITE_VISIT_DONE = 'site_visit_done',
  BUDGET_PREPARING = 'budget_preparing',
  BUDGET_SUBMITTED = 'budget_submitted',
  BUDGET_REVISION_REQUESTED = 'budget_revision_requested',
  BUDGET_APPROVED = 'budget_approved',
  REPAIR_PLANNING = 'repair_planning',
  REPAIR_IN_PROGRESS = 'repair_in_progress',
  REPAIR_COMPLETED = 'repair_completed',
  INVOICE_PENDING = 'invoice_pending',
  INVOICE_SUBMITTED = 'invoice_submitted',
  PAYMENT_PENDING = 'payment_pending',
  PARTIALLY_COLLECTED = 'partially_collected',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export enum ClaimPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum TaskType {
  SITE_VISIT = 'site_visit',
  CALL_CUSTOMER = 'call_customer',
  DOCUMENT_COLLECTION = 'document_collection',
  BUDGET_PREPARATION = 'budget_preparation',
  REPAIR_COORDINATION = 'repair_coordination',
  INVOICE_PROCESSING = 'invoice_processing',
  OTHER = 'other',
}

export enum NoteType {
  GENERAL = 'general',
  CALL_LOG = 'call_log',
  VISIT_REPORT = 'visit_report',
  INTERNAL = 'internal',
}

export enum DocumentType {
  PHOTO = 'photo',
  INVOICE = 'invoice',
  REPORT = 'report',
  CONTRACT = 'contract',
  CORRESPONDENCE = 'correspondence',
  OTHER = 'other',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  READ = 'read',
  FAILED = 'failed',
}

export enum CustomerType {
  INDIVIDUAL = 'individual',
  CORPORATE = 'corporate',
}

export enum PropertyType {
  RESIDENCE = 'residence',
  WORKPLACE = 'workplace',
  FACTORY = 'factory',
  WAREHOUSE = 'warehouse',
  OTHER = 'other',
}

export enum PermissionCode {
  // User management
  USER_VIEW = 'user.view',
  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',

  // Role management
  ROLE_VIEW = 'role.view',
  ROLE_CREATE = 'role.create',
  ROLE_UPDATE = 'role.update',
  ROLE_DELETE = 'role.delete',

  // Insurance company
  INSURANCE_COMPANY_VIEW = 'insurance_company.view',
  INSURANCE_COMPANY_CREATE = 'insurance_company.create',
  INSURANCE_COMPANY_UPDATE = 'insurance_company.update',
  INSURANCE_COMPANY_DELETE = 'insurance_company.delete',

  // Claim file
  CLAIM_FILE_VIEW = 'claim_file.view',
  CLAIM_FILE_CREATE = 'claim_file.create',
  CLAIM_FILE_UPDATE = 'claim_file.update',
  CLAIM_FILE_DELETE = 'claim_file.delete',
  CLAIM_FILE_ASSIGN = 'claim_file.assign',
  CLAIM_FILE_STATUS_CHANGE = 'claim_file.status_change',

  // Customer
  CUSTOMER_VIEW = 'customer.view',
  CUSTOMER_CREATE = 'customer.create',
  CUSTOMER_UPDATE = 'customer.update',
  CUSTOMER_DELETE = 'customer.delete',

  // Task
  TASK_VIEW = 'task.view',
  TASK_CREATE = 'task.create',
  TASK_UPDATE = 'task.update',
  TASK_DELETE = 'task.delete',
  TASK_COMPLETE = 'task.complete',

  // Document
  DOCUMENT_VIEW = 'document.view',
  DOCUMENT_UPLOAD = 'document.upload',
  DOCUMENT_DELETE = 'document.delete',

  // Note
  NOTE_VIEW = 'note.view',
  NOTE_CREATE = 'note.create',
  NOTE_UPDATE = 'note.update',
  NOTE_DELETE = 'note.delete',

  // Dashboard
  DASHBOARD_VIEW = 'dashboard.view',

  // Adjuster
  ADJUSTER_VIEW = 'adjuster.view',
  ADJUSTER_CREATE = 'adjuster.create',
  ADJUSTER_UPDATE = 'adjuster.update',
  ADJUSTER_DELETE = 'adjuster.delete',
  ADJUSTER_ASSIGN = 'adjuster.assign',
  ADJUSTER_REPORT_CREATE = 'adjuster.report.create',
  ADJUSTER_REPORT_REVIEW = 'adjuster.report.review',

  // Budget
  BUDGET_VIEW = 'budget.view',
  BUDGET_CREATE = 'budget.create',
  BUDGET_UPDATE = 'budget.update',
  BUDGET_SUBMIT = 'budget.submit',
  BUDGET_REVIEW = 'budget.review',

  // Vendor
  VENDOR_VIEW = 'vendor.view',
  VENDOR_CREATE = 'vendor.create',
  VENDOR_UPDATE = 'vendor.update',
  VENDOR_DELETE = 'vendor.delete',
}

export enum AdjusterAssignmentStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
}

export enum AdjusterReportStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum AppointmentType {
  EXPERT_VISIT = 'expert_visit',
  INSPECTION = 'inspection',
  CUSTOMER_MEETING = 'customer_meeting',
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum BudgetVersionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  REVISION = 'revision',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum BudgetItemCategory {
  LABOR = 'labor',
  MATERIAL = 'material',
  SUBCONTRACTOR = 'subcontractor',
  LOGISTICS = 'logistics',
  EQUIPMENT = 'equipment',
}

export enum RepairReportStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SENT_FOR_EXTERNAL_APPROVAL = 'sent_for_external_approval',
  EXTERNALLY_APPROVED = 'externally_approved',
  EXTERNALLY_REJECTED = 'externally_rejected',
}

export enum ExternalApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum ExternalApprovalChannel {
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  IN_APP = 'in_app',
}

export enum ExternalApproverType {
  EXPERT = 'expert',
  INSURANCE_COMPANY = 'insurance_company',
}
