# 11 — Questions To Ask Yourself

[← Concerns & Risks](10-concerns-risks.md) · [Index](README.md) · [Next: Glossary →](12-glossary.md)

---

Use this to test whether the system is actually back in your head. Try to answer each
before expanding the reasoning. Answers are grounded in the earlier chapters — the link
tells you where to re-read if you blank.

> Tip: cover the answers and go top-to-bottom. If you miss three in a section, re-read
> that chapter before moving on.

## A. The idea & shape

<details><summary><b>1. In one sentence, what is Abrican ERP and who is it for?</b></summary>

An operations-to-finance ERP for **Abrican**, a Saudi oil-&-gas / industrial-services
contractor (an Aramco vendor), replacing spreadsheets with one source of truth. → [00](00-the-idea.md)
</details>

<details><summary><b>2. What is the single central object, and what chain runs through it?</b></summary>

The **Job**. The job-to-cash chain: Client → Contract (+rate card) → PO → Estimate →
**Job** → Assignments/Reports/Timesheets/Expenses → Costing → Invoice → Payment → Close. → [00](00-the-idea.md)
</details>

<details><summary><b>3. What language is the system written in? Any others?</b></summary>

**TypeScript end-to-end** — Node (NestJS) on the server, React in the browser. No other
language. → [01](01-tech-stack.md)
</details>

## B. Architecture

<details><summary><b>4. Monolith or microservices? Why?</b></summary>

A **modular monolith** — one NestJS process, many feature modules, one DB. Chosen for a
solo dev + bounded domain: structure without microservice ops overhead. → [02](02-architecture.md)
</details>

<details><summary><b>5. Name the four global guards in order.</b></summary>

Throttler → JwtAuth → **Permissions (deny-by-default)** → MustChangePassword. → [02](02-architecture.md)
</details>

<details><summary><b>6. What does "deny-by-default" mean for a new route?</b></summary>

A route that declares no `@Public`/`@AuthOnly`/`@RequirePermissions` is **refused** — you
can't accidentally ship an unguarded endpoint. → [02](02-architecture.md) / [04](04-auth-security.md)
</details>

<details><summary><b>7. Where does the access token live on the client, and why not localStorage?</b></summary>

**In memory**; the refresh token is an HttpOnly cookie. Keeps the access token out of
reach of XSS. → [02](02-architecture.md) / [04](04-auth-security.md)
</details>

## C. Data model

<details><summary><b>8. How many models, enums, migrations?</b></summary>

**29 models, 27 enums, 10 migrations.** → [03](03-data-model.md)
</details>

<details><summary><b>9. Why is money a string on the wire? How is it rounded server-side?</b></summary>

It's PostgreSQL `Decimal`, serialised as a **string** to avoid float error; the frontend
converts with `Number()` only for display. Server math uses `round2()` with
`Number.EPSILON`. → [03](03-data-model.md) / [06](06-finance.md)
</details>

<details><summary><b>10. Explain price vs. cost and where each lives.</b></summary>

**Price** = what the client pays (`ContractRateCard.unitPrice`, invoice/estimate
`unitPrice`, `jobValue`) → revenue. **Cost** = what Abrican spends
(`Employee/Vehicle/Equipment.costRate`, posted expenses) → `actualCost`. Profit = price −
cost. → [03](03-data-model.md)
</details>

<details><summary><b>11. What is the polymorphic "exactly one of" pattern, and how is it enforced?</b></summary>

`JobAssignment` / `Document` carry several nullable FKs + a type enum; exactly one FK is
set. Enforced by **DB CHECK constraints**, not just app code. → [03](03-data-model.md) / [07](07-edge-cases.md)
</details>

## D. Auth & security

<details><summary><b>12. Walk through what happens when a stolen (revoked) refresh token is replayed.</b></summary>

Reuse detection fires: the **entire token family** is revoked, a
`TOKEN_REUSE_DETECTED` audit entry is written, and a notification is raised. → [04](04-auth-security.md)
</details>

<details><summary><b>13. What does login return when MFA is enabled but no code was sent?</b></summary>

**HTTP 200** with `{ mfaRequired: true }` and **no tokens**; the client then re-submits
with the TOTP code. → [04](04-auth-security.md)
</details>

<details><summary><b>14. How many permissions and roles? What's the RBAC "triangle"?</b></summary>

**51 permissions, 10 roles.** The triangle: permissions required by code = seeded =
granted to roles = known to the frontend — proven by the consistency audit. → [04](04-auth-security.md) / [08](08-testing-quality.md)
</details>

## E. Operations

<details><summary><b>15. Which job statuses can a user NOT set manually, and why?</b></summary>

`COSTING_REVIEW`, `READY_FOR_INVOICE`, `INVOICED`, `PARTIALLY_PAID`, `PAID` — they're
event-driven (costing/invoice/payment) via the blocklist, so finance state stays
honest. → [05](05-operations-core.md) / [07](07-edge-cases.md)
</details>

<details><summary><b>16. What happens when you assign a resource that's already booked in that window?</b></summary>

409 conflict — unless you supply an `overrideReason` and hold `assignments.override`, in
which case it's allowed and **audited**. → [05](05-operations-core.md)
</details>

## F. Finance

<details><summary><b>17. When exactly is an official invoice number assigned, and why then?</b></summary>

**At issue** (`APPROVED → SUBMITTED`), never at draft — so deleted drafts leave no gap in
the legal/ZATCA numbering (F-012). → [06](06-finance.md) / [07](07-edge-cases.md)
</details>

<details><summary><b>18. Name the five things the invoice-issue transaction does.</b></summary>

Validate client VAT → check/draw down PO balance (override if over) → assign
`INV-YYYY-####` → advance Job to INVOICED → render + store the immutable PDF (with ZATCA
QR). → [06](06-finance.md)
</details>

<details><summary><b>19. What three sources feed a job's actual cost?</b></summary>

Approved **timesheets** (hours × cost rate, OT/standby/travel weighted), vehicle/equipment
**assignment hours** × cost rate, and **posted expenses** by category. → [06](06-finance.md)
</details>

<details><summary><b>20. How is a job's revenue basis chosen for margin?</b></summary>

Invoiced subtotal (ex-VAT) if the job has issued invoices; otherwise `jobValue` (quoted);
otherwise none. → [06](06-finance.md)
</details>

## G. Edge cases

<details><summary><b>21. How are two simultaneous payments prevented from over-paying an invoice?</b></summary>

A **compare-and-swap** on `invoice.paidAmount` — the second update matches 0 rows and
retries. → [07](07-edge-cases.md)
</details>

<details><summary><b>22. Can you approve your own timesheet/expense? What about as Admin?</b></summary>

No — self-approval throws **403 for everyone, including Admin** (separation of duties,
SRS 168). → [07](07-edge-cases.md)
</details>

<details><summary><b>23. Two dev traps that will waste your time. Name them.</b></summary>

Dev Postgres is on port **5434** (not 5432); after a schema change you must
`prisma generate` + restart **inside the container** (node_modules is a volume). Also:
never log in as the live `admin@abrican.local` in scripts. → [07](07-edge-cases.md)
</details>

## H. Quality & deployment

<details><summary><b>24. What are the three test suites and their counts?</b></summary>

Backend unit **212** (Jest, mocked Prisma), e2e **34** (needs Postgres), frontend **28**
(Vitest). Plus a static consistency audit (0 findings). → [08](08-testing-quality.md)
</details>

<details><summary><b>25. What's the one deployment fact that will silently break PDFs?</b></summary>

The **base prod compose omits Gotenberg** — you must include the self-hosting overlay
(`-f deploy/docker-compose.tls.yml`) or PDFs fail. → [09](09-deployment.md)
</details>

<details><summary><b>26. Why can't the app run directly on the Windows Server 2019 host?</b></summary>

The stack is **Linux containers**; Windows Server 2019 can't run them reliably (no Docker
Desktop, shaky WSL2). Plan: a **Hyper-V Ubuntu 24.04 VM**, then the self-hosting runbook. → [09](09-deployment.md)
</details>

<details><summary><b>27. What are the top three risks right now?</b></summary>

No real UAT; the data model trails real artifacts; backups untested (and never
deployed). → [10](10-concerns-risks.md)
</details>

<details><summary><b>28. What must NEVER go on the Sydney Supabase UAT DB, and why?</b></summary>

**Real client/employee data** — PDPL + Aramco in-Kingdom residency. Synthetic data
only. → [10](10-concerns-risks.md)
</details>

---

[← Concerns & Risks](10-concerns-risks.md) · [Index](README.md) · [Next: Glossary →](12-glossary.md)
