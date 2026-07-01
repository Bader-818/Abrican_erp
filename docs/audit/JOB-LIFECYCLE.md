# Abrican ERP — Job Lifecycle Review

A review of how a `Job` moves through its statuses: the state machine, who drives each
transition, the side-effects, and findings/recommendations. Ground truth:
[job-status.constants.ts](../../backend/src/jobs/job-status.constants.ts) and
[job-status.service.ts](../../backend/src/jobs/job-status.service.ts).

## 1. The state machine
```
                    ┌─────────── operational (user-driven) ───────────┐   ┌──── finance (event-driven) ────┐
DRAFT → PLANNED → APPROVED → SCHEDULED → ACTIVE → COMPLETED → COSTING_REVIEW → READY_FOR_INVOICE → INVOICED → PARTIALLY_PAID → PAID → CLOSED
  └────────────────────── CANCELLED (from DRAFT/PLANNED/APPROVED/SCHEDULED/ACTIVE/ON_HOLD) ──────────────────────┘
                       ON_HOLD ↔ (APPROVED/SCHEDULED/ACTIVE)
```
Allowed transitions (exact):

| From | To |
|---|---|
| DRAFT | PLANNED, CANCELLED |
| PLANNED | APPROVED, CANCELLED, **DRAFT** (back) |
| APPROVED | SCHEDULED, ON_HOLD, CANCELLED |
| SCHEDULED | ACTIVE, ON_HOLD, CANCELLED |
| ACTIVE | ON_HOLD, COMPLETED, CANCELLED |
| ON_HOLD | SCHEDULED, ACTIVE, CANCELLED |
| COMPLETED | COSTING_REVIEW, **ACTIVE** (re-open) |
| COSTING_REVIEW | READY_FOR_INVOICE, COMPLETED (back) |
| READY_FOR_INVOICE | INVOICED, COSTING_REVIEW (back) |
| INVOICED | PARTIALLY_PAID, PAID |
| PARTIALLY_PAID | PAID |
| PAID | CLOSED |
| CLOSED / CANCELLED | — (terminal) |

## 2. Two drivers of status change
- **`changeStatus` (user)** — a person hitting `POST /jobs/:id/status`, gated by
  `jobs.status_change`. Enforces `ALLOWED_TRANSITIONS` (illegal move → 400). This is the
  operational half (DRAFT…COMPLETED, ON_HOLD, CANCELLED) and can also be used for the
  finance statuses manually.
- **`applyFinanceStatus` (system event)** — called by finance modules, **not** a user:
  invoice *issue* → `INVOICED`; payment → `PARTIALLY_PAID`/`PAID`. It is **forward-only**
  along `FINANCE_ORDER` (COMPLETED→…→CLOSED): a backward/no-op move is silently ignored, a
  cancelled job is refused, and a job below COMPLETED can't take a finance status
  (INV-D3-3/4/5). Runs in the caller's transaction so status + PO/invoice writes commit
  atomically.

## 3. Side-effects per transition
| Trigger | Effect |
|---|---|
| → ACTIVE | Stamps `actualStartDate` (once); **requires ≥1 non-cancelled assignment** or an audited override (`jobs.status_override` + reason); **cascades PLANNED bookings → ACTIVE** |
| → COMPLETED | Stamps `actualEndDate` (once); **cascades PLANNED/ACTIVE bookings → COMPLETED** |
| → CANCELLED | **cascades PLANNED/ACTIVE bookings → CANCELLED** |
| any change | Writes a `JobStatusHistory` row + an audit-log entry (`STATUS_CHANGE`, or `OVERRIDE` when the assignment gate was overridden) |
| estimate convert | Creates the Job (copies estimate total → `jobValue`) — entry point into the lifecycle |
| invoice issue | `applyFinanceStatus(INVOICED)` + consumes the PO |
| payment | `applyFinanceStatus(PARTIALLY_PAID / PAID)` from paid vs. outstanding |

> **New (this change):** job status now carries its resource **bookings** along
> (`ASSIGNMENT_CASCADE` in `job-status.service.ts`), so the Scheduling view can no longer show
> PLANNED bookings under an ACTIVE job. The Scheduling column was also relabelled
> **"Booking status"** to distinguish it from the Job status.

## 4. Findings & recommendations
1. **COSTING_REVIEW & READY_FOR_INVOICE are reachable but nothing auto-drives them.** They
   exist in the machine but S12 (costing) was reverted, so they're **manual-only** today. A
   job typically jumps COMPLETED → (manually) READY_FOR_INVOICE → INVOICED. *Rec:* wire them
   in S12, or hide them from the manual status picker until then to avoid dead options.
2. **CLOSE gate is hard, not overridable.** `CLOSED` is reachable only from `PAID`, so a job
   cannot be closed unless fully paid. The SRS allowed a manager override to close early
   (SRS 490) — not implemented. *Rec:* if early close is a real need, add an override path;
   otherwise document the hard gate as intentional.
3. **Backward/re-open moves are permitted** (PLANNED→DRAFT, COMPLETED→ACTIVE,
   COSTING_REVIEW→COMPLETED, READY_FOR_INVOICE→COSTING_REVIEW). Reasonable for corrections,
   but note **re-opening COMPLETED→ACTIVE does not un-complete its bookings** (the cascade
   only advances PLANNED→ACTIVE). *Rec:* accept as-is, or add a re-open cascade if desired.
4. **Dual path to PAID/INVOICED.** `INVOICED→PARTIALLY_PAID/PAID` is also a *manual*
   transition, even though payments normally drive it via `applyFinanceStatus`. Harmless
   (forward-only), but a user could hand-advance a job's finance status without a matching
   payment. *Rec:* consider restricting the finance statuses to the event-driven path only.
5. **ON_HOLD has no "hold" concept for bookings** (no ON_HOLD assignment status), so putting
   a job on hold leaves its bookings unchanged — acceptable.
6. **Terminal states** (CLOSED, CANCELLED) correctly have no exits; `actual*Date` stamps are
   write-once. ✅

## 5. Status ↔ related-record consistency (verified)
- Job status ↔ **bookings**: now cascaded (this change) — smoke-tested ACTIVE and CANCELLED.
- Job status ↔ **invoices/PO/payments**: driven atomically by `applyFinanceStatus`
  (INV-X-2/X-3) — a job's finance status only moves via those events, never ad-hoc writes.
- Every transition is audited + history-logged (INV-DX-2).
