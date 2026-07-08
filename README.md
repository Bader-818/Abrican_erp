# Abrican ERP

An operations-to-finance ERP for Abrican (oil & gas / industrial services),
built around the **Job** lifecycle:

```
Client → Contract → Purchase Order → Job → Resource Assignment
  → Daily Reports/Timesheets → Expenses → Costing → Invoice → Payment → Job Closure
```

This repository implements **Phase 1: Foundation + Operational Core** —
authentication & RBAC, clients/contracts/POs, jobs & status workflow,
employees/crews/vehicles/equipment, resource assignment & scheduling
(with conflict detection and utilization reporting), document expiry
tracking, audit logging, and operations/asset dashboards. Finance modules
(daily reports, timesheets, expenses, costing, invoicing, payments) are
designed for but deferred to Phase 2.

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the whole system fits together
  (modules, data model, RBAC, auth/session, security, frontend, testing). Start
  here to understand the codebase.
- **[PHASE2.md](PHASE2.md)** — the buildable roadmap for the finance half
  (costing, invoicing, payments): new models, modules, endpoints, permissions,
  and sprint-by-sprint plan.
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — running the production stack and going live.

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | NestJS 11 (TypeScript), modular monolith |
| Frontend | React 19 + Vite + TypeScript, React Router, TanStack Query |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Auth | JWT access + rotating refresh tokens, bcrypt, RBAC (Role ↔ Permission) |
| File storage | Local filesystem behind a swappable `StorageService` |
| Styling | Tailwind CSS + Radix UI primitives |
| Charts | Hand-rolled SVG/CSS (no chart library) |

## Project Structure

```
Abrican-erp-system/
├── docker-compose.yml
├── .env.example
├── backend/    # NestJS API (see backend/README.md... for module layout)
└── frontend/   # React + Vite SPA
```

## Getting Started (Docker, recommended)

1. Copy environment files and adjust secrets/passwords:

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Start the stack:

   ```bash
   docker compose up --build
   ```

   On first run the backend container will:
   - Run Prisma migrations (`prisma migrate deploy`)
   - Seed roles, permissions, and an admin user (`prisma/seed.ts`)
   - Start the API in watch mode

3. Open the apps:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000/api/v1
   - Swagger docs: http://localhost:3000/api/docs

4. Log in with the seeded admin account (from `.env`):
   - Email: `ADMIN_EMAIL` (default `admin@abrican.local`)
   - Password: `ADMIN_PASSWORD` — **required** on a fresh database. The seed
     never generates or defaults a password; it fails with a clear error if
     `ADMIN_PASSWORD` is unset. Store the value privately (password manager).

   The admin is required to set a new password at first login
   (disable only in CI/test environments via `ADMIN_FORCE_PASSWORD_CHANGE=false`).

## Local Development (without Docker)

Requires Node.js 20+ and a local PostgreSQL 16 instance.

```bash
# Backend
cd backend
cp .env.example .env   # set DATABASE_URL to your local Postgres
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Running Tests

```bash
cd backend  && npx jest      # backend unit tests (mocked Prisma, no DB)
cd frontend && npm test      # frontend unit tests (vitest)

# Backend end-to-end (needs the dev Postgres up on :5434):
cd backend && DATABASE_URL="postgresql://abrican:abrican_dev_password@localhost:5434/abrican_erp?schema=public" \
  JWT_ACCESS_SECRET=e2e JWT_REFRESH_SECRET=e2e npm run test:e2e
```

See [ARCHITECTURE.md](ARCHITECTURE.md#15-testing-strategy) for the full testing strategy.

## Roadmap

- **Phase 1 (this repo)**: Foundation, RBAC, clients/contracts/POs, jobs &
  status workflow, resources (employees/crews/vehicles/equipment),
  assignments/scheduling/conflicts/utilization, documents & expiry,
  operations/assets dashboards, audit log.
- **Phase 2 — Finance** (planned; full plan in **[PHASE2.md](PHASE2.md)**). Sequenced
  around the core *estimate → invoice → payment* flow first, with profit/costing layered
  in after:
  - **S7** Job estimation & quotation (price from contract rate card, quotation PDF,
    estimate → job order) — ✅ **built**
  - **S8** Invoicing (built from the estimate's actual quantities, 15% VAT,
    PO-balance validation, PDF, ZATCA-ready fields; sets job `INVOICED`) — ✅ **built**
  - **S9** Payments & receivables (full/partial, AR aging, auto invoice/job status) — ✅ **built**
  - **S10** Daily reports & timesheets (approval workflow; feeds invoice actuals + costing) — ✅ **built**
  - **S11** Expenses (categories, multi-allocation, receipts, approve/post, employee
    reimbursement worklist) — ✅ **built**
  - **S12** Job costing & profitability — *the profit feature* (actual cost, gross margin,
    estimate-vs-actual; wires `COSTING_REVIEW`/`READY_FOR_INVOICE`)
  - **S13** Finance dashboard & reports (revenue/expense/profit KPIs, aging, unbilled,
    VAT, collection)
- **Phase 3**: Live ZATCA/Fatoora e-invoicing, maintenance management, procurement,
  inventory, full reporting/analytics suite (incl. dashboard export).
