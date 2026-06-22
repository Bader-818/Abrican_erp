# Abrican ERP — Per-Role Smoke Matrix

Manual verification checklist complementing the automated RBAC e2e tests. For each seeded
role, log in (admin can create a throwaway user per role) and confirm the **can** actions
succeed and the **must-not** actions return 403 / are absent from the UI. Tick when verified.

> Gotchas: clear admin MFA before testing; login throttle is 5/min; run against the dev
> stack (`docker compose up`). Roles & grants source: `backend/prisma/seed.ts`.

| Role | Can (spot-check) | Must NOT (expect 403 / hidden) |
|------|------------------|-------------------------------|
| **Admin** | Everything: users/roles, all finance, all ops, audit logs | — (full access) |
| **CEO/GM** | View all ops + finance dashboards; **override** job status; approve estimates/invoices | Create/edit clients, jobs, invoices; record payments; manage users |
| **Operations Manager** | Manage clients/contracts/POs/jobs/crews/assignments; manage estimates; manage+approve daily-reports/timesheets/expenses | Approve estimates/invoices; record payments; manage users/roles |
| **Finance Manager** | Manage+approve estimates/invoices; record payments; manage+approve+post+reimburse expenses; finance dashboard | Manage jobs/assignments; change job status; manage users |
| **Accountant** | View estimates; manage invoices; record payments; manage expenses (not approve) | Approve estimates/invoices; **approve/post/reimburse** expenses; manage jobs |
| **Field Supervisor** | View jobs/resources; manage documents; manage daily-reports/timesheets; manage expenses (submit) | **Approve** anything; record payments; see finance dashboard; manage clients/jobs |
| **Maintenance Manager** | Manage vehicles/equipment; override assignments; ops/assets dashboards | Finance modules entirely; manage clients/jobs/users |
| **HR/Admin Officer** | View users; manage employees/crews; manage documents | Finance modules; jobs/assignments manage; roles |
| **Procurement Officer** | View clients/contracts/jobs; manage POs; manage documents | All finance value chain; jobs manage; users |
| **Viewer/Auditor** | Read-only across ops + finance + audit logs | **Any** create/edit/approve/delete (all mutations 403) |

## Cross-cutting smoke (any role with the right perms)
- [ ] **Self-approval block**: a user submits an expense, then cannot approve/post it (403); a second user can.
- [ ] **Approved record lock**: edit an APPROVED timesheet/expense/daily-report → 409.
- [ ] **PO overrun**: issue an invoice exceeding PO balance → blocked unless `invoices.approve` + reason.
- [ ] **Close gate**: a job cannot reach CLOSED unless paid (or override).
- [ ] **MFA**: enable TOTP, log out, password-only login returns `mfaRequired`, TOTP completes it.
- [ ] **Force password change**: admin resets a user → that user is boxed to the change-password screen until done.
- [ ] **Dropdowns populate**: every create form's resource pickers load (pagination `pageSize: 100`).

## Full job-to-cash walkthrough (Operations Mgr + Finance Mgr)
- [ ] Create client/contract (+rate card)/PO → estimate from rate card → generate quotation PDF → approve → convert to job (jobValue copied).
- [ ] Assign resources; log + approve a timesheet; post an approved expense to the job.
- [ ] Complete the job → invoice from estimate (edit actuals) → issue (VAT + PO checks, PDF, job → INVOICED).
- [ ] Record partial payment (→ PARTIALLY_PAID) then the balance (→ PAID); job mirrors status; appears correctly in AR aging.
