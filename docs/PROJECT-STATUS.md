# Abrican ERP — Project Status & Roadmap

_Last updated: 2026-07-02. Living document — the single place to see where the project
stands, what's next, and the open risks. For a detailed factual inventory of what exists,
see the companion [SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md). Other companions:
[ARCHITECTURE.md](../ARCHITECTURE.md), [PHASE2.md](../PHASE2.md), [docs/audit/](audit/),
[docs/UAT-SUPABASE.md](UAT-SUPABASE.md)._

---

## 1. Snapshot
- **Phase 1 (operational core): complete.** **Phase 2 (finance): S7–S11 built & live; S12–S13 not built.**
- Codebase audited (consistency + invariants + tests) and pentested — **all 8 pentest
  findings FIXED 2026-07-02** (handover hardening pass, see [audit/PENTEST.md](audit/PENTEST.md)).
- Logic sweep 2026-07-02: 4 bugs fixed (F-007…F-010, incl. a HIGH document-numbering bug and
  two finance race conditions), 2 design questions open (F-011/F-012) — see
  [audit/FINDINGS.md](audit/FINDINGS.md).
- Source is on **GitHub** (private, `main`). A **UAT database is live on Supabase** (synthetic data).
- **Not yet deployed** to any hosted environment; no real users have tested it yet.
- Verified size: **48 permissions · 10 roles · 29 Prisma models · 27 enums · 8 migrations**.
- Tests (verified 2026-07-02, post-hardening): **187 backend unit** (30 files) · **31 e2e**
  (3 files) · **27 frontend** (4 files) — all green; `npm audit --omit=dev` clean both apps.

---

## 2. What's been built (done)

### Phase 1 — foundation & operational core
Auth (JWT access + rotating refresh, bcrypt, reuse detection, lockout), TOTP MFA,
force-password-change; RBAC (roles ↔ permissions, guards); clients / contracts (+rate cards) /
purchase orders; jobs + **status state machine**; employees / crews / vehicles / equipment;
assignments & scheduling (conflict detection, override, utilization); documents + expiry;
audit log; notifications; operations & assets dashboards. Docker dev stack.

### Phase 2 — finance (S7–S11)
- **S7 Estimates/quotations** — priced from contract rate cards, bilingual PDF, → convert to job.
- **S8 Invoicing** — from estimate actuals, 15% VAT, PO-balance check, ZATCA-Phase-1 QR PDF, sets job `INVOICED`.
- **S9 Payments & receivables** — full/partial, AR aging, auto invoice/job status.
- **S10 Daily reports & timesheets** — DRAFT→SUBMITTED→APPROVED/REJECTED approval workflow.
- **S11 Expenses** — categories, multi-allocation, receipts, approve/post, hard self-approval
  block, per-employee **reimbursement** worklist.

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
- GitHub repo connected; all docs and the 2026-07-02 hardening/logic-sweep commits are on
  `main` and pushed.
- UAT DB on Supabase (Sydney/session-pooler), migrated + seeded + contract loaded.

---

## 3. Explicitly NOT built / deferred / forgotten

This is the **complete** list, consolidated from the code, README, ARCHITECTURE.md, PHASE2.md,
the SRS, and the audit docs. Nothing here is implemented today.

### Phase 2 — remaining finance features
- **S12 — Job Costing & Profitability** (the profit feature). Schema fields are pre-wired but
  **no logic exists** (`Job.actualCost/grossProfit/grossMarginPct/costReviewedAt/costReviewedById`,
  `Estimate.estimatedCost/estimatedMarginPct`, `EstimateLineItem.estimatedUnitCost/lineCost`).
  Was built once and **reverted** per decision. Intended scope (PHASE2 §5.4): compute
  `actualCost` by category (labour = Σ approved timesheet hrs × `employee.costRate`;
  vehicle/equipment = Σ `JobAssignment.actualHours` × `costRate`; + posted expenses by
  category), then `grossProfit`, `grossMarginPct`, cost variance vs. `costBudget`, and
  estimate-vs-actual margin; backfill the S7 estimate cost hooks; wire the status side-effects
  `COMPLETED → COSTING_REVIEW → READY_FOR_INVOICE`.
- **S13 — Finance Dashboard & Reports** (PHASE2 §5.5). KPIs: monthly revenue/expense/gross
  profit/margin, net-profit estimate, unbilled revenue, AR, overdue invoices, collected vs.
  pending, expense-by-category, profit-by-job/client/service-line. Reports: revenue,
  expense-by-category, profit, receivables aging, unbilled work, VAT report, cash collection,
  overdue invoices; with date/client/service-line/region/status filters. The home dashboard
  shows **no finance KPIs** today.
- **Critical finance alerts** (PHASE2 §6) — via notifications: cost over budget, margin below
  target, PO nearly consumed, invoice exceeds PO, invoice overdue, completed-but-not-invoiced,
  expense missing category/allocation, client payment delayed. **Blocked** on adding the
  finance-alert values back to `NotificationType` (it currently has 8 values, none finance).
- **Consequence — dead lifecycle states:** ~~selectable but undriven~~ **Resolved 2026-07-02:**
  `COSTING_REVIEW`/`READY_FOR_INVOICE` are now hidden from the manual picker (frontend only);
  the backend state machine is unchanged and ready for S12.

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
- **No backups / DR** plan (owned + tested) for production.
- **Never deployed** to a hosted environment; **CI exists but isn't gating** merges.
- **S3 (or shared) storage** needed for multi-server; local FS only today.
- The **prod backend image** needs the `pdf/assets` logo copied in, and Gotenberg needs
  outbound access to Google Fonts for Arabic rendering.

---

## 4. Roadmap (from here)

### A. Finish UAT (immediate)
1. **Deploy the app** so real users can reach it (backend+frontend on Railway/Render/Fly
   pointed at the Supabase UAT DB) — or run the Docker stack against Supabase for internal UAT.
2. **Run UAT with actual staff** (Ops, Finance, Field Supervisor) against their real
   workflow; collect gaps. _This is the highest-value next step._
3. **Discovery vs. spreadsheets** — collect every operational sheet/form (like the vehicle &
   contract sheets) and reconcile against the data model *before* more building.

### B. Complete Phase 2 (feature)
4. **S12 Job Costing & Profitability** — actual cost (labour/vehicle/equipment/expenses),
   gross margin, estimate-vs-actual; wire `COSTING_REVIEW`/`READY_FOR_INVOICE`.
5. **S13 Finance Dashboard & Reports** — revenue/expense/profit KPIs, aging, VAT, exports.
6. **Critical finance alerts** via notifications.

### C. Production readiness (before real data)
7. **In-Kingdom DB** (Azure KSA / GCP Dammam) + **backups/PITR + DR**.
8. **Fix pentest items** (§5): admin password, secrets, Swagger gating, deny-by-default
   guard, multer/deps upgrade.
9. **Deploy pipeline** — wire CI (the repo has a workflow) to run on push; execute the
   hardened prod compose; TLS.
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
3. **No backups / DR.** There is still no backup strategy. This must exist *before* any real
   data lands. Supabase UAT has provider backups, but production needs an owned, tested plan.
4. **Security items — CLOSED 2026-07-02.** All 8 PENTEST findings are fixed and re-verified
   ([docs/audit/PENTEST.md](audit/PENTEST.md) remediation section). Remaining owner actions:
   **rotate the UAT Supabase password** (was pasted in chat) and set a strong `ADMIN_PASSWORD`
   (or capture the generated one) on the next fresh seed.
5. **Compliance is a hard gate you haven't started.** PDPL + Aramco in-Kingdom residency and
   **ZATCA Phase-2** are legal requirements, not nice-to-haves. UAT on a Sydney Supabase is
   fine *only* with synthetic data; do not put real client/employee data there.
6. **Deployment has never actually happened.** The prod compose is hardened but unrun; CI
   exists but isn't gating pushes to the new GitHub repo. "Works on my machine" ≠ shippable.
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
