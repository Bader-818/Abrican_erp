# 12 — Glossary

[← Self-Quiz](11-self-quiz.md) · [Index](README.md)

---

Every domain and technical term used in this book, in one place.

## Business / domain

| Term | Meaning |
|---|---|
| **Abrican** | The company: a Saudi oil-&-gas / industrial-services contractor and Aramco vendor. |
| **Aramco** | Saudi Aramco — the primary enterprise client; drives many compliance requirements. |
| **Aramco sticker** | Gate pass sticker allowing a vehicle onto Aramco sites; tracked with an expiry (`aramcoStickerExpiry`). |
| **Job** | One real operational engagement for a client — the central object of the system. |
| **Job-to-cash** | The end-to-end chain: client → contract → PO → estimate → job → field data → costing → invoice → payment. |
| **Service line** | A category of work Abrican performs (pipeline, coating, mechanical, welding, pigging, etc.). |
| **Rate card** | The agreed price list on a contract (`ContractRateCard`); each line has a fixed selling `unitPrice`. |
| **Purchase Order (PO)** | A client's spending authorisation under a contract (`poValue`); invoices draw down its `consumedAmount`. |
| **Estimate / Quotation** | A priced proposal; when approved it converts into a Job. |
| **Invoice** | A bill to the client; gets an official number and PDF only at issue. |
| **Payment** | Money received against an invoice; full or partial. |
| **AR aging** | Accounts-receivable buckets by how overdue an invoice is (current, 31–60, 61–90, 90+). |
| **Timesheet** | Labour hours (regular/overtime/standby/travel) for an employee or crew on a job. |
| **Daily report** | A per-job field report of work performed, materials, issues, progress. |
| **Expense** | A direct or overhead cost, optionally allocated to a job/resource, with an approval + reimbursement workflow. |
| **Reimbursement** | Paying an employee back for an out-of-pocket (reimbursable) expense. |
| **Costing / profitability** | Computing a job's actual cost (labour + assets + expenses) and gross profit/margin. |
| **Price vs. Cost** | Price = what the client pays (revenue); Cost = what Abrican spends. Profit = price − cost. |
| **Cost rate** | Internal SAR/hour cost of an employee/vehicle/equipment; drives actual cost, never the invoice. |
| **VAT** | Value-Added Tax, 15% in Saudi Arabia, applied per line. |
| **Halala** | 1/100 of a Saudi Riyal (the "cent"); why money is rounded carefully. |
| **SAR** | Saudi Riyal, the system's currency. |
| **ZATCA** | Saudi Zakat, Tax and Customs Authority — the e-invoicing regulator. |
| **ZATCA Phase-1** | The QR-code (TLV) requirement on tax invoices — **implemented**. |
| **ZATCA Phase-2** | Cryptographic stamp + certificate + UBL XML + live Clearance/Reporting API — **not built**. |
| **MVPI / Fahes** | Saudi periodic vehicle inspection; tracked as `inspectionExpiry`. |
| **Operating card (OC)** | A vehicle operating permit; tracked as `operatingCardExpiry`. |
| **PDPL** | Saudi Personal Data Protection Law — governs where real personal data may live. |
| **In-Kingdom residency** | Requirement that (Aramco/PDPL) data be hosted inside Saudi Arabia. |

## Technical

| Term | Meaning |
|---|---|
| **Modular monolith** | One deployable app split into feature modules (not microservices). |
| **NestJS** | The backend framework (DI, guards, interceptors, decorators). |
| **Prisma** | The type-safe ORM + migration tool; generates a typed DB client. |
| **Migration** | A versioned schema change under `backend/prisma/migrations/` (10 total). |
| **Seed** | Idempotent script that loads RBAC + demo data; requires `ADMIN_PASSWORD`. |
| **Gotenberg** | A Chromium-based HTML→PDF microservice sidecar; renders invoices/quotes. |
| **RBAC** | Role-Based Access Control — roles map to permission keys (`entity.action`). |
| **Deny-by-default** | The authz stance: a route with no declared permission is refused. |
| **Guard** | NestJS middleware that allows/denies a request (Throttler, JwtAuth, Permissions, MustChangePassword). |
| **JWT** | JSON Web Token — the signed, short-lived access token. |
| **Access token** | Short-lived (15m) bearer token kept in memory on the client. |
| **Refresh token** | Long-lived (7d) HttpOnly cookie; rotated on use; hash stored, not plaintext. |
| **Token rotation** | Issuing a new refresh token and revoking the old one on each refresh. |
| **Reuse detection** | Detecting a replayed revoked token → revoke the whole family + audit. |
| **TOTP / MFA** | Time-based one-time password (authenticator app) second factor, via `otplib`. |
| **Account lockout** | 5 failed logins → locked ~15 minutes. |
| **CAS (compare-and-swap)** | Concurrency guard: update only if a field still equals its observed value, else retry. Used for payments + invoice issue. |
| **Decimal-as-string** | Prisma serialises money `Decimal` as a JSON string to avoid float error. |
| **round2** | Server-side 2-dp rounding that adds `Number.EPSILON` to dodge `1.005 → 1.00`. |
| **IStorageService** | Interface abstracting file storage (local FS today, S3-swappable). |
| **TanStack Query** | Frontend server-state cache (fetch/cache/invalidate). |
| **React Hook Form + Zod** | Frontend form state + schema validation (mirrors backend rules). |
| **Same-origin** | Prod serves SPA and proxies `/api` from one host, so cookies just work. |
| **Caddy** | Reverse proxy / TLS terminator; here with an internal CA + subnet allowlist. |
| **WireGuard** | The VPN that lets remote staff reach the on-prem app. |
| **Hyper-V** | Windows' hypervisor; used to run the Ubuntu VM that hosts the Linux stack. |
| **Consistency audit** | `npm run audit:consistency` — static RBAC/enum/decimal/pagination/audit checks. |
| **e2e / unit test** | End-to-end (real HTTP + DB) vs. isolated (mocked Prisma) tests. |
| **CI** | GitHub Actions pipeline that builds + tests (exists, not gating). |

---

[← Self-Quiz](11-self-quiz.md) · [Index](README.md)
