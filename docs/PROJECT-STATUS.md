# Abrican ERP — Project Status & Roadmap

_Last updated: 2026-07-19. Living document — the single place to see where the project
stands, what's next, and the open risks. For a detailed factual inventory of what exists,
see the companion [SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md). Other companions:
[ARCHITECTURE.md](../ARCHITECTURE.md), [PHASE2.md](../PHASE2.md), [SELF-HOSTING.md](SELF-HOSTING.md),
[docs/audit/](audit/), [docs/UAT-SUPABASE.md](UAT-SUPABASE.md)._

---

## 1. Snapshot
- **Phase 1 (operational core): complete.** **Phase 2 (finance): S7–S13 built & live**
  (S12 job costing, S13 finance dashboard, and critical finance alerts landed 2026-07-05).
- Codebase audited (consistency + invariants + tests) and pentested — **all 8 pentest
  findings FIXED 2026-07-02** (handover hardening pass, see [audit/PENTEST.md](audit/PENTEST.md)).
- Logic sweep 2026-07-02: 4 bugs fixed (F-007…F-010, incl. a HIGH document-numbering bug and
  two finance race conditions). The two open design questions were resolved and fixed
  2026-07-08: **F-011** timesheet/daily-report self-approval block, **F-012** invoice numbers
  assigned at issue time (drafts consume no numbers) — **all findings closed**, see
  [audit/FINDINGS.md](audit/FINDINGS.md).
- Source is on **GitHub** (private, `main`). A **UAT database is live on Supabase** (synthetic data).
- **Not yet deployed** to any hosted environment; no real users have tested it yet.
- Verified size: **51 permissions · 10 roles · 29 Prisma models · 27 enums · 10 migrations**.
- Tests (runner-authoritative, 2026-07-19): **212 backend unit** (32 files) · **34 e2e**
  (3 files) · **28 frontend** (4 files) — all green; consistency audit **0 findings**.

---

## 2. What's been built (done)

### Phase 1 — foundation & operational core
Auth (JWT access + rotating refresh, bcrypt, reuse detection, lockout), TOTP MFA,
force-password-change; RBAC (roles ↔ permissions, guards); clients / contracts (+rate cards) /
purchase orders; jobs + **status state machine**; employees / crews / vehicles / equipment;
assignments & scheduling (conflict detection, override, utilization); documents + expiry;
audit log; notifications; operations & assets dashboards. Docker dev stack.

### Phase 2 — finance (S7–S13)
- **S7 Estimates/quotations** — priced from contract rate cards, bilingual PDF, → convert to job.
- **S8 Invoicing** — from estimate actuals, 15% VAT, PO-balance check, ZATCA-Phase-1 QR PDF, sets job `INVOICED`.
- **S9 Payments & receivables** — full/partial, AR aging, auto invoice/job status.
- **S10 Daily reports & timesheets** — DRAFT→SUBMITTED→APPROVED/REJECTED approval workflow.
- **S11 Expenses** — categories, multi-allocation, receipts, approve/post, hard self-approval
  block, per-employee **reimbursement** worklist.
- **S12 Job costing & profitability** — `costing` module: actual cost from approved timesheets
  (× employee/crew cost rate, overtime-weighted), vehicle/equipment assignment hours × cost rate,
  and posted expenses by category; gross profit / margin / budget variance; per-line **estimate
  cost hooks** for projected margin. Drives `COMPLETED → COSTING_REVIEW → READY_FOR_INVOICE`,
  which are now **removed from the manual status picker** (workflow-driven only). Costing tab on
  the job page (`jobs.costing_view` / `jobs.costing_review`).
- **S13 Finance dashboard** — `GET /dashboard/finance` + `/finance` page: billed revenue &
  output VAT, cash collected, receivables/overdue (reuses aging), realised gross profit & avg
  margin, expenses by category, net VAT, unbilled completed work, invoice-status pipeline; date
  window filter (`dashboard.finance.view`).
- **Critical finance alerts** — `finance-alerts` module: event-triggered (invoice > PO, PO ≥ 90%
  consumed on issue; over-budget / margin-below-target on cost review) plus a daily `@nestjs/schedule`
  sweep (overdue invoices, completed-but-uninvoiced jobs), fanned to permission-holders with an
  unread-duplicate guard. Seven finance `NotificationType` values added.

### Recent enhancements (this working period)
- **Vehicles** — fleet fields to match the real sheet: door no., Arabic plate, car/plate
  colour, **light/heavy class**, operating-card + Aramco-sticker expiry.
- **Contract pricing** — imported Aramco contract **6601000307** (47 rate-card line items);
  estimate lines can be **picked from the rate card at the fixed price or entered custom**.
- **Estimate form** — redesigned line items (per-line cards, live totals); **unit price
  (contract lines) and VAT are locked** in the UI **and enforced server-side**; rate-card
  picker ordered by item number; fixed a blank-line submit bug.
- **Job ↔ booking consistency** — job status now cascades to its resource bookings
  (ACTIVE/COMPLETED/CANCELLED); scheduling column relabelled "Booking status".

### Quality & security artifacts
- **Consistency audit** harness (`npm run audit:consistency`) — RBAC triangle, enum/Decimal
  parity, pagination, audit-coverage — currently **0 findings**.
- **[docs/audit/INVARIANTS.md]** (logic oracle), **FINDINGS.md** (all resolved),
  **SMOKE-MATRIX.md** (per-role), **CONSISTENCY-REPORT.md** (generated).
- **[docs/audit/PENTEST.md]** — no CRITICALs; findings are config/hardening (see §5).
- **[docs/audit/JOB-LIFECYCLE.md]** — full state-machine review.

### Infrastructure
- GitHub repo connected; all work (Phase 2, hardening/logic sweep, UI polish, self-hosting
  pack) is on `main` and pushed.
- UAT DB on Supabase (Sydney/session-pooler), migrated + seeded + contract loaded.
- **Self-hosting pack** — [SELF-HOSTING.md](SELF-HOSTING.md) runbook + `deploy/` (Caddy internal
  TLS + LAN/VPN subnet allowlist, the Gotenberg sidecar the base prod file omits, PDF-logo mount,
  and a nightly backup script). Written and config-validated, **not yet run on a real server**.

---

## 3. Explicitly NOT built / deferred / forgotten

This is the **complete** list, consolidated from the code, README, ARCHITECTURE.md, PHASE2.md,
the SRS, and the audit docs. Nothing here is implemented today.

### Phase 2 — finance: COMPLETE (2026-07-05)
S12 job costing, S13 finance dashboard, and the critical finance alerts are **built and live**
— see §2. The `COSTING_REVIEW`/`READY_FOR_INVOICE` states are now workflow-driven (and blocked
from the manual status endpoint). Deferred fast-follows within this area:
- **Full parametric report suite** (revenue/expense/profit **by client / service-line / month**
  with date/client/region filters) and **Excel/PDF export** — the S13 dashboard delivers the
  KPIs + aging + VAT + expense-by-category, but not the drill-down reports (PHASE2 §5.5).
- **Email/SMS delivery of alerts** — alerts are **in-app only** (blocked on the SMTP layer below).
- **Overtime/standby cost weightings** (currently 1.5× / 1.0×) and the **margin/PO thresholds**
  (10% / 90%) are assumptions in `costing.constants.ts` / `finance-alerts.constants.ts` —
  confirm with Finance during UAT.

### Compliance / e-invoicing
- **ZATCA Phase-2 e-invoicing** — only Phase-1 QR (TLV) is emitted today. Phase-2 needs the
  cryptographic stamp, certificate onboarding, UBL XML signing, and the live Clearance/
  Reporting API. `Invoice.uuid` and `Invoice.zatcaStatus` are placeholders only.

### Auth / notifications gaps
- **Email/SMTP** layer — blocks real password-reset emails and any notification email/SMS.
- **MFA recovery codes** and an **MFA enforcement policy** (currently opt-in per user).
- **Per-device active-sessions UI** — "sign out everywhere" exists; the data model supports a
  per-device listing, but the UI doesn't.
- **Refresh-token pruning** — expired/revoked tokens aren't reaped (harmless; add a job at scale).

### UI / UX gaps
- **Arabic / RTL UI** — English-only today (only Arabic *data* fields like `plateNumberAr`
  and the bilingual PDF exist); no i18n library, no RTL layout, no language switcher.
- **Mobile responsiveness** — desktop-first; wide tables overflow on small screens.
- **Dashboard / report export** (Excel/PDF) and **global search** — not present.

### Data-model / finance depth deferred
- **Department model** — `Expense.departmentId` intentionally omitted ("no Department model yet").
- **Structured buyer address + `CompanySettings`** — invoices use the client's free-text
  billing address; per-line names and amount-in-words on the PDF are English-only.
- **Credit / debit notes** — beyond the current data model.
- **Inventory-driven material costing** — only manual material lines/expenses today.

### Phase 3 (future modules)
- Maintenance management, procurement, inventory, and full analytics/BI.

### Operational / deployment gaps (see also §5)
- **Backups:** a nightly backup script + runbook exist (`deploy/backup.sh`,
  [SELF-HOSTING.md](SELF-HOSTING.md) §11). 2026-10-01: dump + restore **validated locally**
  (scratch-DB restore, all 30 tables' row counts identical) and a bug that made the script abort
  before backing anything up was fixed. Still **not run on a real deployment**, and there is no
  off-box/DR copy yet.
- **Never deployed** to a real environment; **CI exists but isn't gating** merges.
- **S3 (or shared) storage** needed for multi-server; local FS only today.
- The **base `docker-compose.prod.yml` still omits Gotenberg** and the prod backend image
  doesn't bundle the PDF logo — the self-hosting overlay (`deploy/docker-compose.tls.yml`) fixes
  both, but anyone running the base prod file alone would get failing/unbranded PDFs. Gotenberg
  also needs outbound access to Google Fonts for Arabic rendering.

---

## 4. Roadmap (from here)

### A. Finish UAT (immediate)
1. **Deploy the app** so real users can reach it (backend+frontend on Railway/Render/Fly
   pointed at the Supabase UAT DB) — or run the Docker stack against Supabase for internal UAT.
2. **Run UAT with actual staff** (Ops, Finance, Field Supervisor) against their real
   workflow; collect gaps. _This is the highest-value next step._
3. **Discovery vs. spreadsheets** — collect every operational sheet/form (like the vehicle &
   contract sheets) and reconcile against the data model *before* more building.

### B. Phase 2 — DONE ✅
S12 costing, S13 finance dashboard, and critical finance alerts shipped 2026-07-05 (see §2).
Remaining fast-follows: the **parametric report suite** (revenue/expense/profit by
client/service-line/month) + **Excel/PDF export**, and **email/SMS delivery** of the alerts
(currently in-app only).

### C. Production readiness (before real data)
7. **In-Kingdom DB** (Azure KSA / GCP Dammam) + **backups/PITR + DR** + **encryption at rest**.
8. **Deploy for real** — either the on-premise self-hosting pack ([SELF-HOSTING.md](SELF-HOSTING.md))
   or a hosted stack; run the backup script + a test restore. (Pentest items P-01…P-08 were
   already fixed in the 2026-07-02 hardening pass — see §5.)
9. **Deploy pipeline** — wire CI (the repo has a workflow) to gate on push; add the base prod
   compose's missing Gotenberg (or standardise on the self-hosting overlay).
10. **Data migration/import** from the current spreadsheets → the system (cutover plan).

### D. Compliance & reach
11. **ZATCA Phase-2 e-invoicing** (legal in KSA) and **PDPL** obligations (retention, access).
12. **Email/SMTP** layer; **Arabic/RTL** UI; **mobile** for field entry.

### E. Phase 3 (later)
Maintenance management, procurement, inventory (+ inventory-driven material costing),
full analytics/exports.

---

## 5. My comments & concerns (candid)

**Biggest risks, roughly in priority order:**

1. **No real UAT yet.** Everything has been validated by *me* (tests, smokes), not by the
   business. The single most valuable thing now is getting Ops/Finance/Field users to run
   their real workflow and surface gaps. Build less, validate more.
2. **The data model keeps trailing the real artifacts.** Every time you've shown a real sheet
   (vehicles, the Aramco contract), it contained fields we hadn't modelled. That's a
   discovery gap — do a deliberate artifact-collection pass instead of patching field-by-field.
3. **Backups proven locally, not yet in production.** The nightly script + runbook
   (`deploy/backup.sh`, [SELF-HOSTING.md](SELF-HOSTING.md) §11) were restore-tested locally on
   2026-10-01 (identical row counts in all 30 tables), and a bug that made the script abort on
   the shipped `.env.production` (it `source`d the file; `ADMIN_NAME=System Administrator`
   broke it) was fixed. Still to do *before* real data lands: run it on the server via cron and
   copy backups off-box. Supabase UAT has provider backups; production needs an owned plan.
4. **Security items — CLOSED 2026-07-02.** All 8 PENTEST findings are fixed and re-verified
   ([docs/audit/PENTEST.md](audit/PENTEST.md) remediation section). Remaining owner actions:
   **rotate the UAT Supabase password** (was pasted in chat) and set a strong `ADMIN_PASSWORD`
   (or capture the generated one) on the next fresh seed.
5. **Compliance is a hard gate you haven't started.** PDPL + Aramco in-Kingdom residency and
   **ZATCA Phase-2** are legal requirements, not nice-to-haves. UAT on a Sydney Supabase is
   fine *only* with synthetic data; do not put real client/employee data there.
6. **Deployment has never actually happened.** The prod compose + the on-premise self-hosting
   pack are written and config-validated, but **unrun on a real server**; CI exists but isn't
   gating pushes. "Works on my machine" ≠ shippable until it's actually stood up and UAT'd.
7. **Bus factor = 1.** One person + AI. No ops runbook, no second maintainer, no on-call.
   Fine for now; a liability once it's business-critical.
8. **Dead lifecycle states — resolved 2026-07-02.** Hidden from the manual picker; backend
   state machine untouched, ready for S12.
9. **English-only UI for a bilingual business.** Arabic plates and ZATCA already force
   Arabic data; field staff will want an Arabic/mobile UI. Deferring is OK, but plan it.
10. **Scope discipline.** Work has been reactive (redesigns, one-off fields, ad-hoc pricing).
    Recommend a written, prioritized backlog and a **feature freeze before UAT** so testing
    hits a stable target.

**What's genuinely solid:** the auth/RBAC/audit foundation, the finance math (now
authoritative server-side), the approval workflows, the job state machine, and the test +
consistency-audit safety net. The core is trustworthy — the gaps are around *productionizing*
and *validating with real users*, not the code quality.

**My one-line recommendation:** freeze features, deploy for UAT with synthetic data, get real
users testing, and in parallel start the production-readiness track (in-Kingdom DB + backups +
the pentest fixes). Treat S12/S13 as fast-follows once UAT confirms the operational core fits.
