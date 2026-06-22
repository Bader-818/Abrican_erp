# Software Requirements Specification (SRS) and AI Build Prompt
# Abrican ERP System — Operations, Utilization, Costing, Invoicing, and Finance Diagnostics

**Document Version:** 1.0  
**Prepared For:** Abrican  
**Prepared By:** Bader / AI Assistant  
**Date:** 2026-06-11  
**Purpose:** This document is both a formal Software Requirements Specification (SRS) and a complete implementation prompt for another AI/software agent to design, plan, and build an ERP system for Abrican.

---

## 1. Executive Summary

Abrican needs a custom ERP system focused on operational visibility, resource utilization, job costing, expense control, invoicing, and company financial diagnostics.

The system should be built around one central business object: **Job**.

A Job represents a real operational engagement performed for a client such as Aramco or another industrial/oil-and-gas customer. Every major ERP function should connect back to a Job where applicable:

```text
Client → Contract → Purchase Order → Job → Resource Assignment → Daily Reports / Timesheets → Expenses → Costing → Invoice → Payment → Job Closure
```

The goal is not only to store data. The goal is to help management diagnose company status:

- Which jobs are active?
- Which jobs are delayed?
- Which crews, vehicles, and equipment are utilized or idle?
- Which jobs are profitable?
- Which jobs are losing money?
- Which invoices are unpaid?
- Which completed jobs have not been invoiced?
- Which costs are increasing?
- Which client or service line creates the most revenue and profit?
- Which documents, licenses, or certificates are close to expiry?
- Which resources are causing downtime or excessive maintenance cost?

The ERP must function as an **operations-to-finance control system**, not only an accounting system.

---

## 2. Product Vision

Build an internal ERP platform for Abrican that gives management, operations, and finance one source of truth for:

1. Active and historical jobs.
2. Crew/team/vehicle/equipment utilization.
3. Job costing and profitability.
4. Expense breakdown.
5. Contract and PO tracking.
6. Invoice creation, approval, and payment tracking.
7. Financial health dashboards.
8. Operational alerts and compliance reminders.
9. Reports for management decision-making.

The system should support future growth, including possible ZATCA e-invoicing integration, Aramco/SAP/supplier portal export workflows, Power BI integration, and accounting system integration.

---

## 3. Business Context

Abrican operates in oil-and-gas/industrial services. The company may perform field jobs involving crews, vehicles, equipment, materials, and client approvals. The company needs strong control over job execution, operational cost, and invoicing.

Typical service lines may include, but are not limited to:

- Nitrogen services.
- Cementing services.
- Hydro-testing.
- Chemical injection.
- Manpower/service crew jobs.
- Equipment-supported field work.
- Maintenance/service operations.

Primary customers may include large enterprise clients such as Aramco.

---

## 4. Scope

### 4.1 In Scope

The ERP should include:

1. Executive dashboard.
2. Job management.
3. Client management.
4. Contract management.
5. Purchase Order (PO) management.
6. Crew and employee management.
7. Vehicle management.
8. Equipment management.
9. Resource scheduling and utilization.
10. Daily reports and timesheets.
11. Expense management.
12. Job costing and profitability.
13. Invoicing.
14. Payment and receivables tracking.
15. Procurement.
16. Inventory/spare parts.
17. Maintenance management.
18. Document expiry and compliance tracking.
19. Reports and analytics.
20. Approval workflows.
21. Audit logs.
22. Notifications.
23. User roles and permissions.
24. File/document attachments.
25. Export to PDF/Excel/CSV.
26. Future integration readiness.

### 4.2 Out of Scope for MVP

The following should not be built in the first MVP unless explicitly requested:

1. Full payroll.
2. Full accounting general ledger.
3. Complex tax filing automation.
4. Direct Aramco portal automation/login scraping.
5. Full mobile app.
6. AI forecasting or predictive analytics.
7. Multi-company/multi-tenant SaaS features.
8. Advanced supply chain forecasting.
9. IoT tracking.
10. Fleet GPS live tracking.

However, the system architecture should allow these to be added later.

---

## 5. Core Design Principle

The system must be designed around the operational and financial lifecycle:

```text
Field work creates operational records.
Operational records create costs.
Approved work supports invoices.
Invoices create receivables.
Payments close the financial loop.
Dashboards diagnose the business.
```

Every module should reduce manual Excel work and improve management visibility.

---

## 6. Target Users and Roles

### 6.1 User Roles

| Role | Description |
|---|---|
| System Admin | Full system configuration and user management. |
| CEO / General Manager | View all dashboards, approve major workflows, view financial status. |
| Operations Manager | Manage jobs, crews, vehicles, equipment, assignments, and daily execution. |
| Finance Manager | Manage invoices, payments, expenses, receivables, financial reports. |
| Accountant | Create invoice drafts, record expenses, update payment status. |
| Field Supervisor | Submit daily reports, timesheets, equipment usage, job progress. |
| Maintenance Manager | Manage vehicles/equipment maintenance and downtime. |
| HR/Admin Officer | Manage employee details, availability, documents, certificates. |
| Procurement Officer | Manage purchase requests, supplier POs, received goods/services. |
| Viewer/Auditor | Read-only access to permitted dashboards/reports. |

### 6.2 Permission Principles

- Field users should not see sensitive company-wide financial data unless explicitly permitted.
- Finance users should not alter operational daily reports unless permitted.
- Operational users should not approve their own expenses unless allowed by policy.
- Every critical update must be audit-logged.
- Role-based access control (RBAC) is required.

---

## 7. High-Level System Architecture

### 7.1 Recommended Architecture

Use a **modular monolith** first, not microservices.

Reason:
- Easier to build.
- Easier to maintain.
- Easier for internal ERP workflows.
- Lower DevOps complexity.
- Still modular enough to scale later.

### 7.2 Suggested Technology Stack

| Layer | Recommended Technology |
|---|---|
| Frontend | React or Next.js |
| Backend | NestJS or Laravel |
| Database | PostgreSQL |
| ORM | Prisma if using NestJS/Node |
| Authentication | JWT/session-based auth with RBAC |
| File Storage | S3-compatible storage, Supabase Storage, or local object storage |
| Deployment | Docker |
| Reports | Built-in reports + PDF/Excel export |
| Dashboards | React charts or BI-ready API |
| Audit Logs | Database-backed audit trail |
| Notifications | In-app notifications and optional email |
| Integrations | ZATCA adapter, accounting integration, portal export helpers |

### 7.3 Architecture Diagram

```text
Web Browser
    ↓
Frontend App
    ↓
Backend API
    ↓
Application Services / Modules
    ↓
PostgreSQL Database
    ↓
File Storage
    ↓
External Integrations
        - ZATCA / Fatoora
        - Accounting System
        - Aramco/SAP portal export helper
        - Power BI / Reporting
```

---

## 8. Core Business Entities

The system should include the following main entities:

```text
users
roles
permissions

clients
client_contacts

contracts
contract_rate_cards
purchase_orders

jobs
job_status_history
job_assignments
job_daily_reports
job_timesheets
job_attachments

employees
crews
crew_members

vehicles
equipment
asset_assignments
maintenance_records

expense_categories
expenses
job_costs
supplier_invoices

invoices
invoice_line_items
invoice_attachments
payments
credit_notes
debit_notes

inventory_items
inventory_movements
purchase_requests
supplier_purchase_orders

documents
document_expiry_alerts

audit_logs
notifications
```

---

## 9. Main Module Requirements

---

# 9.1 Executive Dashboard Module

## Purpose

Provide management with a real-time overview of company health.

## Dashboard KPIs

The dashboard must display:

### Operational KPIs

- Active jobs.
- Planned jobs.
- Completed jobs.
- Delayed jobs.
- Jobs on hold.
- Jobs waiting for approval.
- Jobs by client.
- Jobs by service line.
- Jobs by region/location.
- Average job duration.
- Job completion rate.

### Resource Utilization KPIs

- Crew utilization percentage.
- Employee utilization percentage.
- Vehicle utilization percentage.
- Equipment utilization percentage.
- Idle crews.
- Idle vehicles.
- Idle equipment.
- Overbooked resources.
- Equipment under maintenance.
- Vehicle downtime.

### Finance KPIs

- Monthly revenue.
- Monthly expenses.
- Gross profit.
- Gross margin percentage.
- Net profit estimate.
- Unbilled revenue.
- Accounts receivable.
- Overdue invoices.
- Collected payments.
- Pending payments.
- Expense by category.
- Profit by job.
- Profit by client.
- Profit by service line.

### Risk/Alert KPIs

- Expired documents.
- Documents expiring in 30/60/90 days.
- Jobs over budget.
- Jobs below margin target.
- PO balance nearly consumed.
- Invoices overdue.
- Completed jobs not invoiced.
- Resources double-booked.
- Equipment assigned while under maintenance.
- Employees with expired certificates.

## Dashboard Cards

Example cards:

```text
Active Jobs
Monthly Revenue
Monthly Expenses
Gross Margin
Unbilled Revenue
Overdue Invoices
Crew Utilization
Vehicle Utilization
Equipment Utilization
Document Expiry Alerts
```

## Acceptance Criteria

- User can filter dashboard by date range, client, service line, region, and job status.
- Dashboard values must be calculated from real system data, not manual input.
- User can click a KPI card to open the underlying detailed report.
- Management users can export dashboard reports to PDF or Excel.
- Sensitive financial KPIs must only appear to authorized users.

---

# 9.2 Job Management Module

## Purpose

Manage the complete lifecycle of client jobs from creation to closure.

## Job Lifecycle

```text
Request / Opportunity
    ↓
Quotation
    ↓
PO Received
    ↓
Job Created
    ↓
Resources Assigned
    ↓
Execution Started
    ↓
Daily Reports / Timesheets Submitted
    ↓
Costing Reviewed
    ↓
Work Completed
    ↓
Invoice Drafted
    ↓
Invoice Submitted
    ↓
Payment Received
    ↓
Job Closed
```

## Job Statuses

The system should support these statuses:

```text
Draft
Planned
Approved
Scheduled
Active
On Hold
Completed
Costing Review
Ready for Invoice
Invoiced
Partially Paid
Paid
Closed
Cancelled
```

## Job Fields

| Field | Required | Description |
|---|---:|---|
| Job ID | Yes | Auto-generated internal job code. |
| Job Title | Yes | Short description of the job. |
| Client | Yes | Linked client. |
| Contract | Optional/Yes depending on policy | Linked contract. |
| Purchase Order | Optional/Yes depending on policy | Linked PO. |
| Service Type | Yes | Type of service. |
| Region/Location | Yes | Job location. |
| Planned Start Date | Yes | Expected start. |
| Planned End Date | Yes | Expected end. |
| Actual Start Date | No | Set when job starts. |
| Actual End Date | No | Set when job ends. |
| Job Value | Optional | Expected revenue. |
| Cost Budget | Optional | Expected cost. |
| Actual Cost | System calculated | Based on expenses/timesheets/materials. |
| Gross Profit | System calculated | Revenue minus actual cost. |
| Gross Margin % | System calculated | Gross profit divided by revenue. |
| Assigned Crew | Optional | Crew assigned. |
| Assigned Vehicles | Optional | Vehicles assigned. |
| Assigned Equipment | Optional | Equipment assigned. |
| Status | Yes | Current job state. |
| Description/Scope | Optional | Work scope. |
| Attachments | Optional | PO, contract, reports, photos. |
| Invoice Status | System calculated | Not invoiced/draft/submitted/paid. |

## Job Features

- Create, view, update, archive jobs.
- Assign employees, crews, vehicles, and equipment.
- Link jobs to clients, contracts, and POs.
- Attach files and documents.
- View timeline/history of status changes.
- Track planned vs actual dates.
- Track estimated vs actual cost.
- Track invoice and payment status.
- Prevent resource double-booking.
- Prevent assignment of resources under maintenance unless overridden.
- Calculate job profitability.
- Show all expenses linked to the job.
- Show all daily reports and timesheets linked to the job.
- Show all invoices linked to the job.

## Acceptance Criteria

- A job cannot move to “Active” unless required resources are assigned or an authorized override is recorded.
- A job cannot move to “Ready for Invoice” unless required daily reports/timesheets are approved.
- A job cannot be closed unless invoice/payment status rules are satisfied or manager override is used.
- Every job status change must create a job_status_history record.
- Every critical edit must create an audit log.

---

# 9.3 Client Management Module

## Purpose

Store and manage client information.

## Fields

| Field | Description |
|---|---|
| Client ID | Auto-generated. |
| Client Name | Example: Saudi Aramco. |
| Client Type | Government, semi-government, private, contractor, etc. |
| VAT Number | Required for invoicing. |
| CR Number | Commercial registration. |
| Billing Address | Used for invoices. |
| Contact Persons | Finance, operations, procurement contacts. |
| Payment Terms | 30/60/90 days etc. |
| Status | Active/inactive. |
| Notes | Additional info. |

## Features

- Add/edit clients.
- Add multiple contacts per client.
- View all contracts for a client.
- View all POs for a client.
- View all jobs for a client.
- View all invoices and payment status for a client.
- Show profitability by client.
- Show receivables aging by client.

---

# 9.4 Contract Management Module

## Purpose

Manage client contracts and commercial terms.

## Contract Fields

| Field | Description |
|---|---|
| Contract ID | Internal ID. |
| Contract Number | Client/official contract number. |
| Client | Linked client. |
| Title | Contract title. |
| Scope of Work | Description. |
| Start Date | Contract start. |
| End Date | Contract expiry. |
| Contract Value / Ceiling | Maximum allowed value. |
| Consumed Value | Total invoiced/committed so far. |
| Remaining Value | Contract value minus consumed value. |
| Payment Terms | 30/60/90 days etc. |
| Status | Draft, active, expired, closed, terminated. |
| Attachments | Signed contract, amendments, rate sheets. |

## Rate Card Fields

| Field | Description |
|---|---|
| Contract | Linked contract. |
| Service Line | Example: nitrogen service. |
| Item Code | Optional. |
| Description | Service/material description. |
| Unit | Hour, day, trip, meter, unit, etc. |
| Unit Price | Agreed selling price. |
| Currency | SAR default. |
| VAT Applicable | Yes/no. |
| Effective Date | Rate validity. |

## Features

- Track contract validity.
- Track contract consumed amount.
- Track remaining value.
- Store contract attachments.
- Store rate cards.
- Warn when a job/invoice may exceed contract ceiling.
- Warn before contract expiry.
- Link jobs and invoices to contracts.

---

# 9.5 Purchase Order Management Module

## Purpose

Track client POs and prevent overbilling or missing billing.

## PO Fields

| Field | Description |
|---|---|
| PO ID | Internal ID. |
| PO Number | Client PO number. |
| Client | Linked client. |
| Contract | Linked contract. |
| PO Value | Total authorized PO amount. |
| Consumed Amount | Amount already invoiced/allocated. |
| Remaining Amount | PO value minus consumed amount. |
| Currency | SAR default. |
| Issue Date | PO date. |
| Expiry Date | PO expiry. |
| Status | Draft, active, consumed, expired, cancelled. |
| Attachments | PO file. |

## Features

- Link jobs to PO.
- Link invoices to PO.
- Show PO balance.
- Warn when PO balance is low.
- Block invoice submission if invoice exceeds remaining PO amount unless manager override.
- Show PO consumption report.

---

# 9.6 Crew and Employee Management Module

## Purpose

Track field employees, crews, roles, availability, and cost rates.

## Employee Fields

| Field | Description |
|---|---|
| Employee ID | Internal ID. |
| Name | Full name. |
| Role | Operator, driver, supervisor, mechanic, safety officer, etc. |
| Department | Operations, maintenance, finance, admin. |
| Cost Rate | Hourly/daily cost for job costing. |
| Availability Status | Available, assigned, on leave, sick, inactive. |
| Phone | Contact. |
| Email | Optional. |
| Certifications | Safety, technical, client-specific. |
| Documents | Iqama, license, certificates. |
| Status | Active/inactive. |

## Crew Fields

| Field | Description |
|---|---|
| Crew ID | Internal ID. |
| Crew Name | Example: Team A. |
| Supervisor | Employee. |
| Members | List of employees. |
| Service Capability | Nitrogen, cementing, etc. |
| Status | Available, assigned, inactive. |

## Features

- Create crews.
- Assign employees to crews.
- Assign crew to jobs.
- Track employee availability.
- Track employee utilization.
- Prevent double-booking.
- Track documents/certificates expiry.
- Calculate labor cost per job from timesheets.

---

# 9.7 Vehicle Management Module

## Purpose

Track vehicles, assignment, utilization, maintenance, documents, and costs.

## Vehicle Fields

| Field | Description |
|---|---|
| Vehicle ID | Internal ID. |
| Plate Number | Vehicle plate. |
| Vehicle Type | Pickup, truck, tanker, trailer, etc. |
| Make/Model | Optional. |
| Year | Optional. |
| Ownership Type | Owned, leased, rented. |
| Status | Available, assigned, in use, maintenance, out of service. |
| Assigned Job | Current job if any. |
| Odometer | Optional. |
| Fuel Type | Optional. |
| Registration Expiry | Date. |
| Insurance Expiry | Date. |
| Inspection Expiry | Date. |
| Cost Rate | Daily/hourly internal cost. |
| Notes | Optional. |

## Features

- Assign vehicles to jobs.
- Track utilization.
- Track maintenance history.
- Track fuel/maintenance expenses.
- Track downtime.
- Alert before document expiry.
- Prevent assigning vehicles under maintenance unless override.

---

# 9.8 Equipment Management Module

## Purpose

Track equipment assignment, utilization, maintenance, calibration, and cost.

## Equipment Fields

| Field | Description |
|---|---|
| Equipment ID | Internal ID. |
| Equipment Name | Example: Pump skid. |
| Equipment Type | Pump, compressor, testing unit, tank, tool, etc. |
| Serial Number | Optional. |
| Status | Available, assigned, in use, maintenance, out of service. |
| Ownership Type | Owned, leased, rented. |
| Cost Rate | Daily/hourly cost. |
| Current Location | Optional. |
| Calibration Expiry | Date if applicable. |
| Maintenance Due Date | Date. |
| Notes | Optional. |

## Features

- Assign equipment to jobs.
- Track utilization.
- Track downtime.
- Track maintenance cost.
- Track calibration expiry.
- Prevent assignment if out of service or under maintenance unless authorized override.

---

# 9.9 Resource Scheduling and Utilization Module

## Purpose

Schedule crews, employees, vehicles, and equipment against jobs and calculate utilization.

## Core Concepts

Available hours/days should be defined for each resource.

### Utilization Formula

```text
Utilization % = Assigned Time / Available Time × 100
```

### Crew Utilization

```text
Crew Utilization = Assigned/Worked Hours ÷ Available Working Hours × 100
```

### Vehicle Utilization

```text
Vehicle Utilization = Assigned Days ÷ Available Days × 100
```

### Equipment Utilization

```text
Equipment Utilization = Assigned/Used Hours ÷ Available Hours × 100
```

## Assignment Fields

| Field | Description |
|---|---|
| Assignment ID | Internal ID. |
| Job | Linked job. |
| Resource Type | Employee, crew, vehicle, equipment. |
| Resource ID | Linked resource. |
| Start Date/Time | Assignment start. |
| End Date/Time | Assignment end. |
| Planned Hours/Days | Expected usage. |
| Actual Hours/Days | Actual usage. |
| Status | Planned, active, completed, cancelled. |

## Features

- Calendar/scheduler view.
- Assignment conflicts detection.
- Resource availability check.
- Utilization dashboard.
- Idle resource report.
- Overbooked resource report.
- Maintenance conflict report.
- Filter by date range, resource type, location, service line, client.

---

# 9.10 Daily Reports and Timesheets Module

## Purpose

Capture daily execution data from field teams.

## Daily Report Fields

| Field | Description |
|---|---|
| Report ID | Internal ID. |
| Job | Linked job. |
| Date | Report date. |
| Supervisor | Submitted by. |
| Work Performed | Description. |
| Progress % | Optional. |
| Client Representative | Name. |
| Weather/Conditions | Optional. |
| Issues/Delays | Optional. |
| Materials Used | Optional. |
| Equipment Used | Optional. |
| Vehicles Used | Optional. |
| Attachments | Photos, signed reports. |
| Approval Status | Draft, submitted, approved, rejected. |

## Timesheet Fields

| Field | Description |
|---|---|
| Timesheet ID | Internal ID. |
| Job | Linked job. |
| Employee/Crew | Linked employee/crew. |
| Date | Date. |
| Regular Hours | Normal hours. |
| Overtime Hours | Overtime hours. |
| Standby Hours | Standby. |
| Travel Hours | Optional. |
| Approved By | Manager/supervisor. |
| Approval Status | Draft, submitted, approved, rejected. |

## Features

- Field supervisor submits daily report.
- Field supervisor submits employee/crew hours.
- Operations manager approves/rejects reports.
- Approved timesheets feed job costing.
- Approved daily reports support invoice creation.
- Attach signed service reports or ESV/client acceptance documents.

---

# 9.11 Expense Management Module

## Purpose

Capture and classify company expenses and allocate them to jobs/departments/assets where applicable.

## Expense Categories

| Category | Examples |
|---|---|
| Labor Cost | Salaries, overtime, allowances. |
| Vehicle Cost | Fuel, maintenance, rental, insurance. |
| Equipment Cost | Maintenance, spare parts, depreciation, rental. |
| Material Cost | Chemicals, consumables, tools. |
| Subcontractor Cost | Third-party services. |
| Accommodation | Hotels, camps, housing. |
| Transportation | Flights, drivers, logistics. |
| Admin Cost | Office, internet, software, licenses. |
| Government Cost | Iqama, permits, certificates. |
| Finance Cost | Bank fees, VAT, penalties. |

## Expense Fields

| Field | Description |
|---|---|
| Expense ID | Internal ID. |
| Date | Expense date. |
| Vendor/Supplier | Supplier. |
| Category | Expense category. |
| Amount Before VAT | Net amount. |
| VAT Amount | VAT amount if applicable. |
| Total Amount | Gross amount. |
| Currency | SAR default. |
| Job | Optional linked job. |
| Department | Optional linked department. |
| Vehicle | Optional linked vehicle. |
| Equipment | Optional linked equipment. |
| Employee | Optional linked employee. |
| Description | Reason. |
| Receipt/Invoice Attachment | File upload. |
| Approval Status | Draft, submitted, approved, rejected, posted. |

## Features

- Add expense.
- Attach receipt or supplier invoice.
- Allocate expense to job, department, vehicle, or equipment.
- Approve/reject expense.
- View expense breakdown by category.
- View expense breakdown by job.
- View expense breakdown by client.
- View expense breakdown by month.
- Prevent posting expenses without category and amount.
- Flag expenses with no job/department allocation.

---

# 9.12 Job Costing and Profitability Module

## Purpose

Calculate the true cost and profitability of each job.

## Cost Components

Each job cost should include:

```text
Labor Cost
Vehicle Cost
Equipment Cost
Material Cost
Subcontractor Cost
Accommodation Cost
Transportation Cost
Other Direct Cost
Allocated Overhead if required
```

## Job Profitability Formula

```text
Job Revenue
- Labor Cost
- Vehicle Cost
- Equipment Cost
- Material Cost
- Subcontractor Cost
- Other Direct Costs
= Gross Profit
```

```text
Gross Margin % = Gross Profit ÷ Job Revenue × 100
```

## Required Metrics

| Metric | Description |
|---|---|
| Estimated Revenue | Expected job value. |
| Actual Revenue | Invoiced/approved revenue. |
| Estimated Cost | Budget. |
| Actual Cost | Real accumulated cost. |
| Cost Variance | Actual cost minus estimated cost. |
| Gross Profit | Revenue minus actual cost. |
| Gross Margin % | Profitability percentage. |
| Unbilled Revenue | Approved work not yet invoiced. |

## Features

- Cost summary per job.
- Cost breakdown per category.
- Revenue vs cost chart.
- Margin warning if margin drops below target.
- Budget variance warning.
- Job profitability report.
- Client profitability report.
- Service line profitability report.

---

# 9.13 Invoicing Module

## Purpose

Create, approve, submit, and track invoices to clients, especially enterprise clients such as Aramco.

## Invoice Lifecycle

```text
Job Completed
    ↓
Daily Reports / Timesheets Approved
    ↓
Service Reports / ESV Attached
    ↓
Costing Reviewed
    ↓
Invoice Draft Created
    ↓
Finance Review
    ↓
Management Approval
    ↓
Invoice Generated
    ↓
Submitted to Client / Portal
    ↓
Payment Status Tracked
    ↓
Payment Reconciled
```

## Invoice Fields

| Field | Description |
|---|---|
| Invoice ID | Internal ID. |
| Invoice Number | Sequential invoice number. |
| UUID | Required for e-invoicing readiness. |
| Client | Linked client. |
| Client VAT Number | Required for tax invoice. |
| Client Address | Billing address. |
| Contract | Linked contract. |
| PO Number | Linked PO. |
| Job | Linked job or multiple jobs if allowed. |
| Service Period | From/to date. |
| Invoice Date | Date issued. |
| Due Date | Based on payment terms. |
| Currency | SAR default. |
| Subtotal | Before VAT. |
| VAT Amount | VAT total. |
| Total Amount | Final amount. |
| Status | Draft, pending approval, approved, submitted, partially paid, paid, overdue, cancelled. |
| Attachments | ESV, timesheets, reports, delivery notes, PO. |

## Invoice Line Item Fields

| Field | Description |
|---|---|
| Description | Service/material description. |
| Contract Rate Item | Optional linked rate card item. |
| Quantity | Hours/days/units/trips. |
| Unit | Hour, day, unit, trip, etc. |
| Unit Price | Selling price. |
| VAT Rate | Usually 15% if applicable. |
| Line Subtotal | Quantity × unit price. |
| Line VAT | VAT amount. |
| Line Total | Subtotal + VAT. |

## Required Features

- Create invoice draft from approved job reports/timesheets.
- Pull rates from contract rate card.
- Link invoice to job, contract, and PO.
- Attach required documents.
- Validate PO remaining balance.
- Validate required client VAT data.
- Validate invoice line totals.
- Calculate VAT.
- Generate PDF invoice.
- Prepare XML invoice structure for ZATCA/Fatoora readiness.
- Generate QR code where required.
- Store invoice history.
- Track payment status.
- Support credit notes and debit notes.

## ZATCA/Fatoora Readiness

The ERP should be designed with Saudi e-invoicing compliance in mind.

The invoice module should support:

```text
XML invoice generation
PDF invoice generation
UUID
Sequential invoice number
QR code
Cryptographic hash/stamp readiness
VAT fields
Credit notes
Debit notes
Invoice archive
Integration adapter for future ZATCA connection
```

Do not hard-code invoicing only for Aramco. Build a general invoicing engine, then add client-specific templates and submission requirements.

---

# 9.14 Payments and Receivables Module

## Purpose

Track collections, unpaid invoices, overdue amounts, and cash status.

## Payment Fields

| Field | Description |
|---|---|
| Payment ID | Internal ID. |
| Invoice | Linked invoice. |
| Client | Linked client. |
| Payment Date | Date received. |
| Amount | Paid amount. |
| Payment Method | Bank transfer, check, etc. |
| Reference Number | Bank/payment reference. |
| Attachment | Proof of payment. |
| Notes | Optional. |

## Features

- Record full or partial payments.
- Mark invoices as paid/partially paid.
- Calculate outstanding balance.
- Receivables aging report.
- Overdue invoice alerts.
- Client payment history.
- Collection report.

## Receivables Aging Buckets

```text
0–30 days
31–60 days
61–90 days
90+ days
```

---

# 9.15 Procurement Module

## Purpose

Manage internal purchase requests and supplier purchase orders.

## Procurement Flow

```text
Purchase Request
    ↓
Manager Approval
    ↓
Supplier PO
    ↓
Goods/Service Received
    ↓
Supplier Invoice
    ↓
Payment/Expense Posting
```

## Purchase Request Fields

| Field | Description |
|---|---|
| PR ID | Internal ID. |
| Requester | User. |
| Department | Requesting department. |
| Job | Optional linked job. |
| Items | Requested materials/services. |
| Estimated Cost | Expected cost. |
| Reason | Business justification. |
| Status | Draft, submitted, approved, rejected, ordered, received, closed. |

## Features

- Create purchase request.
- Approval workflow.
- Convert approved PR to supplier PO.
- Receive goods/services.
- Link supplier invoice to expense.
- Track procurement cost by job and department.

---

# 9.16 Inventory / Spare Parts Module

## Purpose

Track materials, spare parts, consumables, and job consumption.

## Inventory Item Fields

| Field | Description |
|---|---|
| Item ID | Internal ID. |
| Name | Item name. |
| Category | Spare part, chemical, PPE, tool, consumable. |
| SKU/Code | Optional. |
| Unit | Each, box, liter, kg, etc. |
| Current Quantity | Stock on hand. |
| Minimum Quantity | Reorder level. |
| Average Cost | Cost valuation. |
| Supplier | Preferred supplier. |
| Location | Warehouse/site. |
| Status | Active/inactive. |

## Inventory Movement Types

```text
Stock In
Stock Out
Transfer
Adjustment
Return
Job Consumption
```

## Features

- Add inventory item.
- Record stock in/out.
- Link stock consumption to job.
- Low stock alerts.
- Inventory value report.
- Usage by job report.

---

# 9.17 Maintenance Management Module

## Purpose

Manage preventive and corrective maintenance for vehicles and equipment.

## Maintenance Record Fields

| Field | Description |
|---|---|
| Maintenance ID | Internal ID. |
| Asset Type | Vehicle or equipment. |
| Asset | Linked asset. |
| Maintenance Type | Preventive, corrective, inspection, calibration. |
| Date | Maintenance date. |
| Description | Work done. |
| Cost | Maintenance cost. |
| Vendor | Optional. |
| Downtime Start | Optional. |
| Downtime End | Optional. |
| Next Due Date | Next scheduled maintenance. |
| Attachments | Invoice, report, photos. |

## Features

- Schedule preventive maintenance.
- Track corrective maintenance.
- Track downtime.
- Calculate maintenance cost by asset.
- Alert for upcoming maintenance.
- Prevent job assignment during maintenance.
- Identify high-cost assets.

## Asset Downtime Formula

```text
Asset Downtime % = Downtime Hours ÷ Total Available Hours × 100
```

---

# 9.18 Document Expiry and Compliance Module

## Purpose

Track critical company, employee, vehicle, equipment, and client-required documents.

## Document Types

```text
Vehicle registration
Vehicle insurance
Vehicle inspection
Operator license
Driver license
Safety certificate
Equipment calibration certificate
Aramco ID
Vendor certificate
Iqama
Commercial Registration
VAT certificate
Zakat certificate
GOSI certificate
Civil Defense license
Contract documents
PO documents
```

## Fields

| Field | Description |
|---|---|
| Document ID | Internal ID. |
| Related Entity Type | Employee, vehicle, equipment, company, contract, client. |
| Related Entity | Linked record. |
| Document Type | Type. |
| Issue Date | Optional. |
| Expiry Date | Required if expirable. |
| Attachment | Uploaded document. |
| Status | Valid, expiring soon, expired. |
| Notes | Optional. |

## Features

- Upload documents.
- Track expiry.
- Alerts at 90, 60, 30, 7 days before expiry.
- Dashboard for expired/expiring documents.
- Prevent assignment of employee/vehicle/equipment with expired required document unless override.

---

# 9.19 Reports and Analytics Module

## Required Reports

### Operations Reports

```text
Active jobs report
Completed jobs report
Delayed jobs report
Jobs by client
Jobs by service line
Jobs by region
Resource utilization report
Crew productivity report
Equipment downtime report
Vehicle usage report
Daily report summary
```

### Finance Reports

```text
Revenue by client
Revenue by service line
Revenue by month
Expense by category
Expense by job
Expense by department
Profit by job
Profit by client
Profit by service line
Receivables aging
Unbilled work report
VAT report
Cash collection report
Overdue invoice report
```

### Management Reports

```text
Monthly company health report
Top profitable jobs
Top loss-making jobs
Idle resource report
Contract consumption report
PO consumption report
Client dependency report
High-cost asset report
Document expiry report
```

## Export Requirements

- Export to Excel.
- Export to PDF.
- Export to CSV.
- Print-friendly views.

---

# 9.20 Approval Workflow Module

## Purpose

Standardize approval for sensitive actions.

## Required Workflows

### Job Approval

```text
Job Created → Operations Manager Approval → Resources Assigned
```

### Daily Report Approval

```text
Daily Report Submitted → Operations Manager Review → Approved/Rejected
```

### Expense Approval

```text
Expense Submitted → Manager Review → Finance Approval → Posted
```

### Invoice Approval

```text
Invoice Draft → Finance Review → Management Approval → Submitted
```

### Procurement Approval

```text
Purchase Request → Department Approval → Finance Approval → Supplier PO
```

## Features

- Configurable approval stages.
- Approver comments.
- Rejection reason.
- Approval timestamp.
- Notification to next approver.
- Audit trail for all approval actions.

---

# 9.21 Audit Logs Module

## Purpose

Track important system actions for accountability.

## Audit Events

Log the following:

```text
User login/logout
User creation/update
Role/permission changes
Job creation/update/delete
Job status change
Resource assignment
Expense creation/update/approval
Invoice creation/update/approval/submission
Payment recording
Document upload/delete
Maintenance record changes
Override actions
```

## Audit Log Fields

| Field | Description |
|---|---|
| Audit ID | Internal ID. |
| User | Who performed action. |
| Action | Create/update/delete/approve/etc. |
| Entity Type | Job, invoice, expense, etc. |
| Entity ID | Related record. |
| Old Value | Before change if applicable. |
| New Value | After change if applicable. |
| Timestamp | Date/time. |
| IP Address | Optional. |
| Reason/Comment | Required for overrides. |

---

# 9.22 Notifications Module

## Purpose

Alert users about required actions and risks.

## Notification Types

```text
Job assigned
Daily report pending approval
Expense pending approval
Invoice pending approval
Invoice overdue
PO balance low
Contract near expiry
Document near expiry
Equipment maintenance due
Resource conflict
Job over budget
Job below margin target
Completed job not invoiced
```

## Notification Channels

MVP:
- In-app notifications.

Future:
- Email.
- WhatsApp/SMS.
- Microsoft Teams/Slack.

---

## 10. System-Wide Functional Requirements

### FR-001 Authentication

The system shall require users to log in before accessing ERP data.

### FR-002 Role-Based Access Control

The system shall restrict features and data based on assigned roles and permissions.

### FR-003 Dashboard Filtering

The system shall allow authorized users to filter dashboards by date, client, service line, region, and status.

### FR-004 Job Creation

The system shall allow authorized users to create and manage jobs.

### FR-005 Resource Assignment

The system shall allow authorized users to assign crews, employees, vehicles, and equipment to jobs.

### FR-006 Resource Conflict Detection

The system shall detect and warn about overlapping assignments.

### FR-007 Utilization Calculation

The system shall calculate utilization percentages for crews, employees, vehicles, and equipment.

### FR-008 Daily Reports

The system shall allow supervisors to submit daily reports linked to jobs.

### FR-009 Timesheets

The system shall allow employees/crews to record hours worked, overtime, standby, and travel time.

### FR-010 Expense Entry

The system shall allow users to record expenses with category, amount, VAT, attachments, and allocation.

### FR-011 Job Costing

The system shall calculate actual job cost based on labor, equipment, vehicle, material, subcontractor, and direct expenses.

### FR-012 Job Profitability

The system shall calculate gross profit and gross margin per job.

### FR-013 Contract Management

The system shall store contract terms, values, expiry dates, attachments, and rate cards.

### FR-014 PO Management

The system shall track PO value, consumed amount, remaining amount, status, and linked jobs/invoices.

### FR-015 Invoice Drafting

The system shall create invoice drafts from approved jobs, timesheets, and contract rate cards.

### FR-016 Invoice Approval

The system shall require approval before invoice submission.

### FR-017 Invoice Generation

The system shall generate printable PDF invoices and store invoice records.

### FR-018 ZATCA Readiness

The system shall be designed to support ZATCA/Fatoora XML, UUID, QR, and required e-invoicing fields.

### FR-019 Payment Tracking

The system shall allow users to record payments and track invoice balance.

### FR-020 Receivables Aging

The system shall generate receivables aging reports.

### FR-021 Maintenance Tracking

The system shall track maintenance records, costs, downtime, and next due dates for vehicles/equipment.

### FR-022 Document Expiry

The system shall track expiry dates and alert responsible users.

### FR-023 Reports

The system shall provide operational, financial, and management reports.

### FR-024 Export

The system shall export reports to PDF, Excel, and CSV.

### FR-025 Audit Logs

The system shall log critical changes and approval/override actions.

---

## 11. Non-Functional Requirements

### 11.1 Security

- Passwords must be hashed.
- Use HTTPS in production.
- Implement RBAC.
- Sensitive finance data must be access-controlled.
- File downloads must require authorization.
- Audit critical actions.
- Protect APIs from unauthorized access.
- Use input validation to prevent injection attacks.

### 11.2 Performance

- Dashboard should load within 3 seconds for normal data volumes.
- Common list pages should support pagination, filtering, and search.
- Reports should support asynchronous generation if large.

### 11.3 Reliability

- Database backups required.
- File storage backups required.
- Error logs required.
- Transactional integrity required for invoice/payment updates.

### 11.4 Usability

- Interface should be simple and operationally practical.
- Dashboard should be clear for non-technical managers.
- Field report submission should be fast and mobile-friendly.
- Use clear statuses and color indicators.

### 11.5 Scalability

- Design for multiple users and growing job history.
- Use database indexes on commonly filtered fields.
- Keep modules decoupled internally.

### 11.6 Maintainability

- Use modular architecture.
- Use clear naming conventions.
- Use migrations for database changes.
- Use API documentation.
- Use automated tests for critical calculations.

### 11.7 Compliance

- Saudi VAT and e-invoicing fields must be considered.
- Store invoice data securely.
- Keep audit history.
- Maintain document expiry tracking.

---

## 12. Suggested Database Schema Outline

This is a conceptual schema. The implementation AI should refine it into migrations.

### users

```text
id
name
email
password_hash
role_id
status
created_at
updated_at
```

### roles

```text
id
name
description
created_at
updated_at
```

### permissions

```text
id
key
description
```

### role_permissions

```text
role_id
permission_id
```

### clients

```text
id
name
client_type
vat_number
cr_number
billing_address
payment_terms_days
status
notes
created_at
updated_at
```

### contracts

```text
id
client_id
contract_number
title
scope
start_date
end_date
contract_value
consumed_value
remaining_value
payment_terms_days
status
created_at
updated_at
```

### contract_rate_cards

```text
id
contract_id
service_line
item_code
description
unit
unit_price
currency
vat_applicable
effective_date
created_at
updated_at
```

### purchase_orders

```text
id
client_id
contract_id
po_number
po_value
consumed_amount
remaining_amount
currency
issue_date
expiry_date
status
created_at
updated_at
```

### jobs

```text
id
job_code
title
client_id
contract_id
purchase_order_id
service_type
location
planned_start_date
planned_end_date
actual_start_date
actual_end_date
job_value
cost_budget
actual_cost
gross_profit
gross_margin_percent
status
description
created_at
updated_at
```

### job_assignments

```text
id
job_id
resource_type
resource_id
start_datetime
end_datetime
planned_hours
actual_hours
status
created_at
updated_at
```

### employees

```text
id
name
role
department
cost_rate
availability_status
phone
email
status
created_at
updated_at
```

### crews

```text
id
name
supervisor_employee_id
service_capability
status
created_at
updated_at
```

### crew_members

```text
id
crew_id
employee_id
start_date
end_date
status
```

### vehicles

```text
id
plate_number
vehicle_type
make
model
year
ownership_type
status
odometer
registration_expiry
insurance_expiry
inspection_expiry
cost_rate
created_at
updated_at
```

### equipment

```text
id
name
equipment_type
serial_number
ownership_type
status
current_location
calibration_expiry
maintenance_due_date
cost_rate
created_at
updated_at
```

### job_daily_reports

```text
id
job_id
report_date
supervisor_id
work_performed
progress_percent
client_representative
issues
materials_used_notes
approval_status
approved_by
approved_at
created_at
updated_at
```

### job_timesheets

```text
id
job_id
employee_id
crew_id
work_date
regular_hours
overtime_hours
standby_hours
travel_hours
approval_status
approved_by
approved_at
created_at
updated_at
```

### expense_categories

```text
id
name
description
```

### expenses

```text
id
expense_date
vendor_name
category_id
amount_before_vat
vat_amount
total_amount
currency
job_id
department
vehicle_id
equipment_id
employee_id
description
approval_status
created_by
approved_by
approved_at
created_at
updated_at
```

### invoices

```text
id
invoice_number
uuid
client_id
contract_id
purchase_order_id
job_id
invoice_date
due_date
service_period_start
service_period_end
subtotal
vat_amount
total_amount
paid_amount
outstanding_amount
currency
status
zatca_status
created_at
updated_at
```

### invoice_line_items

```text
id
invoice_id
description
contract_rate_card_id
quantity
unit
unit_price
vat_rate
line_subtotal
line_vat
line_total
created_at
updated_at
```

### payments

```text
id
invoice_id
client_id
payment_date
amount
payment_method
reference_number
notes
created_at
updated_at
```

### maintenance_records

```text
id
asset_type
asset_id
maintenance_type
maintenance_date
description
cost
vendor_name
downtime_start
downtime_end
next_due_date
created_at
updated_at
```

### inventory_items

```text
id
name
category
sku
unit
current_quantity
minimum_quantity
average_cost
supplier_name
location
status
created_at
updated_at
```

### inventory_movements

```text
id
item_id
movement_type
quantity
unit_cost
job_id
reference
movement_date
created_by
created_at
```

### documents

```text
id
related_entity_type
related_entity_id
document_type
issue_date
expiry_date
file_url
status
notes
created_at
updated_at
```

### audit_logs

```text
id
user_id
action
entity_type
entity_id
old_value_json
new_value_json
ip_address
comment
created_at
```

### notifications

```text
id
user_id
type
title
message
is_read
related_entity_type
related_entity_id
created_at
```

---

## 13. Required Business Calculations

### Utilization

```text
Utilization % = Assigned Time ÷ Available Time × 100
```

### Gross Profit

```text
Gross Profit = Revenue - Actual Cost
```

### Gross Margin

```text
Gross Margin % = Gross Profit ÷ Revenue × 100
```

### Cost Variance

```text
Cost Variance = Actual Cost - Estimated Cost
```

### PO Remaining Amount

```text
PO Remaining Amount = PO Value - Consumed Amount
```

### Contract Remaining Value

```text
Contract Remaining Value = Contract Value - Consumed Value
```

### Unbilled Revenue

```text
Unbilled Revenue = Approved Completed Work - Invoiced Work
```

### Invoice Outstanding Amount

```text
Outstanding Amount = Invoice Total - Paid Amount
```

### Asset Downtime Percentage

```text
Asset Downtime % = Downtime Hours ÷ Total Available Hours × 100
```

---

## 14. Critical Alerts

The ERP must generate alerts for:

```text
Job cost exceeds budget.
Job margin drops below target.
PO balance is nearly consumed.
Invoice exceeds remaining PO amount.
Invoice is overdue.
Completed job is not invoiced.
Equipment is assigned while under maintenance.
Vehicle is assigned while under maintenance.
Employee certificate is expired.
Vehicle document is expired.
Equipment calibration is expired.
Contract is near expiry.
Resource is double-booked.
Expense has no category.
Expense has no job/department allocation.
Client payment is delayed.
```

---

## 15. MVP Scope

The first version should include:

```text
1. Authentication and RBAC.
2. Dashboard.
3. Clients.
4. Contracts.
5. Purchase Orders.
6. Jobs.
7. Crews/employees.
8. Vehicles.
9. Equipment.
10. Resource assignment.
11. Daily reports.
12. Timesheets.
13. Expenses.
14. Basic job costing.
15. Invoice drafts.
16. Payments.
17. Basic reports.
18. File attachments.
19. Audit logs.
20. Notifications.
```

Do not overbuild the MVP. The first version must answer:

```text
What jobs are active?
Who is assigned to each job?
Which vehicles/equipment are being used?
How utilized are our resources?
How much did each job cost?
How much should we invoice?
Which invoices are unpaid?
Which jobs are profitable?
Which jobs are losing money?
```

---

## 16. Future Phases

### Phase 2 — Advanced Costing and Utilization

```text
Advanced utilization reports.
Job margin alerts.
Client profitability.
Service line profitability.
Maintenance cost analysis.
Receivables aging.
Unbilled revenue tracking.
```

### Phase 3 — Compliance and Automation

```text
ZATCA XML generation.
QR code.
Invoice hash/stamp readiness.
Credit/debit notes.
Approval workflow configuration.
Document expiry automation.
Advanced audit logs.
```

### Phase 4 — Integrations

```text
Accounting system integration.
ZATCA/Fatoora integration.
Bank reconciliation.
Aramco/SAP/portal export helper.
Power BI connector.
Mobile field app.
```

---

## 17. AI Implementation Prompt

Use the following prompt with another AI/software agent.

---

# FULL AI BUILD PROMPT

You are a senior software architect and full-stack engineer. Design and help build a custom ERP system for Abrican, an oil-and-gas/industrial services company.

The ERP must focus on:

1. Jobs and field operations.
2. Crew, team, vehicle, and equipment utilization.
3. Expense tracking and cost breakdown.
4. Job costing and profitability.
5. Invoice creation for enterprise clients, especially Aramco.
6. Payments, receivables, and overdue invoices.
7. Contract and PO tracking.
8. Maintenance and document expiry.
9. Executive dashboards and management diagnosis.

Do not design a generic ERP. Design an operations-to-finance ERP where the central object is the Job.

The main lifecycle is:

```text
Client → Contract → Purchase Order → Job → Resource Assignment → Daily Reports / Timesheets → Expenses → Costing → Invoice → Payment → Job Closure
```

Build the system as a modular monolith.

Recommended stack:
- Frontend: React or Next.js.
- Backend: NestJS or Laravel.
- Database: PostgreSQL.
- ORM: Prisma if using Node/NestJS.
- Deployment: Docker.
- Authentication: role-based access control.
- Storage: S3-compatible storage or equivalent.
- Reports: PDF/Excel/CSV export.
- Future-ready integration: ZATCA/Fatoora, accounting system, Aramco/SAP/portal export helper.

Required modules:
1. Executive Dashboard.
2. Job Management.
3. Client Management.
4. Contract Management.
5. Purchase Order Management.
6. Crew and Employee Management.
7. Vehicle Management.
8. Equipment Management.
9. Resource Scheduling.
10. Daily Reports / Timesheets.
11. Expense Management.
12. Job Costing.
13. Invoicing.
14. Payments and Receivables.
15. Procurement.
16. Inventory / Spare Parts.
17. Maintenance.
18. Document Expiry and Compliance.
19. Reports and Analytics.
20. Approval Workflows.
21. Audit Logs.
22. Notifications.
23. User Roles and Permissions.

User roles:
- Admin.
- CEO / General Manager.
- Operations Manager.
- Finance Manager.
- Accountant.
- Field Supervisor.
- Maintenance Manager.
- HR/Admin Officer.
- Procurement Officer.
- Viewer/Auditor.

Dashboard must show:
- Active jobs.
- Completed jobs.
- Delayed jobs.
- Jobs by client.
- Jobs by service line.
- Crew utilization.
- Vehicle utilization.
- Equipment utilization.
- Idle resources.
- Overbooked resources.
- Monthly revenue.
- Monthly expenses.
- Gross profit.
- Gross margin percentage.
- Unbilled revenue.
- Accounts receivable.
- Overdue invoices.
- Expense breakdown.
- Profit by job.
- Profit by client.
- Document expiry alerts.
- Maintenance due alerts.

Utilization formulas:
```text
Utilization % = Assigned Time / Available Time × 100
Crew Utilization = Assigned or Worked Hours / Available Working Hours × 100
Vehicle Utilization = Assigned Days / Available Days × 100
Equipment Utilization = Assigned or Used Hours / Available Hours × 100
```

Job profitability:
```text
Job Revenue
- Labor Cost
- Vehicle Cost
- Equipment Cost
- Material Cost
- Subcontractor Cost
- Other Direct Costs
= Gross Profit

Gross Margin % = Gross Profit / Job Revenue × 100
```

Invoice module requirements:
- Create invoice drafts from approved jobs/timesheets/daily reports.
- Pull rates from contract rate cards.
- Link invoice to client, contract, PO, and job.
- Include VAT fields.
- Include invoice number and UUID.
- Generate PDF invoice.
- Prepare for XML invoice generation.
- Support QR code.
- Support credit notes and debit notes.
- Track invoice status: draft, pending approval, approved, submitted, partially paid, paid, overdue, cancelled.
- Track payment status and outstanding amount.
- Prevent invoice submission if it exceeds PO remaining amount unless manager override is recorded.
- Store all attachments: PO, ESV/service reports, signed reports, timesheets.

Important compliance design:
- The Saudi invoice design must be future-ready for ZATCA/Fatoora e-invoicing.
- The invoice entity must support UUID, sequential invoice number, QR code, XML generation, VAT fields, credit/debit notes, and secure archive.
- Do not hard-code invoices only for Aramco. Build a generic invoice engine with client-specific templates.

Required database entities:
- users
- roles
- permissions
- clients
- client_contacts
- contracts
- contract_rate_cards
- purchase_orders
- jobs
- job_status_history
- job_assignments
- job_daily_reports
- job_timesheets
- employees
- crews
- crew_members
- vehicles
- equipment
- maintenance_records
- expense_categories
- expenses
- invoices
- invoice_line_items
- payments
- credit_notes
- debit_notes
- inventory_items
- inventory_movements
- purchase_requests
- supplier_purchase_orders
- documents
- audit_logs
- notifications

Build MVP first:
1. Auth/RBAC.
2. Dashboard.
3. Clients.
4. Contracts.
5. POs.
6. Jobs.
7. Employees/crews.
8. Vehicles.
9. Equipment.
10. Resource assignments.
11. Daily reports.
12. Timesheets.
13. Expenses.
14. Basic job costing.
15. Invoice drafts.
16. Payments.
17. Basic reports.
18. Attachments.
19. Audit logs.
20. Notifications.

Acceptance criteria:
- User can create a job and link it to client/contract/PO.
- User can assign crew, vehicle, and equipment to a job.
- System warns about resource double-booking.
- System warns if assigned equipment/vehicle is under maintenance.
- Field supervisor can submit daily reports and timesheets.
- Approved timesheets feed job costing.
- Expenses can be linked to jobs, assets, departments, or employees.
- Job page shows revenue, cost, profit, and margin.
- Invoice draft can be generated from job data.
- Invoice cannot exceed remaining PO amount without override.
- Payments can be recorded against invoices.
- Dashboard displays operational and financial KPIs.
- Reports can be exported.
- Sensitive pages are restricted by role.
- Critical changes are audit logged.

Create the implementation plan in this order:
1. Confirm assumptions.
2. Propose final architecture.
3. Propose database schema.
4. Propose API endpoints.
5. Propose frontend pages.
6. Propose dashboard KPIs and calculations.
7. Propose permissions matrix.
8. Propose MVP backlog.
9. Generate implementation tasks by sprint.
10. Start coding the backend and database migrations.
11. Then implement frontend pages.
12. Then implement dashboards and reports.
13. Then implement invoice PDF generation.
14. Then implement testing.

Do not skip business logic. Do not create only UI mockups. The system must have real data models, real workflows, real validation, and real calculations.

---

## 18. Suggested API Endpoints

### Auth

```text
POST /auth/login
POST /auth/logout
GET /auth/me
```

### Users/Roles

```text
GET /users
POST /users
GET /users/:id
PATCH /users/:id
GET /roles
POST /roles
PATCH /roles/:id
```

### Clients

```text
GET /clients
POST /clients
GET /clients/:id
PATCH /clients/:id
GET /clients/:id/jobs
GET /clients/:id/invoices
```

### Contracts

```text
GET /contracts
POST /contracts
GET /contracts/:id
PATCH /contracts/:id
GET /contracts/:id/rate-card
POST /contracts/:id/rate-card
```

### Purchase Orders

```text
GET /purchase-orders
POST /purchase-orders
GET /purchase-orders/:id
PATCH /purchase-orders/:id
GET /purchase-orders/:id/consumption
```

### Jobs

```text
GET /jobs
POST /jobs
GET /jobs/:id
PATCH /jobs/:id
POST /jobs/:id/status
POST /jobs/:id/assignments
GET /jobs/:id/assignments
GET /jobs/:id/costing
GET /jobs/:id/profitability
GET /jobs/:id/invoices
```

### Daily Reports / Timesheets

```text
GET /jobs/:jobId/daily-reports
POST /jobs/:jobId/daily-reports
PATCH /daily-reports/:id
POST /daily-reports/:id/submit
POST /daily-reports/:id/approve
POST /daily-reports/:id/reject

GET /jobs/:jobId/timesheets
POST /jobs/:jobId/timesheets
POST /timesheets/:id/approve
POST /timesheets/:id/reject
```

### Resources

```text
GET /employees
POST /employees
PATCH /employees/:id

GET /crews
POST /crews
PATCH /crews/:id

GET /vehicles
POST /vehicles
PATCH /vehicles/:id

GET /equipment
POST /equipment
PATCH /equipment/:id

GET /resources/utilization
GET /resources/conflicts
GET /resources/idle
```

### Expenses

```text
GET /expenses
POST /expenses
GET /expenses/:id
PATCH /expenses/:id
POST /expenses/:id/submit
POST /expenses/:id/approve
POST /expenses/:id/reject
GET /expenses/reports/by-category
GET /expenses/reports/by-job
```

### Invoices

```text
GET /invoices
POST /invoices
POST /invoices/from-job/:jobId
GET /invoices/:id
PATCH /invoices/:id
POST /invoices/:id/approve
POST /invoices/:id/submit
POST /invoices/:id/pdf
POST /invoices/:id/xml
GET /invoices/:id/payments
```

### Payments

```text
GET /payments
POST /payments
GET /payments/:id
PATCH /payments/:id
GET /receivables/aging
```

### Maintenance

```text
GET /maintenance
POST /maintenance
GET /maintenance/:id
PATCH /maintenance/:id
GET /maintenance/due
GET /assets/downtime
```

### Documents

```text
GET /documents
POST /documents
GET /documents/expiring
GET /documents/expired
PATCH /documents/:id
```

### Dashboard / Reports

```text
GET /dashboard/executive
GET /dashboard/operations
GET /dashboard/finance
GET /dashboard/assets
GET /reports/jobs
GET /reports/utilization
GET /reports/profitability
GET /reports/receivables-aging
GET /reports/unbilled-revenue
GET /reports/export
```

---

## 19. Frontend Pages

Required frontend pages:

```text
/login
/dashboard
/dashboard/operations
/dashboard/finance
/dashboard/assets

/clients
/clients/:id

/contracts
/contracts/:id

/purchase-orders
/purchase-orders/:id

/jobs
/jobs/new
/jobs/:id
/jobs/:id/assignments
/jobs/:id/daily-reports
/jobs/:id/timesheets
/jobs/:id/costing
/jobs/:id/invoices

/resources/employees
/resources/crews
/resources/vehicles
/resources/equipment
/resources/schedule
/resources/utilization

/expenses
/expenses/new
/expenses/reports

/invoices
/invoices/new
/invoices/:id

/payments
/receivables

/procurement
/inventory
/maintenance
/documents
/reports
/admin/users
/admin/roles
/audit-logs
/notifications
```

---

## 20. UI/UX Requirements

- Use clean dashboard cards.
- Use tables with filters, sorting, and search.
- Use status badges.
- Use clear colors for statuses:
  - Green: good/paid/available.
  - Yellow: warning/pending/near expiry.
  - Red: overdue/expired/over budget.
  - Gray: inactive/closed.
- Use modal or detail pages for approvals.
- Use mobile-friendly forms for daily reports.
- Avoid complex screens for field supervisors.
- Every list page should support:
  - Search.
  - Filter.
  - Export if relevant.
  - Pagination.
- Every detail page should have:
  - Overview.
  - Related records.
  - Attachments.
  - Audit/history.

---

## 21. Validation Rules

Examples:

```text
Job must have client before approval.
Invoice must have client VAT number before approval.
Invoice must have at least one line item.
Invoice total must equal sum of line totals.
Invoice cannot exceed PO remaining amount unless override.
Expense must have category and amount.
Payment cannot exceed outstanding invoice amount unless overpayment is allowed.
Resource cannot be assigned to overlapping jobs unless override.
Vehicle/equipment under maintenance cannot be assigned unless override.
Document expiry date must be valid if document type requires expiry.
Contract end date must be after start date.
PO expiry date must be after issue date.
```

---

## 22. Testing Requirements

Minimum tests:

```text
Authentication tests.
Permission tests.
Job creation tests.
Resource assignment conflict tests.
Utilization calculation tests.
Expense approval tests.
Job costing calculation tests.
Invoice total calculation tests.
VAT calculation tests.
PO remaining amount validation tests.
Payment allocation tests.
Receivables aging tests.
Document expiry alert tests.
Audit log creation tests.
```

---

## 23. Final Notes

This ERP should prioritize visibility, control, and decision-making.

The most important implementation mistake to avoid is creating disconnected modules. Everything must connect:

```text
Jobs connect to resources.
Resources connect to utilization.
Daily reports connect to costing.
Expenses connect to jobs/assets/departments.
Costing connects to invoices.
Invoices connect to payments.
Payments connect to financial health.
```

The system is successful if Abrican management can open the dashboard and immediately understand:

```text
What is happening?
What is being used?
What is idle?
What is profitable?
What is unpaid?
What is risky?
What needs action today?
```
