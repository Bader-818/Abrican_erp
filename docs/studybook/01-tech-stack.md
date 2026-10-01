# 01 — Tech Stack & Languages

[← The Idea](00-the-idea.md) · [Index](README.md) · [Next: Architecture →](02-architecture.md)

---

## The one-line answer

**It's TypeScript end-to-end.** The backend is **NestJS 11 + Prisma 5 +
PostgreSQL 16**; the frontend is **React 19 + Vite 8 + Tailwind v4**. There is no
Python, Java, Go, or PHP anywhere — one language, two runtimes (Node on the
server, the browser on the client). That's a deliberate choice: a solo developer
can move between front and back without a mental-context switch, and types can be
mirrored on both sides.

Everything below is taken directly from `backend/package.json` and
`frontend/package.json`.

---

## Backend stack

**Language:** TypeScript `^5.1.3` (compiles to CommonJS, target ES2021), on Node 20.

| Concern | Library (version) | Why it's here |
|---|---|---|
| Framework | `@nestjs/common` / `@nestjs/core` **11.1.26** | Opinionated, modular Node framework — DI, guards, interceptors, decorators. Gives structure a monolith needs. |
| HTTP platform | `@nestjs/platform-express` 11 | Express under the hood. |
| ORM & migrations | `@prisma/client` + `prisma` **5.20.0** | Type-safe DB access; schema-first migrations; the generated client gives autocompletion for every model. |
| Database | **PostgreSQL 16** (via Docker) | Relational integrity, `Decimal` money type, JSON columns for audit diffs. |
| Config | `@nestjs/config` 4 | Loads `.env`, global. |
| Auth (tokens) | `@nestjs/jwt` 11, `passport-jwt` 4, `@nestjs/passport` 11, `passport` 0.7 | JWT access tokens + a Passport strategy that validates them. |
| Password hashing | `bcrypt` **6** | One-way hashing of passwords. |
| MFA / TOTP | `otplib` **12** | Time-based one-time passwords (Google Authenticator style). |
| Validation | `class-validator` 0.14 + `class-transformer` 0.5 | DTO validation via decorators; a global `ValidationPipe` whitelists and transforms input. |
| Rate limiting | `@nestjs/throttler` **6.5** | Global 120 req/60s throttle; tighter limits on costly endpoints. |
| Scheduling | `@nestjs/schedule` **6.1** | The daily finance-alert cron sweep. |
| Security headers | `helmet` 7 | HSTS, CSP, X-Frame-Options, etc. |
| Cookies | `cookie-parser` 1.4 | Reads the HttpOnly refresh-token cookie. |
| File upload | `multer` **2.2** (pinned via `overrides`) | Multipart uploads (receipts, documents). |
| PDF (legacy) | `pdfkit` 0.15 | Original PDF path; **now superseded** by Gotenberg (still a dep). |
| QR codes | `qrcode` 1.5 | ZATCA Phase-1 QR on tax invoices. |
| API docs | `@nestjs/swagger` 11 | OpenAPI UI — **disabled in production** (pentest P-04). |
| Testing | `jest` 29 + `supertest` 7 | Unit tests (mocked Prisma) + e2e (real HTTP). |

**PDF rendering (important nuance):** invoices/quotations are rendered as
**HTML** and converted to PDF by a **Gotenberg** sidecar (a Chromium-based
HTML→PDF microservice, `gotenberg/gotenberg:8`), reached at
`GOTENBERG_URL` (default `http://gotenberg:3000`). `pdfkit` is still in the
dependency list but is no longer the rendering path. Gotenberg needs outbound
access to **Google Fonts** to render Arabic.

**Key npm scripts (`backend/`):**
```
npm run start:dev        # watch mode
npm run build            # nest build → dist/
npm test                 # jest unit tests (no DB needed, Prisma mocked)
npm run test:e2e         # e2e against a real Postgres
npm run audit:consistency# static consistency audit (RBAC/enum/decimal/pagination/audit)
```

---

## Frontend stack

**Language:** TypeScript `~6.0.2`, built by **Vite 8**.

| Concern | Library (version) | Why it's here |
|---|---|---|
| UI framework | `react` / `react-dom` **19.2.6** | The SPA. |
| Build tool | `vite` **8.0.12** + `@vitejs/plugin-react` 6 | Fast dev server + bundler. Dev server on `:5173`, proxies `/api` to the backend. |
| Routing | `react-router-dom` **6.28** | Client-side routes; every protected route is permission-gated. |
| Styling | `tailwindcss` **4.0** (+ `@tailwindcss/vite`) | Utility-first CSS; theme tokens in `src/index.css`. |
| Component primitives | **Radix UI** (`@radix-ui/react-*` — dialog, select, tabs, dropdown, popover, checkbox, avatar, label, slot) | Accessible headless primitives, wrapped shadcn-style in `src/components/ui/`. |
| Variant styling | `class-variance-authority` 0.7, `clsx` 2, `tailwind-merge` 2.5 | Compose Tailwind class variants (`cn()` helper). |
| Server state | `@tanstack/react-query` **5.62** | Fetching/caching/invalidation — the app's data layer. |
| Tables | `@tanstack/react-table` **8.20** | Headless table model behind `DataTable.tsx`. |
| HTTP client | `axios` **1.7** | The API client, with auth + refresh interceptors. |
| Forms | `react-hook-form` **7.54** + `zod` 3.24 + `@hookform/resolvers` 3.9 | Typed forms with Zod schema validation (mirrors backend rules). |
| Charts | `recharts` 2.15 **and** hand-rolled SVG (`components/charts.tsx`) | Donuts, bars, utilization meters. Many dashboard charts are custom SVG, not a library. |
| Icons | `lucide-react` 0.468 | Icon set used in nav + badges. |
| Toasts | `sonner` 1.7 | Success/error notifications. |
| Dates | `date-fns` 4.1 | Formatting + relative times. |
| Fonts | `@fontsource-variable/inter` 5.2 | Inter, bundled offline (not a CDN link). |
| Testing | `vitest` **3.2** | Unit tests for formatters, charts, job-status, api-error. |

**Key npm scripts (`frontend/`):**
```
npm run dev      # vite dev server on :5173
npm run build    # tsc -b && vite build → dist/
npm test         # vitest run
npm run lint     # eslint
```

---

## Infra & tooling (not application code)

| Tool | Role |
|---|---|
| **Docker Compose** | Runs the whole stack (db, backend, frontend, gotenberg) with one command. Three compose files: dev, prod, and a self-hosting TLS overlay. |
| **Gotenberg 8** | HTML→PDF sidecar (see above). |
| **Caddy 2** | Reverse proxy / TLS terminator for the self-hosted deployment (internal CA + subnet allowlist). |
| **nginx** | Serves the built SPA and proxies `/api` to the backend in the production image (same-origin). |
| **GitHub Actions** | CI pipeline (build + test both apps). Exists but does **not** gate merges — see [`08-testing-quality.md`](08-testing-quality.md). |
| ESLint + Prettier | Linting/formatting on both sides. |

For *how* these fit together at runtime, continue to
[`02-architecture.md`](02-architecture.md).

---

[← The Idea](00-the-idea.md) · [Index](README.md) · [Next: Architecture →](02-architecture.md)
