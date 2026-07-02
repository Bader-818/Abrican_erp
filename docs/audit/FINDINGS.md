# Abrican ERP — Audit Findings Register

The curated, reviewed discrepancy register for the system-wide testing & consistency
audit. The auto-generated [CONSISTENCY-REPORT.md](CONSISTENCY-REPORT.md) is the raw input;
this file is the triaged truth.

> **Status: all findings resolved.** The fix pass is complete — every item below is
> **FIXED** or verified **FALSE-POSITIVE**. `npm run audit:consistency` reports 0 items;
> 174 unit + 31 e2e + 25 frontend tests pass.

Severity: **CRITICAL** (data loss / security / all-users-blocked) · **HIGH** (wrong
result for some path) · **MEDIUM** (inconsistency / dead surface) · **LOW** (latent /
cosmetic) · **INFO** (expected, recorded for completeness).

Status: `OPEN` · `FALSE-POSITIVE` · `WONT-FIX` · `FIXED`.

| ID | Sev | Status | Domain | Finding | Resolution |
|----|-----|--------|--------|---------|------------|
| F-001 | MEDIUM | ✅ FIXED | D9 RBAC | Orphan permission `dashboard.finance.view` — seeded and granted to 4 roles, but no endpoint/UI (S13 reverted). | **Killed.** Removed the permission definition + all 4 role grants from `prisma/seed.ts`, reseeded, and deleted the row from the DB (RolePermission grants cascade-deleted). RBAC triangle now clean. |
| F-002 | LOW | ✅ FIXED | DX Decimal | `outstandingAmount`/`totalOutstanding`/`totalOwed` typed `number` on computed-aggregate types (vs `string` on raw entities) — a wire-type trap. | Convention made explicit: each intentional computed-aggregate field annotated `// audit:decimal-ok — computed aggregate (round2 → number)` in `frontend/src/types/index.ts`; the `decimal-parity` check now honors that marker. |
| F-003 | LOW | ✅ FIXED | D4 Enum | Frontend aliased `EquipmentStatus = VehicleStatus` (identical today, silent-drift risk). | `EquipmentStatus` given its own explicit union in `frontend/src/types/index.ts`; enum-parity now guards it independently. |
| F-004 | INFO | FALSE-POSITIVE | D1 RBAC | `auth.me` backend-enforced, not gated in frontend. | Expected (universal permission). Exempted in `rbac-triangle` so the report is clean. |
| F-005 | INFO | FALSE-POSITIVE | DX Audit | Audit-coverage heuristic flagged `revokeAllForUser` (does record `LOGOUT`), `notifications.create` (system side-effect), `storage.delete` (low-level util). | Verified correct/by-design; added as documented exemptions in `audit-coverage`. |

## Static-audit verdict (RESOLVED)
All five static checks now report **0 items** (`npm run audit:consistency`). The orphan
permission (F-001) is eliminated; the decimal/enum/audit items were either fixed (F-002,
F-003) or confirmed-correct exemptions (F-004, F-005).

## Dynamic findings (P3 unit / P4 e2e)
_Appended as test development surfaces logic gaps._

| ID | Sev | Status | Domain | Finding | Resolution |
|----|-----|--------|--------|---------|------------|
| F-006 | MEDIUM | ✅ FIXED | D7 Finance | The payment-creation response embedded a **stale invoice snapshot** — `tx.payment.create({ select: { …, invoice } })` ran before `tx.invoice.update(...)`, so the POST response showed pre-payment `status`/`outstandingAmount` (DB was correct). | **Reordered the transaction** in `PaymentsService.create`: the invoice is updated first, then the payment row is created/selected, so the embedded invoice reflects post-payment values. `finance-flow.e2e-spec.ts` now asserts the payment response directly (PARTIALLY_PAID/half, PAID/0) and via GET. |

### Verdict (RESOLVED)
The cross-module finance chain is correct end-to-end and **F-006 is fixed**. All findings
(F-001…F-006) are now FIXED or verified FALSE-POSITIVE — no OPEN items remain.

## Handover logic sweep — 2026-07-02

| ID | Sev | Status | Domain | Finding | Resolution |
|----|-----|--------|--------|---------|------------|
| F-007 | HIGH | ✅ FIXED | D7/D3 Numbering | JOB/EST/INV numbers were generated as `count(prefix) + 1`. Once any record is deleted, count < max, so the "next" number collides with an existing one **forever** (the retry loop recomputes the same value). Hit live on the dev DB: estimate→job conversion returned 500 after jobs were deleted. | Next number now derived from the **highest existing** number (`findFirst orderBy desc`) in `jobs.service.ts`, `invoices.service.ts`, `estimates.service.ts`; regression test in `jobs.service.spec.ts`. |
| F-008 | MEDIUM | ✅ FIXED | D7 Finance | `PaymentsService.create` read `paidAmount` **outside** the transaction: two concurrent payments could both pass the outstanding-balance check and one update would be lost (INV-D7-7 "atomically" violated). | Read + validation moved inside the transaction with a compare-and-swap on `paidAmount` (`updateMany where paidAmount = read value`); concurrent conflict → 409 retry. Regression test added. |
| F-009 | MEDIUM | ✅ FIXED | D7 Finance | `InvoicesService.issue` checked APPROVED status outside the transaction: a concurrent double-issue would consume the PO **twice** and double-advance the job (INV-X-3). | The APPROVED→SUBMITTED flip is now a compare-and-swap (`updateMany where status = APPROVED`) inside the transaction; second issuer gets 409. Regression test added. |
| F-010 | LOW | ✅ FIXED | DX Seed | Re-running the seed on a dev DB whose demo rows were partially deleted crashed with P2025 (`findUniqueOrThrow` on deleted demo jobs), aborting the whole seed. | Demo sections now catch P2025 and skip with a warning; RBAC/admin seeding stays strict (`prisma/seed.ts`). |
| F-011 | INFO | OPEN (design) | D6 Approvals | Timesheets and daily reports have **no self-approval block** — a user holding both `*.manage` and `*.approve` can approve their own submission. Expenses block this (INV-D8-3); D6 does not (documented delta INV-X-4). | **Owner decision needed:** either accept (role design keeps manage/approve separate) or extend the expenses-style `assertNotSelf` to timesheets/daily-reports. No code change made. |
| F-012 | INFO | OPEN (design) | D7 Numbering | Deleting DRAFT invoices leaves **gaps in the invoice number sequence**. ZATCA expects sequential tax-invoice numbering; gaps in issued numbers are a compliance question for Phase-2 e-invoicing. | Note for the ZATCA Phase-2 work: consider assigning the final invoice number at **issue** time rather than at draft creation. No code change made. |

### Verdict
F-007…F-010 fixed with regression tests; F-011/F-012 are design decisions left open for the
owner. All suites green after the fixes (187 unit / 31 e2e / 27 frontend).
