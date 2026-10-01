# 08 — Testing & Quality Gates

[← Edge Cases](07-edge-cases.md) · [Index](README.md) · [Next: Deployment →](09-deployment.md)

---

The code's trustworthiness rests on three test suites, a static consistency audit, and
a set of audit documents. This is the safety net you inherited — know how to run it.

## 1. The three test suites

| Suite | Tool | Count | Where | Needs a DB? |
|---|---|---|---|---|
| Backend unit | Jest | **212** (32 files) | `backend/src/**/*.spec.ts` | No — Prisma is mocked |
| Backend e2e | Jest + Supertest | **34** (3 files) | `backend/test/*.e2e-spec.ts` | **Yes** — real Postgres |
| Frontend unit | Vitest | **28** (4 files) | `frontend/src/**/*.test.ts` | No |

All green as of the last audit (2026-07-19).

**Run them:**
```bash
# backend unit (fast, no DB)
cd backend && npx jest

# backend e2e (needs the dev Postgres up on :5434)
cd backend && DATABASE_URL="postgresql://abrican:abrican_dev_password@localhost:5434/abrican_erp?schema=public" \
  JWT_ACCESS_SECRET=e2e JWT_REFRESH_SECRET=e2e npm run test:e2e

# frontend unit
cd frontend && npm test
```

**What they cover:** unit tests hit every service (auth, jobs, estimates, invoices,
payments, costing, expenses, timesheets, …) with a mocked Prisma; e2e drives real HTTP
through login, RBAC, and the full estimate→invoice→payment chain; frontend tests cover
formatters, the charts library, job-status labels, and API error mapping.

**e2e hygiene:** the suite self-cleans, resets a dedicated `e2e-admin@abrican.local`
(never the human admin), and creates future-dated rows it deletes in `afterAll` — an
interrupted run may leave 2030-dated rows that 409 the next run until it self-heals.

---

## 2. The consistency audit (the unusual one)

`npm run audit:consistency` (backend) runs a **static** cross-check that ordinary tests
can't, and regenerates [`../audit/CONSISTENCY-REPORT.md`](../audit/CONSISTENCY-REPORT.md).
Five checks, currently **0 findings**:

1. **RBAC triangle** — permissions required by code = seeded = granted to roles = known
   to the frontend. Catches orphan permissions or a route needing a permission that
   doesn't exist. (51 permissions.)
2. **Enum parity** — every Prisma enum has a matching TypeScript union in
   `frontend/types/index.ts`. They can't drift.
3. **Decimal parity** — frontend money fields aren't typed as `number` where the
   backend sends a `Decimal` string (prevents float bugs).
4. **Pagination cap** — no `pageSize` literal above 100 (the API max).
5. **Audit coverage** — mutations are recorded in the audit log.

Run this after any change to permissions, enums, or money fields — it's the cheapest way
to catch a whole class of drift bugs.

---

## 3. Audit artifacts (`docs/audit/`)

| File | What it is |
|---|---|
| [`INVARIANTS.md`](../audit/INVARIANTS.md) | The logic oracle — ~85 numbered invariants (INV-D1-1 … INV-X-5) the system must always uphold. The checklist behind tests and reviews. |
| [`FINDINGS.md`](../audit/FINDINGS.md) | The discrepancy register — F-001…F-012, **all resolved** (orphan permission, stale snapshot, document-numbering, finance races, seed crash, self-approval, invoice numbering). |
| [`PENTEST.md`](../audit/PENTEST.md) | Penetration test — 8 findings (2 HIGH), **all fixed 2026-07-02**, no CRITICALs. |
| [`SMOKE-MATRIX.md`](../audit/SMOKE-MATRIX.md) | Per-role manual checklist ("can" / "must not") + a full job-to-cash walkthrough. |
| [`JOB-LIFECYCLE.md`](../audit/JOB-LIFECYCLE.md) | Full review of the job state machine. |
| [`CONSISTENCY-REPORT.md`](../audit/CONSISTENCY-REPORT.md) | Auto-generated output of the audit above. |

---

## 4. CI — exists, but doesn't gate

`.github/workflows/ci.yml` runs on push/PR:
- **Backend job:** spin up Postgres → `prisma generate` → `migrate deploy` → seed →
  build → `jest` → `test:e2e` → advisory `npm audit` (non-blocking).
- **Frontend job:** `npm ci` → build → `vitest` → advisory `npm audit`.

**Important limitation:** the pipeline runs but is **not configured to block merges** —
a red build won't stop a merge today. Wiring it as a required check is on the
production-readiness list ([`10-concerns-risks.md`](10-concerns-risks.md)). The
transitive `esbuild`/vite/vitest advisories are dev-tooling only (not in the shipped
bundle) and are deliberately deferred.

---

[← Edge Cases](07-edge-cases.md) · [Index](README.md) · [Next: Deployment →](09-deployment.md)
