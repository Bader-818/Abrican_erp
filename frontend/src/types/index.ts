export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AuthUser {
  id: string
  email: string
  name: string
  roleId: string
  roleName: string
  permissions: string[]
  mfaEnabled: boolean
  mustChangePassword: boolean
}

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface UserSummary {
  id: string
  name: string
  email: string
  status: UserStatus
  mfaEnabled: boolean
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
  role: {
    id: string
    name: string
  }
}

export interface SessionInfo {
  id: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string
  current: boolean
}

export interface Role {
  id: string
  name: string
  description: string | null
  userCount: number
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export interface Permission {
  id: string
  key: string
  description: string | null
}

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'STATUS_CHANGE'
  | 'OVERRIDE'
  | 'APPROVE'
  | 'REJECT'
  | 'TOKEN_REUSE_DETECTED'
  | 'PASSWORD_CHANGED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'ACCOUNT_LOCKED'
  | 'SESSION_REVOKED'

export interface AuditLog {
  id: string
  userId: string | null
  action: AuditAction
  entityType: string
  entityId: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  ipAddress: string | null
  comment: string | null
  createdAt: string
  user: {
    id: string
    name: string
    email: string
  } | null
}

export type NotificationType =
  | 'JOB_ASSIGNED'
  | 'RESOURCE_CONFLICT'
  | 'DOCUMENT_EXPIRING'
  | 'DOCUMENT_EXPIRED'
  | 'CONTRACT_NEAR_EXPIRY'
  | 'PO_NEAR_EXPIRY'
  | 'JOB_STATUS_CHANGED'
  | 'GENERAL'
  // Finance alerts (S13)
  | 'INVOICE_OVERDUE'
  | 'INVOICE_EXCEEDS_PO'
  | 'PO_NEARLY_CONSUMED'
  | 'COST_OVER_BUDGET'
  | 'MARGIN_BELOW_TARGET'
  | 'JOB_NOT_INVOICED'
  | 'PAYMENT_DELAYED'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  relatedEntityType: string | null
  relatedEntityId: string | null
  createdAt: string
}

export type ClientType = 'GOVERNMENT' | 'SEMI_GOVERNMENT' | 'PRIVATE' | 'CONTRACTOR'
export type ClientStatus = 'ACTIVE' | 'INACTIVE'

export interface ClientContact {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
}

export interface ClientSummary {
  id: string
  name: string
  clientType: ClientType
  vatNumber: string | null
  crNumber: string | null
  paymentTermsDays: number | null
  status: ClientStatus
  createdAt: string
  updatedAt: string
  _count: {
    contacts: number
    contracts: number
    purchaseOrders: number
    jobs: number
  }
}

export interface ClientDetail extends ClientSummary {
  billingAddress: string | null
  notes: string | null
  contacts: ClientContact[]
}

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'CLOSED' | 'TERMINATED'

export interface RateCard {
  id: string
  serviceLine: string
  itemCode: string | null
  description: string
  unit: string
  unitPrice: string
  currency: string
  vatApplicable: boolean
  effectiveDate: string
}

export interface ContractSummary {
  id: string
  contractNumber: string
  title: string
  startDate: string
  endDate: string
  contractValue: string
  consumedValue: string
  remainingValue: string
  paymentTermsDays: number | null
  status: ContractStatus
  createdAt: string
  updatedAt: string
  client: { id: string; name: string }
  _count: { rateCards: number; purchaseOrders: number; jobs: number }
}

export interface ContractDetail extends ContractSummary {
  scope: string | null
  rateCards: RateCard[]
}

export type PurchaseOrderStatus = 'DRAFT' | 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED'

export interface PurchaseOrder {
  id: string
  poNumber: string
  poValue: string
  consumedAmount: string
  remainingAmount: string
  currency: string
  issueDate: string
  expiryDate: string
  status: PurchaseOrderStatus
  createdAt: string
  updatedAt: string
  client: { id: string; name: string }
  contract: { id: string; contractNumber: string; title: string } | null
  _count: { jobs: number }
}

export type JobStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'COSTING_REVIEW'
  | 'READY_FOR_INVOICE'
  | 'INVOICED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'CLOSED'
  | 'CANCELLED'

export interface JobSummary {
  id: string
  jobCode: string
  title: string
  serviceType: string
  location: string
  region: string | null
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate: string | null
  actualEndDate: string | null
  jobValue: string | null
  status: JobStatus
  createdAt: string
  updatedAt: string
  client: { id: string; name: string }
  contract: { id: string; contractNumber: string } | null
  purchaseOrder: { id: string; poNumber: string } | null
  _count: { assignments: number }
}

export interface JobStatusHistoryEntry {
  id: string
  fromStatus: JobStatus | null
  toStatus: JobStatus
  reason: string | null
  createdAt: string
  changedBy: { id: string; name: string }
}

export interface JobDetail extends Omit<JobSummary, 'contract'> {
  costBudget: string | null
  description: string | null
  contract: { id: string; contractNumber: string; title: string } | null
  statusHistory: JobStatusHistoryEntry[]
}

// Job costing & profitability (S12). All money figures are computed aggregates
// returned as numbers (backend round2), not raw Decimal strings.
export interface JobCostBreakdown {
  jobId: string
  status: JobStatus
  labourCost: number // audit:decimal-ok — computed aggregate (round2 → number)
  vehicleCost: number // audit:decimal-ok — computed aggregate (round2 → number)
  equipmentCost: number // audit:decimal-ok — computed aggregate (round2 → number)
  expensesByCategory: Record<string, number> // audit:decimal-ok — computed aggregate (round2 → number)
  expensesTotal: number // audit:decimal-ok — computed aggregate (round2 → number)
  actualCost: number // audit:decimal-ok — computed aggregate (round2 → number)
  revenue: number // audit:decimal-ok — computed aggregate (round2 → number)
  revenueBasis: 'INVOICED' | 'JOB_VALUE' | 'NONE'
  grossProfit: number // audit:decimal-ok — computed aggregate (round2 → number)
  grossMarginPct: number | null // audit:decimal-ok — computed aggregate (round2 → number)
  costBudget: number | null // audit:decimal-ok — computed aggregate (round2 → number)
  costVariance: number | null // audit:decimal-ok — computed aggregate (round2 → number)
  costReviewedAt: string | null
  warnings: string[]
}

export type AvailabilityStatus = 'AVAILABLE' | 'ASSIGNED' | 'ON_LEAVE' | 'SICK' | 'INACTIVE'
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE'
export type CrewStatus = 'AVAILABLE' | 'ASSIGNED' | 'INACTIVE'
export type CrewMemberStatus = 'ACTIVE' | 'INACTIVE'
export type OwnershipType = 'OWNED' | 'LEASED' | 'RENTED'
export type VehicleStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_SERVICE'
// Mirrors the Prisma EquipmentStatus enum (kept explicit, not aliased to
// VehicleStatus, so the enum-parity audit guards it independently — F-003).
export type EquipmentStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_SERVICE'

export interface Employee {
  id: string
  name: string
  role: string
  department: string | null
  costRate: string | null
  availabilityStatus: AvailabilityStatus
  phone: string | null
  email: string | null
  status: EmployeeStatus
  createdAt: string
  updatedAt: string
  crewMemberships: { crew: { id: string; name: string } }[]
  _count: { assignments: number; crewsSupervised: number }
}

export interface CrewMember {
  id: string
  startDate: string
  endDate: string | null
  status: CrewMemberStatus
  employee: { id: string; name: string; role: string; availabilityStatus: AvailabilityStatus }
}

export interface CrewSummary {
  id: string
  name: string
  serviceCapability: string | null
  status: CrewStatus
  createdAt: string
  updatedAt: string
  supervisor: { id: string; name: string } | null
  _count: { members: number; assignments: number }
}

export interface CrewDetail extends CrewSummary {
  members: CrewMember[]
}

export type VehicleClass = 'LIGHT' | 'HEAVY'

export interface Vehicle {
  id: string
  plateNumber: string
  plateNumberAr: string | null
  doorNumber: string | null
  vehicleType: string
  vehicleClass: VehicleClass | null
  make: string | null
  model: string | null
  year: number | null
  color: string | null
  plateColor: string | null
  ownershipType: OwnershipType
  status: VehicleStatus
  odometer: number | null
  fuelType: string | null
  registrationExpiry: string | null
  insuranceExpiry: string | null
  inspectionExpiry: string | null
  operatingCardExpiry: string | null
  aramcoStickerExpiry: string | null
  costRate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  _count: { assignments: number }
}

export interface Equipment {
  id: string
  name: string
  equipmentType: string
  serialNumber: string | null
  status: EquipmentStatus
  ownershipType: OwnershipType
  costRate: string | null
  currentLocation: string | null
  calibrationExpiry: string | null
  maintenanceDueDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  _count: { assignments: number }
}

export type RelatedEntityType = 'EMPLOYEE' | 'VEHICLE' | 'EQUIPMENT' | 'CONTRACT' | 'CLIENT' | 'COMPANY'
export type DocumentExpiryStatus =
  | 'VALID'
  | 'EXPIRING_30'
  | 'EXPIRING_60'
  | 'EXPIRING_90'
  | 'EXPIRED'
  | 'NO_EXPIRY'

export interface DocumentRecord {
  id: string
  relatedEntityType: RelatedEntityType
  employeeId: string | null
  vehicleId: string | null
  equipmentId: string | null
  contractId: string | null
  clientId: string | null
  documentType: string
  issueDate: string | null
  expiryDate: string | null
  fileUrl: string
  notes: string | null
  createdAt: string
  expiryStatus: DocumentExpiryStatus
  employee: { id: string; name: string } | null
  vehicle: { id: string; plateNumber: string } | null
  equipment: { id: string; name: string } | null
  contract: { id: string; contractNumber: string } | null
  client: { id: string; name: string } | null
  uploadedBy: { id: string; name: string }
}

export type ResourceType = 'EMPLOYEE' | 'CREW' | 'VEHICLE' | 'EQUIPMENT'
export type AssignmentStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface Assignment {
  id: string
  jobId: string
  resourceType: ResourceType
  startDatetime: string
  endDatetime: string
  plannedHours: string | null
  actualHours: string | null
  status: AssignmentStatus
  overrideReason: string | null
  createdAt: string
  updatedAt: string
  job: { id: string; jobCode: string; title: string }
  employee: { id: string; name: string; role: string; availabilityStatus: AvailabilityStatus } | null
  crew: { id: string; name: string; status: CrewStatus } | null
  vehicle: { id: string; plateNumber: string; vehicleType: string; status: VehicleStatus } | null
  equipment: { id: string; name: string; equipmentType: string; status: EquipmentStatus } | null
  createdBy: { id: string; name: string }
}

export interface ConflictInfo {
  id: string
  jobCode: string
  jobTitle: string
  startDatetime: string
  endDatetime: string
  status: AssignmentStatus
}

export interface UtilizationResource {
  resourceType: ResourceType
  resourceId: string
  name: string
  assignedHours: number
  capacityHours: number
  utilizationPct: number
  assignmentCount: number
}

export interface UtilizationReport {
  from: string
  to: string
  capacityHours: number
  resources: UtilizationResource[]
}

export interface OperationsDashboard {
  jobsByStatus: Record<string, number>
  activeJobs: number
  upcomingJobs: number
  assignmentsByStatus: Record<string, number>
  contractsNearExpiry: number
  posNearExpiry: number
  recentJobs: Array<{
    id: string
    jobCode: string
    title: string
    status: JobStatus
    plannedStartDate: string
    client: { id: string; name: string }
  }>
  topUtilization: UtilizationResource[]
}

export interface AssetsDashboard {
  resourceCounts: { employees: number; crews: number; vehicles: number; equipment: number }
  employeesByAvailability: Record<string, number>
  vehiclesByStatus: Record<string, number>
  equipmentByStatus: Record<string, number>
  documentExpiry: {
    total: number
    expired: number
    expiring30: number
    expiring60: number
    expiring90: number
    noExpiry: number
    valid: number
  }
  expiringSoon: Array<{
    id: string
    documentType: string
    relatedEntityType: RelatedEntityType
    expiryDate: string | null
    record: string
  }>
}

export interface ApiErrorResponse {
  statusCode: number
  message: string | string[]
  error: string
  path: string
  timestamp: string
}

// =============================================================================
// Phase 2 — Finance: Estimates, Invoices, Payments
// =============================================================================

export type EstimateStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'EXPIRED'

export type InvoiceStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'

export type LineKind = 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'STANDBY' | 'OTHER'
export type BillingUnit = 'HOUR' | 'DAY' | 'TRIP' | 'METER' | 'UNIT' | 'LUMP_SUM'
export type PaymentMethod = 'BANK_TRANSFER' | 'CHECK' | 'CASH' | 'CARD' | 'OTHER'

export interface FinanceLineItem {
  id: string
  contractRateCardId: string | null
  lineKind: LineKind
  description: string
  quantity: string
  hours: string
  unit: BillingUnit
  unitPrice: string
  vatRate: string
  lineSubtotal: string
  lineVat: string
  lineTotal: string
  sortOrder: number
}

export interface EstimateSummary {
  id: string
  estimateNumber: string
  title: string
  jobType: string
  location: string
  status: EstimateStatus
  currency: string
  totalAmount: string
  plannedStartDate: string
  plannedEndDate: string
  validUntil: string | null
  jobId: string | null
  createdAt: string
  client: { id: string; name: string }
  contract: { id: string; contractNumber: string } | null
}

// Estimate lines carry an optional internal cost projection (S12); invoice lines
// do not, so this extends the shared shape rather than widening it.
export interface EstimateLineItem extends FinanceLineItem {
  estimatedUnitCost: string | null
  lineCost: string | null
}

export interface EstimateDetail extends EstimateSummary {
  notes: string | null
  subtotal: string
  vatAmount: string
  estimatedCost: string | null
  estimatedMarginPct: string | null
  pdfUrl: string | null
  approvedAt: string | null
  updatedAt: string
  job: { id: string; jobCode: string; title: string; status: JobStatus } | null
  createdBy: { id: string; name: string } | null
  approvedBy: { id: string; name: string } | null
  lineItems: EstimateLineItem[]
}

export interface InvoicePaymentLine {
  id: string
  paymentDate: string
  amount: string
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
}

export interface InvoiceSummary {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  currency: string
  invoiceDate: string
  dueDate: string
  totalAmount: string
  paidAmount: string
  outstandingAmount: string
  jobId: string | null
  createdAt: string
  client: { id: string; name: string }
  job: { id: string; jobCode: string } | null
}

export interface InvoiceDetail extends InvoiceSummary {
  uuid: string
  subtotal: string
  vatAmount: string
  clientVatNumber: string | null
  billingAddress: string | null
  servicePeriodFrom: string | null
  servicePeriodTo: string | null
  notes: string | null
  zatcaStatus: string | null
  pdfUrl: string | null
  submittedAt: string | null
  approvedAt: string | null
  updatedAt: string
  estimate: { id: string; estimateNumber: string } | null
  contract: { id: string; contractNumber: string } | null
  purchaseOrder: { id: string; poNumber: string; poValue: string; consumedAmount: string } | null
  job: { id: string; jobCode: string; title: string; status: JobStatus } | null
  createdBy: { id: string; name: string } | null
  approvedBy: { id: string; name: string } | null
  lineItems: FinanceLineItem[]
  payments: InvoicePaymentLine[]
}

export interface Payment {
  id: string
  invoiceId: string
  clientId: string
  paymentDate: string
  amount: string
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
  createdAt: string
  invoice: { id: string; invoiceNumber: string; totalAmount: string; outstandingAmount: string; status: InvoiceStatus }
  client: { id: string; name: string }
}

export interface AgingBuckets {
  current: number
  d31_60: number
  d61_90: number
  d90_plus: number
}

export interface AgingInvoiceRow {
  id: string
  invoiceNumber: string
  client: { id: string; name: string }
  dueDate: string
  outstandingAmount: number // audit:decimal-ok — computed aggregate (round2 → number)
  daysPastDue: number
  bucket: keyof AgingBuckets
  status: InvoiceStatus
}

export interface AgingReport {
  asOf: string
  buckets: AgingBuckets
  totalOutstanding: number // audit:decimal-ok — computed aggregate (round2 → number)
  invoices: AgingInvoiceRow[]
}

// Finance dashboard KPIs (S13). All money figures are computed aggregates
// returned as numbers (backend round2), not raw Decimal strings.
export interface FinanceDashboard {
  range: { from: string; to: string }
  revenue: {
    invoicedTotal: number // audit:decimal-ok — computed aggregate (round2 → number)
    invoicedSubtotal: number // audit:decimal-ok — computed aggregate (round2 → number)
    outputVat: number // audit:decimal-ok — computed aggregate (round2 → number)
    collected: number // audit:decimal-ok — computed aggregate (round2 → number)
  }
  receivables: {
    totalOutstanding: number // audit:decimal-ok — computed aggregate (round2 → number)
    overdueAmount: number // audit:decimal-ok — computed aggregate (round2 → number)
    aging: AgingBuckets
  }
  profit: {
    jobsReviewed: number
    grossProfit: number // audit:decimal-ok — computed aggregate (round2 → number)
    avgMarginPct: number | null // audit:decimal-ok — computed aggregate (round2 → number)
  }
  expenses: {
    total: number // audit:decimal-ok — computed aggregate (round2 → number)
    inputVat: number // audit:decimal-ok — computed aggregate (round2 → number)
    byCategory: Record<string, number> // audit:decimal-ok — computed aggregate (round2 → number)
  }
  vat: {
    output: number // audit:decimal-ok — computed aggregate (round2 → number)
    input: number // audit:decimal-ok — computed aggregate (round2 → number)
    net: number // audit:decimal-ok — computed aggregate (round2 → number)
  }
  unbilled: {
    count: number
    value: number // audit:decimal-ok — computed aggregate (round2 → number)
  }
  invoicesByStatus: Record<string, number>
}

// =============================================================================
// Phase 2 — Field data: Daily Reports & Timesheets (S10)
// =============================================================================

export type ApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'POSTED'

export interface DailyReportSummary {
  id: string
  reportDate: string
  workPerformed: string
  progressPct: string | null
  approvalStatus: ApprovalStatus
  createdAt: string
  job: { id: string; jobCode: string; title: string }
  supervisor: { id: string; name: string } | null
}

export interface DailyReportDetail extends DailyReportSummary {
  clientRep: string | null
  weather: string | null
  issues: string | null
  materialsUsed: string | null
  equipmentUsed: string | null
  vehiclesUsed: string | null
  rejectionReason: string | null
  approvedAt: string | null
  updatedAt: string
  approvedBy: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
}

export interface TimesheetSummary {
  id: string
  workDate: string
  regularHours: string
  overtimeHours: string
  standbyHours: string
  travelHours: string
  approvalStatus: ApprovalStatus
  createdAt: string
  job: { id: string; jobCode: string; title: string }
  employee: { id: string; name: string } | null
  crew: { id: string; name: string } | null
}

export interface TimesheetDetail extends TimesheetSummary {
  notes: string | null
  rejectionReason: string | null
  approvedAt: string | null
  updatedAt: string
  approvedBy: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
}

export type ExpenseCategory =
  | 'LABOR'
  | 'VEHICLE'
  | 'EQUIPMENT'
  | 'MATERIAL'
  | 'SUBCONTRACTOR'
  | 'ACCOMMODATION'
  | 'TRANSPORTATION'
  | 'ADMIN'
  | 'GOVERNMENT'
  | 'FINANCE'
  | 'OTHER_DIRECT'
  | 'OVERHEAD'

export type ReimbursementStatus =
  | 'NOT_APPLICABLE'
  | 'PENDING'
  | 'COMPENSATED'
  | 'DELAYED'
  | 'DECLINED'

export interface ExpenseSummary {
  id: string
  expenseDate: string
  vendor: string | null
  category: ExpenseCategory
  totalAmount: string
  currency: string
  approvalStatus: ApprovalStatus
  reimbursable: boolean
  reimbursementStatus: ReimbursementStatus
  receiptName: string | null
  createdAt: string
  jobId: string | null
  vehicleId: string | null
  equipmentId: string | null
  employeeId: string | null
  job: { id: string; jobCode: string; title: string } | null
  employee: { id: string; name: string } | null
  unallocated: boolean
}

export interface ExpenseDetail extends ExpenseSummary {
  description: string | null
  amountBeforeVat: string
  vatAmount: string
  approvedAt: string | null
  rejectionReason: string | null
  postedAt: string | null
  receiptUrl: string | null
  reimbursedAt: string | null
  reimbursementNote: string | null
  reimbursementMethod: PaymentMethod | null
  reimbursementRef: string | null
  updatedAt: string
  vehicle: { id: string; plateNumber: string; vehicleType: string } | null
  equipment: { id: string; name: string } | null
  approvedBy: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
}

export interface ReimbursementEmployeeGroup {
  employee: { id: string; name: string }
  pending: number
  compensated: number
  delayed: number
  declined: number
  totalOwed: number // audit:decimal-ok — computed aggregate (round2 → number)
  expenses: ExpenseSummary[]
}

export interface ReimbursementSummary {
  totalOwed: number // audit:decimal-ok — computed aggregate (round2 → number)
  employees: ReimbursementEmployeeGroup[]
}
