# Abrican ERP — System Architecture

A practical, human-readable guide to how this system is built. It's meant to be
enough that someone new (or you, months from now) can understand the whole thing
without reading every file.

> Companion docs: [README.md](README.md) (quick start) · [DEPLOYMENT.md](DEPLOYMENT.md) (going live).
> The product requirements live in [abrican_erp_srs_full_prompt.md](abrican_erp_srs_full_prompt.md).

## Contents
1. [What it is](#1-what-it-is)
2. [Technology stack](#2-technology-stack)
3. [Big picture](#3-big-picture)
4. [Repository layout](#4-repository-layout)
5. [Backend architecture](#5-backend-architecture)
6. [Request lifecycle](#6-request-lifecycle)
7. [Data model](#7-data-model)
8. [Roles & permissions (RBAC)](#8-roles--permissions-rbac)
9. [Authentication & session management](#9-authentication--session-management)
10. [Security model](#10-security-model)
11. [Feature modules](#11-feature-modules)
12. [Frontend architecture](#12-frontend-architecture)
13. [File storage](#13-file-storage)
14. [Audit logging](#14-audit-logging)
15. [Testing strategy](#15-testing-strategy)
16. [Running & deploying](#16-running--deploying)
17. [Continuous integration](#17-continuous-integration)
18. [Known limitations & future work](#18-known-limitations--future-work)

---

## 1. What it is

Abrican ERP is an operations-to-finance system for an oil & gas /
industrial-services company. It manages the full operational core: **clients →
contracts → purchase orders → jobs → resource scheduling → documents/compliance**,
plus the front of the finance flow: **estimate/quotation → invoice → payment**,
with role-based access, audit logging, and dashboards.

**Phase 1** ("Foundation + full operational core") is complete. **Phase 2**
(finance) is in progress: the priority flow — **S7 Estimation & Quotation,
S8 Invoicing, S9 Payments & Receivables** — is built and live (with bilingual
ZATCA-ready PDFs), as are **S10 Daily Reports & Timesheets** and **S11 Expenses**
(categories, multi-allocation, receipts, approval/posting, and a per-employee
reimbursement worklist). The remaining Phase-2 sprints — S12 job costing & profit,
S13 finance dashboard — are planned in [PHASE2.md](PHASE2.md). Profit fields exist
in the schema (nullable, populated by S12).

## 2. Technology stack

| Layer | Choice |
|---|---|
| Backend | NestJS 11 (modular monolith), TypeScript |
| ORM / DB | Prisma 5 + PostgreSQL 16 |
| Auth | JWT access tokens + rotating refresh tokens (Passport JWT) |
| Frontend | React 19 + Vite + TypeScript (SPA) |
| Data fetching | TanStack Query v5; tables via TanStack Table v8 |
| Forms | React Hook Form + Zod |
| UI | Tailwind CSS v4 + Radix primitives (shadcn-style), lucide icons, sonner toasts |
| Charts | Hand-rolled SVG/CSS (no chart library) |
| PDFs | Bilingual HTML/CSS template → PDF via a **Gotenberg** sidecar (headless Chromium); `qrcode` for the ZATCA QR |
| Packaging | Docker + Docker Compose (dev and prod compose files) |
| Tests | Jest + Supertest (backend), Vitest (frontend) |

**Design principle:** a *modular monolith* — one deployable backend, but cleanly
separated feature modules. Easy to run and reason about now; individual modules
could be peeled into services later if ever needed.

## 3. Big picture

Development (two dev servers, separate origins):

```
Browser ──▶ Vite dev server :5173 ──▶ (axios) ──▶ NestJS API :3000 ──▶ Postgres :5434
                                                        │
                                                        └──▶ Gotenberg (HTML→PDF, internal)
```

Production (same-origin behind one web server — see DEPLOYMENT.md):

```
            ┌───────────────────────── server ─────────────────────────┐
 Browser ──▶│ TLS proxy ─▶ nginx :80 ─┬─▶ SPA static files               │
  (https)   │                         └─▶ /api ─▶ NestJS backend ─┬─▶ Postgres
            │                                                     └─▶ Gotenberg
            └───────────────────────────────────────────────────────────┘
```

The **Gotenberg** container is an internal sidecar (never published) that the
backend calls over the Docker network to turn HTML invoices/quotations into PDFs.

Same-origin in production matters: it keeps the `SameSite=Lax` refresh-token
cookie working without cross-site complications.

## 4. Repository layout

```
abrican-erp-system/
├── backend/                  NestJS API
│   ├── src/
│   │   ├── main.ts           Bootstrap (helmet, CORS, global prefix /api/v1, validation)
│   │   ├── app.module.ts     Wires every feature module + global guards/filters
│   │   ├── common/           Cross-cutting: guards, interceptors, decorators, dtos, helpers, validators
│   │   ├── prisma/           PrismaService + module
│   │   ├── storage/          File storage abstraction (IStorageService)
│   │   ├── auth/             Login, refresh, logout, JWT strategy
│   │   ├── users/ roles/     Identity & RBAC management
│   │   ├── audit-log/        Audit trail (global interceptor + query API)
│   │   ├── notifications/
│   │   ├── clients/ contracts/ purchase-orders/    Commercial
│   │   ├── jobs/             Jobs + status state machine
│   │   ├── employees/ crews/ vehicles/ equipment/  Resources
│   │   ├── assignments/      Scheduling, conflict detection, utilization
│   │   ├── documents/        Uploads + expiry tracking
│   │   ├── estimates/        Quotations: pricing, lifecycle, → job conversion (Phase 2 S7)
│   │   ├── invoices/         Invoicing from estimates, approval/issue, PO check (Phase 2 S8)
│   │   ├── payments/         Payments + receivables aging (Phase 2 S9)
│   │   ├── daily-reports/    Field daily reports + approval workflow (Phase 2 S10)
│   │   ├── timesheets/       Labour hours + approval workflow (Phase 2 S10)
│   │   ├── expenses/         Expenses: categories, receipts, posting, reimbursements (Phase 2 S11)
│   │   ├── pdf/              PdfService (HTML→Gotenberg), company.config, unit-label, assets/
│   │   └── dashboard/        Aggregations for the home dashboards
│   ├── prisma/
│   │   ├── schema.prisma     Single source of truth for the data model
│   │   ├── migrations/       Versioned SQL migrations
│   │   └── seed.ts           Idempotent seed (RBAC + admin + demo data)
│   ├── test/                 End-to-end (supertest) suite
│   ├── Dockerfile            Multi-stage: development | build | production
│   └── docker-entrypoint.sh  Runs migrate deploy + seed, then starts the app
├── frontend/                 React SPA
│   ├── src/
│   │   ├── api/              One axios module per backend resource
│   │   ├── components/       Reusable UI (DataTable, charts, dialogs, ui/* primitives)
│   │   ├── context/          AuthContext (session state)
│   │   ├── layout/           AppLayout, Sidebar, Topbar, ProtectedRoute, nav-items
│   │   ├── pages/            One folder per feature area
│   │   ├── lib/              formatters, api-error, job-status mirror, utils
│   │   └── types/            Shared TypeScript types (mirror the API)
│   ├── nginx.conf            Production: serve SPA + proxy /api → backend
│   └── Dockerfile            Multi-stage: development | build | production(nginx)
├── docker-compose.yml        Local development stack (db, backend, frontend, gotenberg)
├── docker-compose.prod.yml   Production stack (same-origin, internal-only db/backend)
├── .github/workflows/ci.yml  CI: build + tests + audit
├── ARCHITECTURE.md           (this file)
├── PHASE2.md                 Phase 2 (finance) roadmap — S7–S13
├── DEPLOYMENT.md             How to deploy
└── README.md                 Quick start
```

## 5. Backend architecture

Each feature is a **NestJS module** with the same shape:

- **Controller** — HTTP routes; declares required permissions and audit metadata.
- **Service** — business logic; talks to Prisma.
- **DTOs** — request validation (class-validator) + typing.

Cross-cutting concerns live in `src/common/` and are applied **globally** so
individual modules stay focused:

| Concern | Where | What it does |
|---|---|---|
| Auth (is the caller logged in?) | `common/guards/jwt-auth.guard.ts` (global) | Validates the JWT on every route unless `@Public()` |
| Authorization (may they do this?) | `common/guards/permissions.guard.ts` (global) | Enforces `@RequirePermissions(...)` |
| Rate limiting | `@nestjs/throttler` (global) | Caps requests; login is tightened to 5/min |
| Input validation | `ValidationPipe` in `main.ts` (global) | `whitelist` + `forbidNonWhitelisted` + transform |
| Audit logging | `common/interceptors/audit-log.interceptor.ts` (global) | Records CREATE/UPDATE/DELETE for `@AuditEntity(...)` routes |
| Error shape | `common/filters/http-exception.filter.ts` (global) | Consistent JSON error responses |
| Pagination | `common/helpers/pagination.helper.ts` | `paginate(delegate, query, args)` → `{ data, total, page, pageSize, totalPages }` |

Useful decorators: `@Public()`, `@RequirePermissions('x.y')`, `@CurrentUser()`,
`@AuditEntity({ entityType, prismaModel })`, `@IsStrongPassword()`.

The API is served under the `/api/v1` prefix. Swagger docs are exposed at
`/api/docs`.

## 6. Request lifecycle

A typical authenticated call, e.g. `GET /api/v1/clients`:

1. **Throttler guard** — within rate limits?
2. **JWT auth guard** — verifies the `Authorization: Bearer <token>`, then loads
   the user (with role + permissions) fresh from the DB and attaches it as the
   request user. Rejects inactive/unknown users.
3. **Permissions guard** — does the user's permission set include the route's
   `@RequirePermissions` (e.g. `clients.view`)?
4. **Validation pipe** — query/body validated and transformed into the DTO.
5. **Controller → service** — business logic + Prisma query (usually paginated).
6. **Audit interceptor** — for mutating routes marked `@AuditEntity`, writes an
   audit row after success.
7. **Exception filter** — any thrown error becomes a consistent JSON response.

Key consequence of step 2: **permissions are always read live from the DB**, not
baked into the token — role changes take effect on the next request.

## 7. Data model

Defined in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). UUID
primary keys throughout. Main entities and how they relate:

```
User ─┬─ RefreshToken (sessions)
      └─ Role ── RolePermission ── Permission        (RBAC)

Client ─┬─ ClientContact
        ├─ Contract ── ContractRateCard ◀───────────┐ (rate lookup)
        ├─ PurchaseOrder ◀────────────────────────┐ │
        ├─ Job ─┬─ JobStatusHistory                │ │
        │       └─ JobAssignment ──▶ Employee | Crew | Vehicle | Equipment
        │                                          │ │
        ├─ Estimate ── EstimateLineItem ───────────┼─┘  (Phase 2 S7)
        │     │  (APPROVED → converts to a Job)     │
        │     └──▶ Job                              │
        ├─ Invoice ── InvoiceLineItem ─────────────┘    (Phase 2 S8)
        │     │  links: Estimate, Contract, PurchaseOrder, Job
        │     └─ Payment ◀── (Phase 2 S9)
        └─ Payment

Crew ── CrewMember ──▶ Employee

Document ──▶ Employee | Vehicle | Equipment | Contract | Client | (company-wide)

AuditLog, Notification        (cross-cutting)
```

Notes:
- **Money** is `Decimal(14,2)`; the API returns decimals as strings (handled by
  the frontend `formatCurrency`).
- **Polymorphic links** (`JobAssignment`, `Document`) use one nullable FK per
  possible target plus a discriminator column; DB check constraints enforce that
  exactly one is set (migration `add_polymorphic_check_constraints`).
- **Finance entities (Phase 2, migration `phase2_finance`):**
  - `Estimate` + `EstimateLineItem` — a priced quotation; a line is
    `quantity × hours × unitPrice` (+ per-line VAT). Status
    `DRAFT → SENT → APPROVED → CONVERTED` (or `REJECTED`/`EXPIRED`); converting
    creates a `Job` and copies the quoted total into `Job.jobValue`.
  - `Invoice` + `InvoiceLineItem` — created from an approved estimate (lines
    copied as editable actuals) or standalone; status
    `DRAFT → PENDING_APPROVAL → APPROVED → SUBMITTED → PARTIALLY_PAID/PAID`
    (or `OVERDUE`/`CANCELLED`); carries a `uuid` + sequential `invoiceNumber`
    for ZATCA readiness, and a snapshot of client VAT/billing address.
  - `Payment` — full/partial payments against an invoice; recomputes
    `paidAmount`/`outstandingAmount` and advances both invoice and job status.
  - Enums added: `EstimateStatus`, `InvoiceStatus`, `LineKind`, `BillingUnit`,
    `PaymentMethod`.
  - **Profit fields** on `Job` (`actualCost`, `grossProfit`, `grossMarginPct`,
    `costReviewedAt/By`) and on `Estimate`/`EstimateLineItem`
    (`estimatedCost`, `estimatedUnitCost`, `lineCost`) exist now but are
    **nullable and unpopulated** — they're filled by S12 (job costing). This is
    how "account for profit later" is pre-wired without a future migration.
- Migrations are versioned in `prisma/migrations/`; never edit applied ones —
  add a new migration.

## 8. Roles & permissions (RBAC)

Authorization is **permission-based**, not role-name-based:

- A **Permission** is a string key like `clients.view`, `jobs.manage`,
  `assignments.override`, `documents.manage`, `dashboard.operations.view`. The
  finance set (Phase 2) adds `estimates.{view,manage,approve}`,
  `invoices.{view,manage,approve}`, `payments.{view,manage}`, and
  `dashboard.finance.view`.
- A **Role** is a named bundle of permissions (Admin, CEO/GM, Operations Manager,
  Finance Manager, Accountant, Field Supervisor, Maintenance Manager, HR/Admin
  Officer, Procurement Officer, Viewer/Auditor) — seeded in `seed.ts`. Finance
  permissions are granted to Admin, CEO/GM, Finance Manager, Accountant, and
  (estimates/invoices view + estimate manage) Operations Manager.
- Routes declare what they need with `@RequirePermissions('clients.view')`; the
  global permissions guard checks the caller's live permission set.
- The frontend mirrors this: `useAuth().hasPermission(...)` hides/disables UI,
  and `ProtectedRoute permission="..."` guards pages. **The frontend checks are
  UX only — the backend is the real boundary.**

## 9. Authentication & session management

Two-token model:

| | Access token | Refresh token |
|---|---|---|
| Type | Stateless **JWT** (`{ sub: userId }`) | Opaque `id.secret`, stored server-side |
| Lifetime | ~15 min | ~7 days |
| Browser storage | **In memory** (JS variable) | **httpOnly cookie**, path `/api/v1/auth` |
| Sent as | `Authorization: Bearer …` | Cookie (auth routes only) |

**Login** (`POST /auth/login`): bcrypt-verifies the password (user must be
`ACTIVE`), issues both tokens, audits `LOGIN`. Refresh token goes in the cookie;
access token + minimal user info in the body. Rate-limited to 5/min.

**Authenticating requests:** the JWT strategy verifies signature + expiry, then
re-loads the user with role & permissions from the DB (rejects inactive users).

**Refresh tokens — "selector.validator" + rotation:** the token is
`<uuid>.<32-random-bytes>`. The DB stores only `sha256(secret)`. On refresh the
record is found by id, the secret is compared in **constant time**, the used
token is **revoked and a fresh one issued** (single-use rotation). The 7-day
window slides forward while the user stays active.

**Frontend auto-refresh** ([`frontend/src/api/client.ts`](frontend/src/api/client.ts)):
an axios response interceptor catches `401`, calls `/auth/refresh` once (shared
single-flight promise so concurrent 401s don't stampede), retries the original
request, and on failure clears the session and redirects to `/login`. The access
token lives only in memory, so a page reload restores the session from the cookie.

**Logout** revokes the current refresh token + clears the cookie.
**Logout-all** (`POST /auth/logout-all`, "Sign out of all sessions") revokes the
user's entire token family.

## 10. Security model

What's in place, and where:

- **Passwords:** bcrypt-hashed. New passwords must pass a policy
  ([`common/validators/is-strong-password.validator.ts`](backend/src/common/validators/is-strong-password.validator.ts)):
  12–128 chars, at least 3 of {lower, upper, digit, symbol}, plus a
  common-password denylist. Mirrored in the frontend form for UX.
- **Brute-force defense:** IP rate limiting on login (5/min) **and** per-account
  lockout — 5 consecutive failures lock the account for 15 minutes
  (`User.failedLoginAttempts` / `lockedUntil`).
- **Refresh-token theft defense:** rotation makes tokens single-use, and
  **reuse detection** — replaying an already-revoked token revokes the whole
  family and records a `TOKEN_REUSE_DETECTED` audit event.
- **Cookies:** `httpOnly` (no JS access), `SameSite=Lax` (CSRF mitigation),
  `Secure` in production (HTTPS only), scoped to `/api/v1/auth`.
- **Transport/headers:** `helmet` (HSTS, etc.) on the API; HTTPS via a reverse
  proxy in production.
- **Input validation:** global `ValidationPipe` rejects unknown fields and
  coerces types.
- **Least privilege:** permission-based RBAC, fail-closed default guard (every
  route protected unless `@Public()`).
- **Audit trail:** auth events, data mutations, status changes, scheduling
  overrides, and token-reuse events are all recorded.

Trade-offs worth knowing: access tokens are stateless, so revoking a session
doesn't kill an already-issued access token until it expires (≤15 min window);
there's no MFA or password-reset flow yet (both need an email/SMS provider).

## 11. Feature modules

| Area | Endpoints (base) | Highlights |
|---|---|---|
| **Clients** | `/clients` | CRUD + nested contacts; types, VAT/CR, payment terms |
| **Contracts** | `/contracts` | Rate cards; computed `remainingValue`; start/end validation |
| **Purchase Orders** | `/purchase-orders` | Linked to client/contract; consumed vs remaining |
| **Jobs** | `/jobs` | Auto job codes; **status state machine** (`jobs/job-status.constants.ts`) with allowed transitions and audited status changes |
| **Resources** | `/employees` `/crews` `/vehicles` `/equipment` | Crews have members; availability/status tracking |
| **Scheduling** | `/assignments` | Polymorphic assignments; **conflict detection** (overlapping bookings → 409 unless an authorized `overrideReason` is given, which is audited); **utilization** report (assigned hours vs weekday×8h capacity); `check-conflicts` preview |
| **Documents** | `/documents` | Multipart upload via the storage abstraction; **auth-gated streaming download**; computed expiry status (Valid / Expiring 30/60/90 / Expired / No-expiry); filters |
| **Estimates** *(Phase 2 S7)* | `/estimates` | Priced quotations (`quantity × hours × unitPrice` + VAT); sequential `EST-YYYY-####`; lifecycle send/approve/reject; **`/convert`** creates a Job and copies the total to `jobValue`; **quotation PDF** at `/:id/pdf` |
| **Invoices** *(Phase 2 S8)* | `/invoices` | **`/from-estimate`** copies estimate lines as editable actuals; approval workflow `submit-for-approval → approve → issue`; **issue** validates client VAT + PO remaining balance (overridable with `invoices.approve`), consumes the PO, advances the job to `INVOICED`, snapshots the **tax-invoice PDF** to storage; AR list filters incl. `overdue` |
| **Payments** *(Phase 2 S9)* | `/payments` | Full/partial payments; recomputes invoice paid/outstanding and flips it to `PARTIALLY_PAID`/`PAID` and the job to match (atomic); **`/aging`** receivables report bucketed 0–30 / 31–60 / 61–90 / 90+ |
| **Daily reports / Timesheets** *(Phase 2 S10)* | `/daily-reports` `/timesheets` | Field reports & labour hours with a shared `DRAFT → SUBMITTED → APPROVED/REJECTED` approval workflow; approved records lock; timesheets track regular/overtime/standby/travel hours; feed S12 costing |
| **Expenses** *(Phase 2 S11)* | `/expenses` | Direct/overhead costs (12 categories); auto-15% VAT; optional job/vehicle/equipment/employee allocation with an `unallocated` flag; **receipt** upload/stream (`/:id/receipt`); `DRAFT → SUBMITTED → APPROVED → POSTED` workflow with a **hard self-approval block** (SRS 168); posted expenses feed S12 costing; **reimbursement** track — approving a reimbursable expense → `PENDING`, then `/:id/reimburse` marks Compensated/Delayed/Declined; **`/reimbursements/summary`** groups owings per employee |
| **Dashboard** | `/dashboard/operations`, `/dashboard/assets` | Server-side aggregations: jobs/assignments by status, contracts/POs near expiry, resource counts, document compliance, top resource utilization |
| **Admin** | `/users` `/roles` `/audit-logs` | Identity, RBAC management, audit search |
| **Notifications** | `/notifications` | Per-user notifications + unread count |

The **job status state machine** is the most business-specific piece: jobs move
through DRAFT → PLANNED → APPROVED → SCHEDULED → ACTIVE → COMPLETED → … with only
explicit transitions allowed; activating a job without resource assignments
requires a permissioned override. The same transition map is mirrored on the
frontend (`lib/job-status.ts`) for the UI.

**Finance flow & job-status side-effects.** The estimate→invoice→payment chain
drives the financial half of the job lifecycle automatically. Issuing an invoice
advances the linked job to `INVOICED`; recording payments advances it to
`PARTIALLY_PAID` then `PAID`. These transitions are applied by
`JobStatusService.applyFinanceStatus()` (exported from `JobsModule`,
forward-only — never moves a job backward, and requires the job to be at least
`COMPLETED`). It runs inside the invoice/payment DB transaction so the job status,
invoice totals, and PO consumption commit atomically.

### PDF generation (quotations & invoices)

Quotations and tax invoices are produced by [`pdf/pdf.service.ts`](backend/src/pdf/pdf.service.ts)
behind a single seam — `renderFinancialDocument(doc): Promise<Buffer>` — so the
template or engine can change without touching estimates/invoices:

- **Engine:** `PdfService` builds a **bilingual (Arabic/English) HTML/CSS**
  document and POSTs it to the **Gotenberg** sidecar
  (`/forms/chromium/convert/html`) via Node's global `fetch`/`FormData` (no extra
  HTTP dependency). Gotenberg (headless Chromium) handles Arabic shaping & RTL
  natively; Arabic fonts come from a Google Fonts `<link>`.
- **Seller profile** (name EN/AR, CR, VAT, structured address, bank details,
  footer, logo) lives in [`pdf/company.config.ts`](backend/src/pdf/company.config.ts)
  (env-overridable defaults). The logo is embedded as base64 from
  `pdf/assets/`. Unit codes (MH / EH / VAL) come from `pdf/unit-label.ts`.
- **ZATCA QR (Phase 1 / "generation"):** `buildZatcaQr()` encodes the 5 required
  fields — seller name, VAT number, ISO timestamp, total (incl. VAT), VAT total —
  as a Base64 **TLV** and renders it with `qrcode`, embedded on tax invoices
  only. The Phase-2 cryptographic stamp (tags 6–9), certificate onboarding, UBL
  XML signing, and live Clearance/Reporting API are **not** done (Phase 3).
- **Delivery:** `GET /estimates/:id/pdf` and `GET /invoices/:id/pdf` render
  on-demand and stream the buffer (`StreamableFile`); issuing an invoice also
  snapshots its PDF to storage (`pdfUrl`). The frontend fetches these as a Blob
  (`api` with `responseType: 'blob'`) and opens them via `lib/open-blob.ts`.

## 12. Frontend architecture

- **Routing** (`App.tsx`): React Router v6. A `ProtectedRoute` wraps the
  authenticated area inside `AppLayout` (sidebar + topbar) and can require a
  specific permission per route. The sidebar (`layout/nav-items.ts`) groups
  links into sections: General, Operations, **Finance** (Estimates / Invoices /
  Receivables), Commercial, Resources, Administration — each item permission-gated.
- **Finance pages** (`pages/estimates`, `pages/invoices`): list + detail +
  dialogs. Estimates have a dynamic line-item builder (local state, live totals)
  and lifecycle actions; invoices have the approval/issue workflow, a
  record-payment dialog, and a Receivables (aging) page. PDFs open via
  `lib/open-blob.ts`.
- **Session** (`context/AuthContext.tsx`): holds the current user, exposes
  `login` / `logout` / `logoutAll` / `hasPermission`. On load it tries
  `/auth/refresh` to restore a session from the cookie.
- **API layer** (`src/api/*`): one small module per resource, all using a shared
  axios instance ([`api/client.ts`](frontend/src/api/client.ts)) that injects the
  Bearer token and handles 401-refresh.
- **Server state**: TanStack Query (caching, invalidation on mutations). Tables
  use TanStack Table via a reusable `DataTable`.
- **Forms**: React Hook Form + Zod schemas (which mirror backend validation).
- **Charts** ([`components/charts.tsx`](frontend/src/components/charts.tsx)):
  donuts, proportional bars, utilization bars — hand-rolled SVG/CSS, with a
  shared `statusTone` color map so chart colors match status badges everywhere.
- **Branding**: a shared `components/Logo.tsx` (imports `assets/abrican-logo.png`)
  renders the Abrican mark in the sidebar, mobile topbar, and login screen.
- **Config**: `VITE_API_BASE_URL` sets the API base. Dev uses
  `http://localhost:3000/api/v1`; the production build bakes in `/api/v1`
  (same-origin via nginx).

> The UI is **desktop-first** by design. It works on phones (there's a mobile
> menu) but data tables aren't optimized for small screens.

## 13. File storage

Uploads go through an abstraction, [`storage/storage.interface.ts`](backend/src/storage/storage.interface.ts)
(`IStorageService`: `save` / `getPath` / `delete`). The current implementation
writes to the local filesystem under `STORAGE_ROOT` (a Docker volume in
production) and serves files through an **authenticated** download endpoint
(not a public static path). To move to S3/GCS later, implement the same
interface — no calling code changes. Issued-invoice PDF snapshots are stored
through this same abstraction (under `invoices/`).

## 14. Audit logging

A global interceptor records mutations on routes annotated with `@AuditEntity`,
and services record domain events directly (login/logout, job status changes,
scheduling overrides, token-reuse). Each `AuditLog` row captures who, what
action, which entity, before/after values, IP, and a comment. Sensitive fields
(`passwordHash`, `tokenHash`) are stripped before storage. Searchable at
`/audit-logs` (permission-gated).

## 15. Testing strategy

A test pyramid, runnable locally and in CI:

| Level | Tool | Scope | Count |
|---|---|---|---|
| **Unit** (backend) | Jest (mocked Prisma, no DB) | Pure logic: password policy, account lockout, refresh reuse, conflict detection, utilization math, doc-status, pagination, job-status machine, dashboard aggregation, **finance line-math, estimates, invoices (issue/PO check), payments (status + aging)** | 86 |
| **Unit** (frontend) | Vitest | Helpers: formatters, api-error, job-status mirror, chart utilities | 25 |
| **End-to-end** (backend) | Jest + Supertest (real Postgres) | Boots the whole app: auth, RBAC, CRUD lists, conflict override, password policy, lockout, logout-all + reuse | 22 |

Run them:
```bash
cd backend  && npx jest                       # unit
cd frontend && npm test                        # unit (vitest)
# e2e (needs the dev DB up on :5434):
cd backend && DATABASE_URL="postgresql://abrican:abrican_dev_password@localhost:5434/abrican_erp?schema=public" \
  JWT_ACCESS_SECRET=e2e JWT_REFRESH_SECRET=e2e npm run test:e2e
```
The e2e suite self-cleans the data it creates and disables rate limiting (via a
no-op throttler storage) so multi-login scenarios aren't throttled.

## 16. Running & deploying

**Local development:**
```bash
docker compose up --build
# Frontend   http://localhost:5173
# API        http://localhost:3000/api/v1   (Swagger at /api/docs)
# Postgres   host port 5434
# Gotenberg  internal only (HTML→PDF), reachable from the backend
# Login: admin@abrican.local / Admin@12345
```
The backend container runs migrations + an idempotent seed on start, then a
hot-reloading dev server. The seed has per-section guards, so re-running it is
safe.

> The backend's `node_modules` is a **container-only volume**, so run Prisma and
> dependency commands **inside the container**:
> - schema change → `docker compose exec backend npx prisma migrate dev --name <x>`
>   (or `npx prisma generate && docker compose restart backend`),
> - new dependency → `docker compose exec backend npm install <pkg>`.
> Also run `npx prisma generate` on the host once so the IDE's TypeScript picks
> up new Prisma types.

**Production:** see [DEPLOYMENT.md](DEPLOYMENT.md). In short:
`docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
builds the production images (compiled backend + static SPA behind nginx),
keeps the DB and backend internal, and publishes only the web port — put HTTPS
in front with Caddy/Traefik.

## 17. Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push/PR:

- **Backend job:** spins up a Postgres service, then `migrate deploy` → `seed` →
  `build` → unit tests → e2e tests → `npm audit` (advisory).
- **Frontend job:** `build` → unit tests → `npm audit` (advisory).

`npm audit` is advisory (non-blocking). The current high-severity findings are
all transitive `esbuild` advisories from the Vite/Vitest toolchain — build-time
only, not in the shipped bundle.

## 18. Known limitations & future work

- **Phase 2 — partially built.** Done: S7 estimation/quotation, S8 invoicing,
  S9 payments/receivables, S10 daily reports & timesheets, S11 expenses (incl.
  receipts + reimbursements). Remaining (see [PHASE2.md](PHASE2.md)):
  **S12 job costing & profit** (the schema's profit fields are pre-wired but
  unpopulated), S13 finance dashboard. The home dashboard does not yet show
  finance KPIs.
- **ZATCA** — Phase 1 QR (TLV) is generated; Phase 2 (crypto stamp, certificate
  onboarding, UBL XML signing, live Clearance/Reporting API) is future work.
- **Invoice PDF Arabic content** — labels are bilingual, but per-line product
  names and the amount-in-words line are English-only; buyer address uses the
  client's free-text billing address (structured buyer address + a
  `CompanySettings` table are deferred to the Phase-2 data pass).
- **Gotenberg dependency** — PDF generation needs the sidecar running and (for
  Arabic fonts) outbound access to Google Fonts; the prod backend image would
  also need the `pdf/assets` logo copied in (dev reads it from the mounted source).
- **No MFA / password-reset** — both require an email/SMS provider (a deliberate
  setup decision).
- **No "active sessions" UI** — "sign out everywhere" exists; per-device listing
  doesn't (the data model supports adding it).
- **Mobile UI** — desktop-first; tables overflow on small screens.
- **Local file storage** — swap `IStorageService` for S3 for multi-server setups.
- **Token cleanup** — expired/revoked refresh tokens aren't pruned (harmless;
  add a periodic job at scale).
- **Stateless access tokens** — revocation has up to a 15-minute lag by design.
- **Frontend component/browser tests** — only helper-level unit tests today
  (logic is well covered; rendered components are verified via build + e2e).
