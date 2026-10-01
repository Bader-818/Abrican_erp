# 10 — Concerns & Deferred Work

[← Deployment](09-deployment.md) · [Index](README.md) · [Next: Self-Quiz →](11-self-quiz.md)

---

An honest map of what's *not* done and what to worry about. This mirrors
[`../PROJECT-STATUS.md`](../PROJECT-STATUS.md) §3 (deferred) and §5 (risks) — check that
doc for the latest, since it's the living version. **Nothing in the "deferred" lists is
implemented today.**

## 1. The candid risk list (priority order)

1. **No real UAT yet.** Everything has been validated by tests/smokes, not by actual
   Ops/Finance/Field staff running their real workflow. This is the single highest-value
   next step: build less, validate more.
2. **The data model trails the real artifacts.** Every time a real sheet appeared
   (the vehicle fleet, the Aramco contract), it had fields that weren't modelled. Do a
   deliberate artifact-collection pass rather than patching field-by-field.
3. **Backups proven locally, not yet in production.** `deploy/backup.sh` was
   restore-tested locally on 2026-10-01 (all 30 tables matched) and an env-loading bug that
   aborted it was fixed. Still to do *before* real data lands: run it on the real server via
   cron and keep an **off-box/DR copy**.
4. **Security findings — CLOSED.** All 8 pentest findings fixed & re-verified
   (2026-07-02). Remaining owner actions: **rotate the UAT Supabase password** (was
   pasted in chat once) and set a strong `ADMIN_PASSWORD` on the next fresh seed.
5. **Compliance is a hard gate, not started.** PDPL + Aramco **in-Kingdom data
   residency** and **ZATCA Phase-2** are legal requirements. UAT on a Sydney Supabase is
   fine **only with synthetic data** — never real client/employee data there.
6. **Never actually deployed.** The prod + self-hosting stacks are written and
   config-validated but unrun on a real server. CI exists but doesn't gate.
7. **Bus factor = 1.** One person + AI. No second maintainer, no on-call, no ops runbook
   beyond these docs. Fine now; a liability once it's business-critical.
8. **English-only UI for a bilingual business.** Arabic plates and ZATCA already force
   Arabic *data*; field staff will eventually want an Arabic/mobile UI. Deferring is OK —
   plan it.
9. **Scope discipline.** Work has been reactive (redesigns, one-off fields). Recommend a
   written, prioritized backlog and a **feature freeze before UAT**.

**What's genuinely solid:** the auth/RBAC/audit foundation, the server-authoritative
finance math, the approval workflows, the job state machine, and the test +
consistency-audit safety net. The gaps are around *productionizing* and *validating*,
not code quality.

---

## 2. The complete "not built yet" inventory

### Finance fast-follows
- **Parametric report suite** (revenue/expense/profit by client/service-line/month with
  filters) + **Excel/PDF export**. The S13 dashboard gives KPIs + aging + VAT + expense-
  by-category, but not the drill-down reports.
- **Email/SMS delivery** of alerts — alerts are **in-app only** (blocked on the SMTP
  layer below).
- **Threshold/weighting confirmation** — margin 10%, PO 90%, unbilled 7 days, and the
  overtime/standby/travel multipliers are assumptions in constants files; confirm with
  Finance during UAT.

### Compliance / e-invoicing
- **ZATCA Phase-2** e-invoicing — only Phase-1 QR (TLV) is emitted today. Phase-2 needs
  the cryptographic stamp, certificate onboarding, UBL XML signing, and the live
  Clearance/Reporting API. `Invoice.uuid` and `zatcaStatus` are placeholders.

### Auth / notifications
- **Email/SMTP** layer — blocks password-reset emails and any email/SMS notification.
- **MFA recovery codes** and an **MFA enforcement policy** (currently opt-in per user).
- **Per-device sessions UI** — "sign out everywhere" exists; the model supports a
  per-device listing but there's more UI to build.
- **Refresh-token pruning** — expired/revoked tokens aren't reaped (harmless; add a job
  at scale).

### UI / UX
- **Arabic / RTL UI** — English-only today (only Arabic *data* fields + the bilingual
  PDF exist); no i18n library, no RTL layout, no language switcher.
- **Mobile responsiveness** — desktop-first; wide tables overflow on phones.
- **Dashboard/report export** (Excel/PDF) and **global search** — absent.

### Data-model depth
- **Department model** — `Expense.departmentId` intentionally omitted.
- **Structured buyer address + `CompanySettings`** — invoices use the client's free-text
  billing address; per-line Arabic names + amount-in-words are English-only on the PDF.
- **Credit / debit notes** — beyond the current data model (the correction path for
  issued invoices).
- **Inventory-driven material costing** — only manual material lines/expenses today.

### Operational / deployment
- **Backups** — untested on a real deployment; no off-box/DR copy.
- **Never deployed**; **CI not gating**.
- **S3 (or shared) storage** — needed for multi-server; local filesystem only today.
- **Base `docker-compose.prod.yml` omits Gotenberg** — run alone → failing/unbranded
  PDFs; the self-hosting overlay fixes it (see [`09-deployment.md`](09-deployment.md)).

### Phase 3 (future modules)
- Maintenance management, procurement, inventory, and full analytics/BI.

---

[← Deployment](09-deployment.md) · [Index](README.md) · [Next: Self-Quiz →](11-self-quiz.md)
