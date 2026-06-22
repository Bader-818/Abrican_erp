# Abrican ERP — Invariant Catalog

The canonical list of logic invariants the system must uphold, organized by audit domain
plus the cross-module contracts. Each invariant is a checkable assertion — it is the oracle
for the unit (P3) and e2e (P4) tests and the checklist for manual review. IDs are stable
(`INV-<domain>-<n>`) so tests and findings can cite them.

## D1 — Identity & access
- **INV-D1-1** Login with valid credentials + no MFA returns access token + sets refresh cookie; wrong password increments `failedLoginAttempts`; 5 failures within window → `lockedUntil` set → 423/401 until it passes.
- **INV-D1-2** With MFA enabled, password-only login returns `{ mfaRequired: true }` (HTTP 200, **no tokens**); valid TOTP returns tokens.
- **INV-D1-3** Refresh rotates the token single-use; replaying a revoked token revokes the whole family and records `TOKEN_REUSE_DETECTED`.
- **INV-D1-4** Guard order is Throttler → Jwt → Permissions → MustChangePassword. A user with `mustChangePassword` is blocked from every route except those marked `@AllowDuringPasswordChange` (me/logout/logout-all/change-password) → 403 otherwise.
- **INV-D1-5** `@Public()` routes bypass JwtAuthGuard; all others require a valid access token.
- **INV-D1-6** A permission enforced anywhere (decorator **or** `permissions.includes`) exists in the seed `PERMISSIONS`; every seeded permission is reachable (no orphans) — see F-001.

## D2 — Commercial master data
- **INV-D2-1** A `PurchaseOrder.consumedAmount` only ever increases, by exactly the issued invoice total, and never by more than `poValue` without a manager override.
- **INV-D2-2** `ContractRateCard.unitPrice` is the **only** source of estimate/invoice pricing; resource `costRate` never feeds price.
- **INV-D2-3** Client `paymentTermsDays` drives invoice `dueDate` (= invoiceDate + terms).
- **INV-D2-4** Deleting a client/contract/PO referenced by a job or invoice is blocked (FK), not silently cascaded.

## D3 — Job lifecycle & status
- **INV-D3-1** User status changes obey `ALLOWED_TRANSITIONS`; an illegal transition → 400.
- **INV-D3-2** Activating a job with zero non-cancelled assignments requires `jobs.status_override` + a reason (audited `OVERRIDE`); otherwise 400.
- **INV-D3-3** `applyFinanceStatus` is forward-only along `FINANCE_ORDER` (COMPLETED→COSTING_REVIEW→READY_FOR_INVOICE→INVOICED→PARTIALLY_PAID→PAID→CLOSED); backward/no-op moves are ignored, not errors.
- **INV-D3-4** A `CANCELLED` job cannot be invoiced or paid (finance status refuses it).
- **INV-D3-5** A job below `COMPLETED` cannot receive any finance status.
- **INV-D3-6** Every status change writes a `JobStatusHistory` row + an audit entry.

## D4 — Resources & scheduling
- **INV-D4-1** A `JobAssignment` references **exactly one** resource (employee XOR crew XOR vehicle XOR equipment).
- **INV-D4-2** Overlapping bookings of the same resource → 409, unless an `assignments.override` holder supplies an `overrideReason` (audited `OVERRIDE`).
- **INV-D4-3** Bulk assign is transactional, dedupes, evaluates conflicts per-resource, and one override reason covers the batch.
- **INV-D4-4** Utilization = assigned hours ÷ (weekdays × 8h) capacity over the window.
- **INV-D4-5** Equipment/Vehicle/Employee/Crew status enums in Prisma match the frontend unions (enum-parity clean).

## D5 — Documents & expiry
- **INV-D5-1** A document carries the one typed FK matching its `relatedEntityType` (COMPANY = none); supplying the wrong FK → 400.
- **INV-D5-2** Expiry status buckets: Valid / Expiring-30/60/90 / Expired / No-expiry, computed from `expiryDate`.
- **INV-D5-3** Upload persists via `IStorageService`; a DB-write failure deletes the orphaned file.
- **INV-D5-4** Download is auth-gated (`documents.view`) and streamed.

## D6 — Daily reports & timesheets (shared approval workflow)
- **INV-D6-1** State machine: `DRAFT/REJECTED → SUBMITTED → APPROVED | REJECTED`; identical shape across daily-reports and timesheets.
- **INV-D6-2** Editable/deletable only in `{DRAFT, REJECTED}`; any mutation of an APPROVED/SUBMITTED record → 409.
- **INV-D6-3** `submit` clears the prior `rejectionReason`; `approve` stamps `approvedById`/`approvedAt`.
- **INV-D6-4** Approve/reject require `*.approve`; create/edit/submit require `*.manage`.
- **INV-D6-5** A timesheet references exactly one of employee/crew and carries > 0 total hours (create **and** update).

## D7 — Finance value chain (estimate → invoice → payment)
- **INV-D7-1** Per line: `lineSubtotal = quantity × hours × unitPrice` (LUMP_SUM skips hours); `lineVat = lineSubtotal × vatRate`; `lineTotal = sub + vat` — all via `computeLine`/`round2`.
- **INV-D7-2** Document totals = Σ line amounts (`sumTotals`); default VAT rate = 15.
- **INV-D7-3** Estimate lifecycle `DRAFT→SENT→APPROVED→CONVERTED`; `convert` creates a Job and copies `totalAmount` → `Job.jobValue`.
- **INV-D7-4** `from-estimate` copies estimate lines as editable invoice **actuals**.
- **INV-D7-5** Invoice issue requires client VAT number + (PO balance ≥ total, else override); on issue: consumes the PO, sets job `INVOICED`, snapshots the PDF.
- **INV-D7-6** Invoice lifecycle `DRAFT→PENDING_APPROVAL→APPROVED→SUBMITTED`; only `SUBMITTED`/`PARTIALLY_PAID` invoices accept payments.
- **INV-D7-7** Payment: `paidAmount += amount` (≤ outstanding), `outstandingAmount = total − paid` (never < 0); flips invoice `PARTIALLY_PAID`/`PAID` and mirrors job status — atomically.
- **INV-D7-8** All amounts are `Decimal(14,2)`; raw entity amounts serialize as **strings**; `formatCurrency` accepts string|number.

## D8 — Expenses & reimbursement
- **INV-D8-1** State machine `DRAFT/REJECTED → SUBMITTED → APPROVED → POSTED`; editable only in `{DRAFT, REJECTED}`.
- **INV-D8-2** `vatAmount` defaults to 15% of `amountBeforeVat` (editable); `totalAmount = base + vat` via `round2`; amount must be > 0.
- **INV-D8-3** **Self-approval block**: `approve`/`reject`/`post`/`reimburse` throw 403 when `createdById === current user` (universal, incl. Admin).
- **INV-D8-4** A `reimbursable` expense requires an `employeeId`; approving it sets `reimbursementStatus = PENDING`; `reimburse` sets COMPENSATED/DELAYED/DECLINED (+ stamps `reimbursedAt` on COMPENSATED).
- **INV-D8-5** Posting with no job/vehicle/equipment/employee surfaces `unallocated` (flag, not block).
- **INV-D8-6** Receipt stored via `IStorageService` under `expenses/`; orphan cleanup on failure; download auth-gated.

## D9 — Dashboards & aggregation
- **INV-D9-1** Operations/assets aggregations equal the underlying row counts/sums (no double counting).
- **INV-D9-2** `dashboard.*.view` gates each dashboard; field roles see no finance dashboard. (F-001: finance dashboard not yet implemented.)

## DX — Cross-cutting infra
- **INV-DX-1** Every list endpoint honours `pageSize ≤ 100`; dropdown loaders pass `pageSize: 100` (pagination-guard clean).
- **INV-DX-2** Every create/update/delete/approve/reject/status-change records an audit entry (directly or via `@AuditEntity`) with a consistent `entityType`.
- **INV-DX-3** Prisma enums and frontend unions are in parity (enum-parity clean).
- **INV-DX-4** Global `ValidationPipe` runs `whitelist + forbidNonWhitelisted`; unknown body fields → 400.
- **INV-DX-5** `paginate()` returns `{ data, total, page, pageSize, totalPages }` uniformly.

## Cross-module contracts (the seams)
- **INV-X-1** Money math is identical everywhere it appears (estimates, invoices, expenses) because all use `common/finance/line-math.ts` — no module re-implements rounding/VAT.
- **INV-X-2** Job status is mutated only by `JobsService.changeStatus` (user) and `JobStatusService.applyFinanceStatus` (finance events); no other module writes `Job.status` directly.
- **INV-X-3** PO consumption and invoice/job status changes on issue happen in **one transaction** (no partial state).
- **INV-X-4** The approval-workflow shape (D6/D8) is identical across daily-reports, timesheets, expenses except for documented deltas (expenses adds POSTED + self-approval block).
- **INV-X-5** The RBAC triangle is closed: decorator ∪ imperative perms = seeded perms ⊆ granted, and the frontend gates on the same keys.
