# 07 — Edge Cases & Gotchas

[← Finance](06-finance.md) · [Index](README.md) · [Next: Testing & Quality →](08-testing-quality.md)

---

This is the chapter to re-read *before touching finance or scheduling code*. These are
the non-obvious rules the system already enforces — most exist because a real bug or an
audit finding forced them. The register of resolved findings is
[`../audit/FINDINGS.md`](../audit/FINDINGS.md) (F-001…F-012, all closed).

## Correctness & concurrency

### 1. Invoice numbers are assigned at issue, never at draft (F-012)
Official numbers (`INV-YYYY-####`) must have **no gaps** (legal/ZATCA). So
`invoiceNumber` is **nullable** and only assigned inside the issue transaction. Drafts
carry no number and can be deleted freely. Numbering uses a max-derived next value with
a **retry loop** on the unique constraint (concurrent issues can't collide).

### 2. Concurrent payments can't over-pay (INV-D7-7)
Recording a payment uses a **compare-and-swap** on `invoice.paidAmount`
(`updateMany where paidAmount = <observed>`). If another payment slipped in first, the
update matches 0 rows and the transaction retries — two payments can never both pass the
outstanding-balance check.

### 3. Concurrent invoice issue can't double-consume the PO (INV-X-3)
Issue does a CAS on the invoice **status** (`updateMany where status = APPROVED`) inside
the transaction. Only one concurrent issue wins; the loser gets a 409. This prevents
double PO draw-down and double job-status advance.

### 4. Money rounding trap
`round2(x) = Math.round((x + Number.EPSILON) * 100) / 100`. The `EPSILON` avoids the
classic `1.005 → 1.00` error. VAT is rounded **per line**, and document totals sum the
already-rounded lines — never re-round a grand total from raw inputs.

## Authorization & workflow

### 5. Self-approval is blocked everywhere it matters (SRS 168)
You cannot approve/reject/post/reimburse a **timesheet, daily report, or expense you
created** — the service throws `403` even for Admin (`createdById === user.id`). This is
separation-of-duties and is *not* something RBAC alone would catch.

### 6. Finance job-statuses can't be set by hand
`COSTING_REVIEW`, `READY_FOR_INVOICE`, `INVOICED`, `PARTIALLY_PAID`, `PAID` are in
`MANUAL_STATUS_CHANGE_BLOCKLIST`. They exist in the transition table only so the
**event-driven** path (invoice/payment/costing) can set them. A user hand-setting "PAID"
is refused. (See [`05-operations-core.md`](05-operations-core.md).)

### 7. Approved/issued records lock
Timesheets, daily reports, and expenses are editable **only in DRAFT/REJECTED**; once
approved, edits return 409. Issued invoices can't be hard-deleted or silently changed —
corrections are a (future) credit-note path.

### 8. Scheduling conflicts need an audited override
A conflicting assignment is a 409 unless the caller supplies `overrideReason` **and**
holds `assignments.override`; the override is written to the audit log
(`AuditAction.OVERRIDE`).

### 9. Estimate can't be converted twice
Conversion checks `estimate.jobId`/status first; an already-converted or non-APPROVED
estimate is rejected.

## Data-integrity rules

### 10. Polymorphic "exactly one of" is enforced in the DB
`JobAssignment` (employee/crew/vehicle/equipment) and `Document`
(employee/vehicle/equipment/contract/client) enforce exactly-one populated FK via CHECK
constraints from the `add_polymorphic_check_constraints` migration — not just app code.

### 11. Invoice PDF is an immutable snapshot
The PDF is rendered **at issue** and stored to `pdfUrl`. Later edits to the invoice do
**not** re-render it — the issued document is legal proof and must not change retroactively.

### 12. Crew costing respects membership dates
`CrewMember` has `startDate`/`endDate`; costing only counts members active on the
timesheet's date, so a member who left the crew isn't billed to a later job.

## Developer traps (things that will waste an hour)

| Trap | Reality |
|---|---|
| Prisma client "stale" after schema change in Docker | Run `docker compose exec backend npx prisma generate && docker compose restart backend`. `node_modules` is a container volume. |
| Dependencies not found after `npm install` on host | Install **inside** the container: `docker compose exec backend npm install`. |
| Wrong Postgres port | The **dev DB is on host port 5434** (5432/5433 are stale/old instances). |
| Apple-Silicon Docker Prisma error | `binaryTargets` includes `linux-musl-arm64-openssl-3.0.x` — keep it. |
| Login "returns 201" assumption | Login returns **HTTP 200**, not 201. |
| Login throttled during smoke tests | Rapid logins hit the 5/min throttle → 429. |
| Empty dropdown | Option loaders must use `pageSize: 100` (API max). `200` → 400 → empty. |
| e2e leftover rows | e2e creates future-dated (2030) assignments cleaned in `afterAll`; an interrupted run can 409 the next base creation until it self-heals. |
| **Never log in as** `admin@abrican.local` in dev scripts | It's the live human admin (with MFA). e2e uses a dedicated `e2e-admin@abrican.local`. |

---

[← Finance](06-finance.md) · [Index](README.md) · [Next: Testing & Quality →](08-testing-quality.md)
