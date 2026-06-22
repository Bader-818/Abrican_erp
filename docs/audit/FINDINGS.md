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
