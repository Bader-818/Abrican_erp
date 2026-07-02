# Abrican ERP — System Overview

_Last updated: 2026-07-02. A **factual reference** of what the system actually contains today,
grounded in the code (not aspirations). Every "exists" claim below traces to a real file,
route, model, or enum. For status/roadmap and what's **not** built, see
[PROJECT-STATUS.md](PROJECT-STATUS.md). Companion docs: [ARCHITECTURE.md](../ARCHITECTURE.md),
[PHASE2.md](../PHASE2.md), [docs/audit/](audit/)._

> Numbers in this document were verified by direct count on 2026-07-02:
> **48 permissions · 10 roles · 29 Prisma models · 27 enums · 8 migrations ·
> 177 backend unit tests (29 files) · 24 e2e test blocks (3 files) · 25 frontend tests (4 files)**.

---

## 1. Purpose & shape
Abrican ERP is an **operations-to-finance ERP** for a Saudi Aramco contractor (oil & gas /
industrial services). It is a **modular monolith**:

- **Backend:** NestJS 11 + Prisma 5 + PostgreSQL 16. One deployable process, ~23 feature
  modules registered in [app.module.ts](../backend/src/app.module.ts).
- **Frontend:** React 19 + Vite + TypeScript, TanStack Query + TanStack Table, Tailwind +
  Radix/shadcn components.
- **Sidecars:** Gotenberg (HTML→PDF), local file storage (swappable interface).
- **Dev/infra:** Docker Compose (dev + prod compose files), GitHub CI workflow, a Supabase
  UAT database (synthetic data only).

The domain centres on the **Job lifecycle**: a job is created (often from an approved
estimate), resourced via assignments, executed (daily reports, timesheets, expenses), then
invoiced and paid.

---

## 2. Backend module map
All routes are under the global prefix `/api/v1`. Access is gated by
`@RequirePermissions(...)` on controllers/handlers (see §4).

| Module | Route base | What it does |
|---|---|---|
| **auth** | `/auth` | Login, logout, logout-all, refresh (rotating), change-password, MFA setup/enable/disable, session list/revoke, `GET me` |
| **users** | `/users` | User CRUD, admin reset-password, disable-MFA, force logout-all |
| **roles** | `/roles` | Role CRUD, permission catalog (`GET permissions`) |
| **audit-log** | `/audit-logs` | Read-only paginated audit query |
| **health** | `/health` | Public health check |
| **clients** | `/clients` | Client master data + contacts sub-resource |
| **contracts** | `/contracts` | Contracts + **rate-cards** sub-resource (pricing) |
| **purchase-orders** | `/purchase-orders` | PO tracking against contracts (consumed vs. value) |
| **jobs** | `/jobs` | Job CRUD + `POST :id/status` (state machine) |
| **employees** | `/employees` | Employee records + cost rate |
| **crews** | `/crews` | Crews + members sub-resource |
| **vehicles** | `/vehicles` | Fleet (plate EN/AR, class, expiries) |
| **equipment** | `/equipment` | Equipment inventory + maintenance/calibration dates |
| **assignments** | `/assignments` | Scheduling, conflict detection, bulk create, utilization |
| **documents** | `/documents` | Polymorphic document upload + expiry, download |
| **estimates** | `/estimates` | Quotations, approval, PDF, convert→job |
| **invoices** | `/invoices` | Invoicing from actuals, approval, issue, PDF, from-estimate |
| **payments** | `/payments` | Payment recording, receivables **aging** |
| **daily-reports** | `/daily-reports` | Field daily reports + submit/approve/reject |
| **timesheets** | `/timesheets` | Hours (regular/OT/standby/travel) + approval |
| **expenses** | `/expenses` | Expense claims, receipts, approve/post, **reimbursement** |
| **dashboard** | `/dashboard` | `operations` + `assets` KPI aggregations |
| **notifications** | `/notifications` | User notifications, unread-count, mark-read |

Infrastructure modules (not user-facing features): **prisma** (ORM provider), **storage**
(`IStorageService`), **pdf** (Gotenberg client).

---

## 3. Frontend map
Router: [App.tsx](../frontend/src/App.tsx) (React Router v6, nested layouts, per-route
`permission` guard). 21 page folders under [frontend/src/pages/](../frontend/src/pages/); a
matching API layer of 23 modules under [frontend/src/api/](../frontend/src/api/).

| Area | Route(s) | Screen does |
|---|---|---|
| Login / forced password change | `/login`, forced-change flow | Email+password, TOTP, must-change-password |
| Dashboard | `/dashboard` | Job/assignment KPIs, status donut, utilization, expiry warnings |
| Clients | `/clients`, `/clients/:id` | CRUD + contacts |
| Contracts | `/contracts`, `/contracts/:id` | CRUD + rate cards, value vs. consumed |
| Purchase orders | `/purchase-orders` | Issue POs, consumed vs. remaining |
| Jobs | `/jobs`, `/jobs/:id` | CRUD, status change, status history |
| Scheduling | `/scheduling` | Assignments (shift presets, bulk, conflict) + utilization tab |
| Employees / Crews | `/resources/employees`, `/resources/crews(/:id)` | Staff + teams |
| Vehicles / Equipment | `/resources/vehicles`, `/resources/equipment` | Fleet + assets, expiries |
| Estimates | `/estimates`, `/estimates/:id` | Quote from rate cards, approve, convert |
| Invoices / Receivables | `/invoices`, `/invoices/:id`, `/receivables` | Invoice + payments + aging |
| Expenses / Reimbursements | `/expenses`, `/expenses/:id`, `/reimbursements` | Claims + reimbursement worklist |
| Daily reports | `/daily-reports(/:id)` | Field reports + approval |
| Timesheets | `/timesheets` | Hours + approval |
| Documents | `/documents` | Upload + expiry tracking |
| Notifications | `/notifications` | In-app notifications |
| Admin | `/admin/users`, `/admin/roles` | Users + roles/permissions |
| Settings | `/settings/security` | Change password, session list, logout-all |
| Audit logs | `/audit-logs` | System action log |

**Data/state:** TanStack Query (`retry: 1`, no refetch-on-focus); no Redux/Zustand.
Auth via [AuthContext](../frontend/src/context/AuthContext.tsx) exposing `hasPermission` /
`hasAnyPermission`. **Shared components:** `DataTable`, `Pagination`, `PageHeader`,
`StatusBadge`, `ConfirmDialog`, `RejectDialog`, `EmptyState`, charts (`Donut`,
`BarBreakdown`, `UtilizationBar`), plus Radix-based `ui/` primitives. Forms use
react-hook-form.

`StatusBadge` maps ~40 statuses to tones — success (ACTIVE, PAID, COMPLETED, APPROVED,
CONVERTED, COMPENSATED, POSTED…), warning (PLANNED, SCHEDULED, ON_HOLD, PARTIALLY_PAID,
EXPIRING_30/60/90, COSTING_REVIEW, READY_FOR_INVOICE, INVOICED, PENDING, SUBMITTED…), danger
(EXPIRED, TERMINATED, OUT_OF_SERVICE, REJECTED, OVERDUE, DECLINED, HEAVY…), neutral (DRAFT,
CLOSED, CANCELLED, INACTIVE), outline (NO_EXPIRY, NOT_APPLICABLE, LIGHT).

---

## 4. Authentication, sessions & RBAC
**Auth** ([auth.service.ts](../backend/src/auth/auth.service.ts),
[account.service.ts](../backend/src/auth/account.service.ts)):
- **JWT access token** (`{ sub: userId }`), expiry `JWT_ACCESS_EXPIRES_IN` (default 15m).
- **Rotating refresh token** — opaque `{uuid}.{secret}`, stored as SHA-256 hash; rotated on
  every refresh; **reuse detection** revokes all sessions + raises a security notification.
  Delivered in an httpOnly cookie scoped to `/api/v1/auth`.
- **Account lockout** — 5 failed attempts → 15-minute lock (checked before password compare).
- **TOTP MFA** (`otplib`, issuer "Abrican ERP") — setup → enable → disable flow; QR enrol.
- **Force password change** — `mustChangePassword` blocks all but whitelisted routes.

**Global guards** (order in [app.module.ts](../backend/src/app.module.ts)):
`JwtAuthGuard` → `PermissionsGuard` → `MustChangePasswordGuard` → `ThrottlerGuard`
(120 req/60s global; login throttled tighter).

**RBAC** — permissions are declared with
[`@RequirePermissions`](../backend/src/common/decorators/require-permissions.decorator.ts)
(AND semantics). The catalog of **48 permission keys** and **10 roles** is seeded in
[seed.ts](../backend/prisma/seed.ts):

- **Permission domains:** `auth.me`; `users.*`, `roles.*`, `audit_logs.view`; `clients.*`,
  `contracts.*`, `purchase_orders.*`; `jobs.*` (incl. `status_change`, `status_override`);
  `employees.*`, `crews.*`, `vehicles.*`, `equipment.*`; `assignments.*` (incl. `override`);
  `documents.*`, `dashboard.operations.view`, `dashboard.assets.view`; `estimates.*`,
  `invoices.*`, `payments.*`, `daily_reports.*`, `timesheets.*`, `expenses.*` (finance domains
  carry `.view`/`.manage`/`.approve` as applicable).
- **Roles:** Admin (all), CEO/GM (broad view + `jobs.status_override`), Operations Manager,
  Finance Manager, Accountant, Field Supervisor, Maintenance Manager, HR/Admin Officer,
  Procurement Officer, Viewer/Auditor (read-only).

The [consistency-audit harness](../backend/scripts/audit/) cross-checks that every declared
permission is defined, granted to at least one role, and used consistently front↔back (RBAC
triangle) — currently **0 findings**.

---

## 5. Data model (Prisma)
[schema.prisma](../backend/prisma/schema.prisma): **29 models, 27 enums**. Money is stored as
Prisma `Decimal` (serialized as strings over JSON). Two models use a **polymorphic
"exactly-one FK" pattern enforced by DB check constraints** (migration
`20260611124454_add_polymorphic_check_constraints`): `JobAssignment` (employee/crew/vehicle/
equipment) and `Document` (employee/vehicle/equipment/contract/client).

**Models by group:**
- **Identity & access (5):** User, RefreshToken, Role, Permission, RolePermission.
- **Commercial (4):** Client, ClientContact, Contract, ContractRateCard.
- **Purchase orders (1):** PurchaseOrder.
- **Jobs (2):** Job, JobStatusHistory.
- **Resources (5):** Employee, Crew, CrewMember, Vehicle, Equipment.
- **Assignments (1):** JobAssignment.
- **Documents / audit / notifications (3):** Document, AuditLog, Notification.
- **Finance (8):** Estimate, EstimateLineItem, Invoice, InvoiceLineItem, Payment,
  DailyReport, Timesheet, Expense.

**Enums (27)** include the operational set (JobStatus, VehicleStatus, EquipmentStatus,
AssignmentStatus, ClientType, ContractStatus, PurchaseOrderStatus, AvailabilityStatus,
VehicleClass LIGHT/HEAVY, OwnershipType, …) and the finance set (EstimateStatus,
InvoiceStatus, LineKind, BillingUnit, PaymentMethod, ApprovalStatus, ExpenseCategory,
ReimbursementStatus). **AuditAction has 15 values**; **NotificationType has 8**
(JOB_ASSIGNED, RESOURCE_CONFLICT, DOCUMENT_EXPIRING, DOCUMENT_EXPIRED, CONTRACT_NEAR_EXPIRY,
PO_NEAR_EXPIRY, JOB_STATUS_CHANGED, GENERAL — **no finance-alert types**).

> **Fields that exist but are NOT wired to any logic yet** (pre-wired for S12 costing so it
> can be added without re-migrating): `Job.actualCost`, `Job.grossProfit`,
> `Job.grossMarginPct`, `Job.costReviewedAt`, `Job.costReviewedById`;
> `Estimate.estimatedCost`, `Estimate.estimatedMarginPct`; `EstimateLineItem.estimatedUnitCost`,
> `EstimateLineItem.lineCost`. Also placeholders: `Invoice.uuid` (ZATCA-ready) and
> `Invoice.zatcaStatus` (Phase-2 e-invoicing, not driven). Schema note on `Expense`:
> "no Department model yet; departmentId omitted."

---

## 6. Finance value chain
[line-math.ts](../backend/src/common/finance/line-math.ts) is the single money oracle:
`computeLine` (qty × hours × unitPrice, VAT, total), `sumTotals`, `round2`, and
`DEFAULT_VAT_RATE = 15`.

Flow:
1. **Estimate** — priced from `ContractRateCard` lines (contract price is **authoritative
   server-side**: the card's unitPrice and VAT override any client-sent value) or custom
   lines; VAT is forced to the default rate. Bilingual PDF via Gotenberg. Approve → convert
   to a Job (copies estimate total to `jobValue`).
2. **Invoice** — built from actuals, 15% VAT, checks PO balance, renders a **ZATCA Phase-1
   QR** PDF, and on issue sets the job to `INVOICED`.
3. **Payment** — full/partial; drives `PARTIALLY_PAID`/`PAID`; feeds the **aging** report.

Job **finance** status is only advanced by
[`applyFinanceStatus`](../backend/src/jobs/job-status.service.ts) (system-event, **forward-only**
along `FINANCE_ORDER`, atomic in the caller's transaction) — never by ad-hoc writes.

---

## 7. Job lifecycle
State machine in [job-status.constants.ts](../backend/src/jobs/job-status.constants.ts),
enforced by [job-status.service.ts](../backend/src/jobs/job-status.service.ts). Two drivers:
user-initiated `changeStatus` (operational half, gated by `jobs.status_change`) and
event-driven `applyFinanceStatus` (finance half). Side effects: `→ACTIVE` requires ≥1
assignment (or an audited override) and stamps `actualStartDate`; status changes **cascade to
resource bookings** (`ASSIGNMENT_CASCADE`) so an ACTIVE job can't show PLANNED bookings; every
transition writes `JobStatusHistory` + an audit log. Full review:
[docs/audit/JOB-LIFECYCLE.md](audit/JOB-LIFECYCLE.md).

`COSTING_REVIEW` and `READY_FOR_INVOICE` are valid states but **nothing auto-drives them**
(S12 is not built) — they are manual-only today.

---

## 8. Cross-cutting services
- **Audit log** — 15 `AuditAction` types; mutating operations record old/new value, IP,
  user-agent. Coverage verified by `audit-coverage.mjs`.
- **Notifications** — 8 types; created by system events (e.g. token-reuse security alert).
- **PDF** — [pdf.service.ts](../backend/src/pdf/pdf.service.ts) posts HTML to Gotenberg;
  bilingual EN/AR financial documents, number-to-words, QR.
- **Storage** — [IStorageService](../backend/src/storage/storage.interface.ts) with a local-FS
  implementation (files under `STORAGE_ROOT`, served at `/files/...`); swappable for S3.
- **Consistency audit** — `npm run audit:consistency`
  ([scripts/audit/](../backend/scripts/audit/)): RBAC triangle, enum parity, Decimal parity,
  pagination guard, audit coverage → generates
  [docs/audit/CONSISTENCY-REPORT.md](audit/CONSISTENCY-REPORT.md). **0 findings.**

---

## 9. Quality & tests (verified counts)
- **Backend unit:** 177 tests across 29 `*.spec.ts` (finance line-math, job-status machine,
  auth/lockout/reuse, conflict detection, utilization, pagination, plus per-service specs).
- **E2E:** 24 test blocks across 3 files — `app.e2e-spec.ts` (15), `rbac.e2e-spec.ts` (5),
  `finance-flow.e2e-spec.ts` (4); run against a real Postgres.
- **Frontend:** 25 tests across 4 `*.test.ts` (formatters, api-error, job-status mirror,
  chart utilities). No component/browser tests.
- **Migrations (8):** `20260611124447_init`, `..._add_polymorphic_check_constraints`,
  `20260615114913_auth_hardening`, `20260617083930_phase2_finance`,
  `20260618084831_account_security`, `20260618093300_field_reports_timesheets`,
  `20260618114050_expenses`, `20260622102841_vehicle_fleet_fields`.
- **Pentest:** [docs/audit/PENTEST.md](audit/PENTEST.md) — no CRITICALs; 8 findings
  (P-01…P-08) currently open (config/hardening; see PROJECT-STATUS §5).

---

## 10. Environment & infrastructure
**Expected env vars** (`.env.example` at root + `backend/.env.example`): `DATABASE_URL`;
`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (+ expiries); `CORS_ORIGINS`; `STORAGE_ROOT`;
`ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`; `GOTENBERG_URL`; `NODE_ENV`; ports; frontend
`VITE_API_BASE_URL`. Prod adds `SEED_ON_START=false`, `HTTP_PORT`.

**Docker:** [docker-compose.yml](../docker-compose.yml) (dev: db, gotenberg, backend,
frontend) and [docker-compose.prod.yml](../docker-compose.prod.yml) (same-origin, internal
db/backend, published web port only). Multi-stage Dockerfiles for backend + frontend.

**CI:** `.github/workflows/ci.yml` — backend job (build + migrate + seed + unit + e2e +
`npm audit`) and frontend job (build + unit + audit). It exists but is **not currently gating**
merges on the repo.

**UAT DB:** a Supabase Postgres (session pooler, Sydney), migrated + seeded + Aramco contract
loaded — **synthetic data only**. See [UAT-SUPABASE.md](UAT-SUPABASE.md).

---

_For everything that is planned, deferred, or intentionally not built — and the candid risk
list — see [PROJECT-STATUS.md](PROJECT-STATUS.md)._
