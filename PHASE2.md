# Phase 2 — Finance: Estimation, Invoicing & Receivables

> **Build status (2026-06-18):** ★ **S7 Estimation, S8 Invoicing, S9 Payments,
> S10 Daily Reports & Timesheets, and S11 Expenses are implemented, tested, and live.**
> S7–S9: estimate→quotation→job→invoice→payment with bilingual ZATCA-Phase-1 PDFs,
> PO-balance validation, AR aging (migration `phase2_finance`). S10: daily reports +
> timesheets with a DRAFT→SUBMITTED→APPROVED/REJECTED approval workflow (migration
> `field_reports_timesheets`). S11: expenses with categories, multi-allocation, receipt
> upload, the DRAFT→SUBMITTED→APPROVED→POSTED workflow, a hard self-approval block (SRS
> 168), and a post-approval per-employee **reimbursement** worklist (compensate / delay /
> decline) — migration `expenses`. Posted expenses feed S12 costing. 113 backend unit
> tests + 25 frontend tests + 22 e2e pass; all flows smoke-tested end-to-end.
> **Still pending:** S12 Job Costing & Profitability (the profit feature — schema fields
> pre-wired, marked `// PROFIT (S12)`), S13 Finance Dashboard.

This is the executable roadmap for **Phase 2** of Abrican ERP — the *finance half* of the
SRS that turns a job into money. It is sequenced around the primary business goal:

> **Estimate a job's price from contract rates → get it approved → do the work → invoice
> from the actual quantities → collect payment.**

Internal **cost & profit** (price minus what the work costs Abrican) is a deliberate
*later* stage (S12). The data model below pre-wires the fields it needs so profit can be
added without re-migrating — but the early sprints (S7–S9) deliver the estimate→invoice→pay
flow on **price alone**.

> Phase 1 (foundation + operational core) is complete. Read
> [ARCHITECTURE.md](ARCHITECTURE.md) first — Phase 2 reuses its module skeleton, RBAC,
> storage, audit, pagination, and job state machine. This document only describes what is
> **new**.

SRS source of truth: `abrican_erp_srs_full_prompt.md` — finance sections ~793–1114,
dashboard KPIs 327–342, finance reports 1320–1337, approval workflows 1376–1391, critical
alerts 2170–2185, rate cards 554–578, PO/invoice validation 610.

---

## 0. Two rates — never mix them

| | Source field | Drives |
|---|---|---|
| **Price** (what the client pays) | `ContractRateCard.unitPrice` | estimates, quotations, **invoices** |
| **Cost** (what Abrican spends) | `Employee` / `Vehicle` / `Equipment.costRate` (SAR/hour) | **profit / margin only (S12, later)** |

The estimate→invoice flow (S7–S9) uses **Price only**. Cost is layered in at S12 to reveal
profit. Keeping them separate is why "estimate a price" and "see margin" are different
sprints, not one tangled feature.

---

## 1. Overview

Full job-to-cash lifecycle Phase 2 completes (★ = the user's primary flow, built first):

```
★ Job estimated from rate card (price)          (S7)  → Quotation PDF
★   client approves → converted to a Job order
★ Work performed → actual quantities recorded
★ Invoice generated from actuals × rate card    (S8)  → status INVOICED, Invoice PDF
★ Payment recorded (full / partial)             (S9)  → status PARTIALLY_PAID / PAID → CLOSED

  ── then, to unlock profit & operational accuracy ──
  Daily Reports + Timesheets approved            (S10)
  Expenses posted                                (S11)
  Job Costing: actual cost + margin (price−cost) (S12) → status COSTING_REVIEW
  Finance dashboard & reports                    (S13)
```

**Already scaffolded in Phase 1 (do not rebuild):**
- `ContractRateCard` already stores the **price** rate schedule (serviceLine, description,
  unit, `unitPrice`, vatApplicable, effectiveDate) — one row per labour role / equipment
  type. The estimation engine reads these.
- `Job` already has client/contract/serviceType/location/planned dates and `jobValue`
  (expected revenue) + `costBudget` (estimated cost).
- `JobStatus` enum already has `INVOICED`, `PARTIALLY_PAID`, `PAID`, `CLOSED`,
  `COSTING_REVIEW`, `READY_FOR_INVOICE` and their transitions in
  `backend/src/jobs/job-status.constants.ts` — labels today; Phase 2 wires the side-effects.
  The quotation lifecycle (draft/approved/converted) lives on the new `Estimate` entity, so
  no new `JobStatus` value is needed.
- `Employee` / `Vehicle` / `Equipment.costRate` exist for the later profit stage (S12).
- `Client` (`vatNumber`, `billingAddress`, `paymentTermsDays`), `PurchaseOrder` (poValue,
  `consumedAmount`) — everything invoicing needs already models.

**Dependency order:** S7 → S8 → S9 deliver the price flow (S8 needs S7; S9 needs S8). S10
and S11 are independent operational-data capture. S12 needs S7 (estimated cost) + S10 + S11
(actual cost) to compute margin. S13 reports across all.

---

## 2. Reusable Phase-1 foundations

| Need | Reuse | Location |
|---|---|---|
| Module skeleton | `module + controller (@RequirePermissions) + service + service.spec + dto/` | pattern: `backend/src/assignments/` |
| Pagination | `paginate<T>()`, `PaginationQueryDto` (pageSize ≤ 100) | `backend/src/common/helpers/pagination.helper.ts`, `common/dto/` |
| RBAC | permission seeding (`<entity>.<action>`), 9 roles incl. Finance Manager / Accountant / CEO-GM | `backend/prisma/seed.ts` |
| File storage | `IStorageService` — quotation & invoice PDFs, receipts, ESV/service reports | `backend/src/storage/storage.interface.ts` |
| Audit | `@AuditEntity` + `AuditLogInterceptor`; `AuditAction` already has `APPROVE`/`REJECT` | `backend/src/common/...` |
| Job state machine | financial transitions defined; wire side-effects | `backend/src/jobs/job-status.constants.ts` |
| Notifications | critical finance alerts | `backend/src/notifications/` |
| Frontend CRUD | list + detail + form-dialog; nav; routes; one `*.api.ts` per domain | `frontend/src/layout/nav-items.ts`, `App.tsx`, `frontend/src/api/` |
| Charts | Donut / Bar / SegmentedBar / utilizationTone | `frontend/src/components/charts.tsx` |

---

## 3. New RBAC permissions

Add to `backend/prisma/seed.ts` (naming convention `<entity>.<action>`) and grant per role.
A **Project Coordinator** capability set (estimates + invoices view) maps onto Ops Manager /
a new role as you prefer.

| Permission | Admin | CEO/GM | Finance Mgr | Accountant | Ops Mgr | Field Sup. |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `estimates.view` | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `estimates.manage` | ✓ | | ✓ | ✓ | ✓ | |
| `estimates.approve` | ✓ | ✓ | ✓ | | | |
| `invoices.view` | ✓ | ✓ | ✓ | ✓ | | |
| `invoices.manage` | ✓ | | ✓ | ✓ | | |
| `invoices.approve` | ✓ | ✓ | ✓ | | | |
| `payments.view` | ✓ | ✓ | ✓ | ✓ | | |
| `payments.manage` | ✓ | | ✓ | ✓ | | |
| `daily_reports.view` / `.manage` / `.approve` | ✓ | view | view | view | ✓/✓/✓ | ✓/✓/ |
| `timesheets.view` / `.manage` / `.approve` | ✓ | view | view | view | ✓/✓/✓ | ✓/✓/ |
| `expenses.view` / `.manage` / `.approve` | ✓ | view | ✓/✓/✓ | view/✓/ | ✓/✓/ | /✓/ |
| `costing.view` | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `dashboard.finance.view` | ✓ | ✓ | ✓ | ✓ | | |

> SRS guardrails to encode: users should not approve their own expenses (SRS 168); finance
> users should not alter operational daily reports unless permitted (SRS 167); field
> supervisors get no finance dashboards.

---

## 4. New data model (Prisma)

Each block is a new migration. Money columns `@db.Decimal(14, 2)`; rates `@db.Decimal(10, 2)`.
**Fields marked `// PROFIT (S12)` are added now but only populated later** — this is how we
"account for profit for future development" without a second migration.

### New enums
```prisma
enum EstimateStatus { DRAFT  SENT  APPROVED  REJECTED  CONVERTED  EXPIRED }
enum InvoiceStatus  { DRAFT  PENDING_APPROVAL  APPROVED  SUBMITTED  PARTIALLY_PAID  PAID  OVERDUE  CANCELLED }
enum ApprovalStatus { DRAFT  SUBMITTED  APPROVED  REJECTED  POSTED }   // daily reports / timesheets / expenses (S10–S11)
enum ExpenseCategory {
  LABOR  VEHICLE  EQUIPMENT  MATERIAL  SUBCONTRACTOR  ACCOMMODATION
  TRANSPORTATION  ADMIN  GOVERNMENT  FINANCE  OTHER_DIRECT  OVERHEAD     // SRS 850–863
}
enum PaymentMethod  { BANK_TRANSFER  CHECK  CASH  CARD  OTHER }
enum LineKind       { LABOR  EQUIPMENT  MATERIAL  STANDBY  OTHER }      // categorises an estimate/invoice line
enum BillingUnit    { HOUR  DAY  TRIP  METER  UNIT  LUMP_SUM }          // mirrors rate-card units
```

### `Estimate`  (the quotation)
```
estimateNumber (sequential, unique), clientId, contractId, jobId? (set on conversion),
title, jobType, location, plannedStartDate, plannedEndDate, currency,
status (EstimateStatus), validUntil, notes,
subtotal, vatAmount, totalAmount,            // PRICE — the quoted figure
estimatedCost  Decimal?  // PROFIT (S12) — Σ line cost, populated later
estimatedMarginPct Decimal? // PROFIT (S12)
createdById, approvedById?, approvedAt?, timestamps
lineItems EstimateLineItem[]
```

### `EstimateLineItem`
```
estimateId, contractRateCardId? (pull rate), lineKind (LineKind), description,
quantity (e.g. # personnel / # equipment units), hours (man-hours / equipment-hours),
unit (BillingUnit), unitPrice (SELLING rate from rate card), vatRate (@default 15),
lineSubtotal, lineVat, lineTotal,            // = quantity × hours × unitPrice (+VAT)
estimatedUnitCost Decimal? // PROFIT (S12) — internal costRate snapshot
lineCost          Decimal? // PROFIT (S12) — quantity × hours × estimatedUnitCost
```
> Standby is just another line with `lineKind = STANDBY` (its own qty/hours/rate), so the
> "Standby Cost" rule needs no special column.

### `Invoice`
```
uuid (ZATCA-ready), invoiceNumber (sequential, unique), estimateId? (source quote),
clientId, contractId?, purchaseOrderId?, jobId?, clientVatNumber, billingAddress,
servicePeriodFrom, servicePeriodTo, invoiceDate, dueDate (from paymentTermsDays), currency,
subtotal, vatAmount, totalAmount, paidAmount (@default 0), outstandingAmount,
status (InvoiceStatus), zatcaStatus? (Phase 3 placeholder),
createdById, approvedById?, timestamps
lineItems InvoiceLineItem[]   payments Payment[]
```

### `InvoiceLineItem`
```
invoiceId, sourceEstimateLineItemId? (copied from the quote), contractRateCardId?,
lineKind, description, quantity (ACTUAL qty), hours (ACTUAL hours), unit (BillingUnit),
unitPrice, vatRate (@default 15), lineSubtotal, lineVat, lineTotal
```

### `Payment`
```
invoiceId, clientId, paymentDate, amount, method (PaymentMethod),
referenceNumber?, notes?, createdById, timestamps   // proof via Document (RelatedEntityType += PAYMENT)
```

### `DailyReport` / `Timesheet` / `Expense`  (S10–S11; cost-capture)
- **DailyReport** — job, date, supervisor(employee), workPerformed, progressPct?, clientRep?,
  weather?, issues?, approvalStatus, approvedById?/At?, createdById, timestamps.
- **Timesheet** — job, employeeId?/crewId?, date, regular/overtime/standby/travel hours,
  approvalStatus, approvedById?/At?, createdById. (Labour cost derived at S12.)
- **Expense** — date, vendor?, category(ExpenseCategory), amountBeforeVat, vatAmount,
  totalAmount, currency, description, approvalStatus, postedAt?, multi-allocation nullable FKs
  (jobId?/departmentId?/vehicleId?/equipmentId?/employeeId? — mirror `JobAssignment`), receipt
  via Document. DB check: category + totalAmount required (SRS 896).

### `Job` — add the profit fields now, fill them later
```prisma
actualCost      Decimal? @db.Decimal(14, 2)   // PROFIT (S12)
grossProfit     Decimal? @db.Decimal(14, 2)   // PROFIT (S12) jobValue − actualCost
grossMarginPct  Decimal? @db.Decimal(6, 2)    // PROFIT (S12)
costReviewedAt  DateTime?                       // PROFIT (S12)
costReviewedById String?
```

---

## 5. Sprints

### ★ S7 — Job Estimation & Quotation  *(the front of your flow)*
- **Module:** `estimates` (standard skeleton) + `EstimateLineItem`.
- **Endpoints:** CRUD; `POST /estimates/:id/lines` (add labour/equipment/standby line);
  auto-recalc totals on every line change; `POST /:id/generate-pdf` (quotation PDF via
  `IStorageService`); approval workflow `POST /:id/send | /approve | /reject`;
  `POST /:id/convert` → creates/links a `Job` (job order) and sets estimate `CONVERTED`.
- **Calculation (price only):** per line `lineSubtotal = quantity × hours × unitPrice`
  (LUMP_SUM lines skip hours); `lineVat = lineSubtotal × vatRate`; estimate
  `subtotal/vatAmount/totalAmount` = Σ lines. `unitPrice` defaults from the chosen
  `ContractRateCard` row but is editable. On convert, copy `totalAmount` → `Job.jobValue`.
- **State machine:** `DRAFT → SENT → APPROVED → CONVERTED`; `REJECTED`, `EXPIRED` (past
  `validUntil`).
- **Profit hook (build the columns, not the logic):** persist `estimatedUnitCost`/`lineCost`
  as nullable; leave null for now. S12 backfills + computes `estimatedMarginPct`.
- **Frontend:** coordinator form (client/contract/job type/location/dates + add-line picker
  pulling rate-card items), live total, "Generate quotation PDF", "Convert to job".
- **Tests:** line math, total roll-up, VAT, rate-card default + override, convert→job.

### ★ S8 — Invoicing  *(from the approved estimate's actual quantities)*
- **Module:** `invoices` + `InvoiceLineItem`.
- **Endpoints:** `POST /invoices/from-estimate/:estimateId` (copies the quote's lines as the
  starting point); edit each line's **actual** quantity/hours; `POST /:id/generate-pdf`;
  submit/approve workflow; list with AR filters.
- **Generation:** invoice line = `actual quantity × actual hours × unitPrice` (+VAT 15%,
  configurable per line). **General engine, not Aramco-specific** (SRS 1072) — add
  client-specific templates later.
- **Validations:** PO remaining balance — block submit if invoice > remaining PO unless
  manager override (SRS 610); require client VAT number (SRS 1042); validate line totals.
- **ZATCA-ready fields only** (uuid, sequential number, QR placeholder) — **no live ZATCA
  submission** (Phase 3).
- **State machine:** `DRAFT → PENDING_APPROVAL → APPROVED → SUBMITTED`; submission sets the
  job status `INVOICED`. PDF via `IStorageService`.
- **Tests:** copy-from-estimate, actual-qty edit, VAT math, PO-overrun block + override,
  status side-effect.

### ★ S9 — Payments & Receivables
- **Module:** `payments`.
- **Endpoints:** `POST /payments` (full/partial), list, per-invoice history, AR aging report.
- **Rules:** on payment recompute `invoice.paidAmount` / `outstandingAmount`; auto-set
  invoice `PARTIALLY_PAID` (balance > 0) or `PAID` (≤ 0) and mirror to job status
  `PARTIALLY_PAID` / `PAID` (SRS 1099). AR aging buckets 0–30 / 31–60 / 61–90 / 90+ (SRS
  1106). Overdue alert when `dueDate < today` and unpaid (SRS 2174).
- **Close gate:** job can't reach `CLOSED` unless paid or manager override (SRS 490).
- **Tests:** partial→paid transitions, outstanding math, aging bucketing, close gate.

> **End of the price-only flow.** S7–S9 = estimate → quotation → job → invoice → payment,
> fully usable without any cost data.

### S10 — Daily Reports & Timesheets  *(operational accuracy / profit input)*
- **Modules:** `daily-reports`, `timesheets`. CRUD + `submit/approve/reject`.
- **State machine:** `DRAFT → SUBMITTED → APPROVED | REJECTED`; approved records lock.
- **Use:** approved timesheet hours can (optionally) auto-fill invoice **actual hours**, and
  feed labour cost in S12. Timesheets track regular/overtime/standby/travel (SRS 826).
- **Tests:** approval transitions, permission gating, lock-after-approve.

### S11 — Expenses  *(profit input)* — ✅ **built**
- **Module:** `expenses` (+ `ExpenseCategory`, `ReimbursementStatus`). CRUD +
  submit/approve/reject + `POST /:id/post` + `POST /:id/reimburse` + receipt upload/download
  (`POST/GET /:id/receipt`) + `GET /reimbursements/summary`.
- **State machine:** `DRAFT → SUBMITTED → APPROVED → POSTED`; `REJECTED` (re-editable → resubmit).
  EDITABLE = {DRAFT, REJECTED}; everything else locks (409).
- **Money:** `vatAmount` defaults to 15% of `amountBeforeVat` (editable); `totalAmount`
  computed server-side via `round2`.
- **Rules implemented:** category + positive amount required to submit (SRS 896); an
  `unallocated` flag surfaced when no job/vehicle/equipment/employee is set (SRS 897 — flagged,
  not blocked); **hard self-approval block** — `approve`/`reject`/`post`/`reimburse` throw
  `ForbiddenException` when `createdById === current user`, applied universally (SRS 168).
- **Receipts:** stored via `IStorageService` under `expenses/` (10 MB cap, image/PDF/office),
  not the generic `Document` module — a `receiptUrl`/`receiptName` pair on the row.
- **Reimbursement track:** `reimbursable` expenses must name the employee owed; approving one
  sets `reimbursementStatus = PENDING`; a manager works the per-employee summary and marks each
  **Compensated / Delayed / Declined** (`reimburse`), with method/reference/date on compensate.
- **Frontend:** Expenses list (status + reimbursement badges, unallocated warning), form
  (auto-VAT, allocation pickers, reimbursable toggle, receipt input), detail (workflow +
  receipt view + reimbursement panel), and a **Reimbursements** worklist grouped by employee.
- **Tests:** 14 unit (VAT math, posting validations, all transitions, self-approval block,
  reimbursement flow, allocation flag); smoke-tested live incl. 403 self-approve + 409 lock.

### S12 — Job Costing & Profitability  *(the profit feature — price minus cost)*
- **Module:** `costing` (read/aggregate) + `POST /jobs/:id/cost-review`.
- **Compute `actualCost` by category** =
  labour (Σ approved timesheet hours × `employee.costRate`)
  + vehicle/equipment (Σ `JobAssignment.actualHours` × resource `costRate`)
  + posted expenses grouped by `ExpenseCategory`.
  Then `grossProfit = invoiced revenue (or jobValue) − actualCost`, `grossMarginPct`,
  cost variance (`actualCost − costBudget`), and **estimated-vs-actual margin** (compare the
  estimate's now-backfilled `estimatedCost` to `actualCost`). Metrics per SRS 940–951.
- **Backfill the S7 profit hooks:** populate `EstimateLineItem.estimatedUnitCost/lineCost`
  and `Estimate.estimatedCost/estimatedMarginPct` from `costRate` so quotes show margin too.
- **Wire status side-effects:** `COMPLETED → COSTING_REVIEW → READY_FOR_INVOICE`.
- **Alerts:** cost exceeds budget; margin below target (SRS 2170–2171).
- **Tests:** cost aggregation across all three sources, margin/variance math, estimate-vs-actual.

### S13 — Finance Dashboard & Reports
- **Backend:** extend `dashboard` with `finance()` (`dashboard.finance.view`-gated).
- **KPIs (SRS 327–342):** monthly revenue, expenses, gross profit, gross margin %, net profit
  estimate, unbilled revenue, accounts receivable, overdue invoices, collected vs pending
  payments, expense by category, profit by job/client/service line.
- **Reports (SRS 1320–1337):** revenue by client/service-line/month; expense by
  category/job/department; profit by job/client/service-line; receivables aging; unbilled
  work; VAT report; cash collection; overdue invoices.
- **Filters:** date range, client, service line, region, status (SRS 376); KPI cards link to
  the underlying report. Reuse `charts.tsx`.
- **Tests:** KPI aggregation against seeded fixtures.

---

## 6. Cross-cutting

- **Approval workflow** is the same Draft→Submitted/Sent→Approved/Rejected shape across
  estimates, invoices, daily reports, timesheets, expenses — build one reusable service helper
  + audit pattern.
- **Status side-effects:** centralize finance transitions and preconditions in
  `job-status.constants.ts` / jobs service; payments/invoices call into it rather than setting
  `Job.status` directly.
- **Critical finance alerts (SRS 2170–2185)** via the notifications module: cost over budget,
  margin below target, PO nearly consumed, invoice exceeds PO, invoice overdue, completed job
  not invoiced, expense missing category/allocation, client payment delayed.
- **Testing:** mirror Phase-1 conventions — backend unit (mocked Prisma) + e2e (real DB,
  throttler overridden) per module; frontend vitest for new calc/format helpers.
- **Seed:** add the new permissions, grant per §3, and seed a sample contract rate card +
  estimate so the flow demos with data.

---

## 7. Out of scope for Phase 2 (→ Phase 3)

- Live **ZATCA/Fatoora** submission, cryptographic stamping, e-invoice clearance (Phase 2
  only prepares the fields).
- Credit / debit note **workflows** beyond the data model.
- **Inventory-driven** material costing (manual material expenses/lines only in Phase 2).
- Maintenance management, procurement, inventory modules.
- **Excel/PDF export** of dashboards (on-screen + per-quotation/invoice PDF only in Phase 2).
