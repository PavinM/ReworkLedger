# ReworkLedger Project Guide

ReworkLedger is a project-delivery and quality-tracking workspace. It connects
projects and tasks to defect reports, corrective work, payroll proposals, code
analysis, and quality reporting. This guide describes the behavior implemented
in this repository; it distinguishes the current product from features that
would still require further implementation.

## Contents

- [Product overview](#product-overview)
- [Technology and architecture](#technology-and-architecture)
- [Roles and access](#roles-and-access)
- [Main workflows](#main-workflows)
- [Feature inventory](#feature-inventory)
- [Data model](#data-model)
- [API overview](#api-overview)
- [Local development](#local-development)
- [Validation](#validation)
- [Current limitations](#current-limitations)

## Product overview

The application provides a shared workflow for planning delivery, reviewing
completed work, recording defects, tracking corrective effort, and evaluating
quality signals. A task accepted as a delivery can retain a snapshot of the
delivery and its contributors. A later defect can reference that task and
delivery; approved corrective work is tracked separately from regular work.
Managers can create a monthly payroll proposal based on approved, unreserved
corrective entries and review it before any external payroll action.

The unauthenticated site includes a public marketing page with Home, Services,
About, Contact, and Login navigation. The authenticated workspace presents
role-based navigation and a dashboard with project, defect, rework, and
payroll-review information.

## Technology and architecture

| Layer | Implementation |
| --- | --- |
| Client | React, TypeScript, Vite, Framer Motion, Lucide icons, Recharts, Tailwind CSS |
| API | Node.js, Express, TypeScript |
| Persistence | MongoDB through Mongoose |
| Authentication | JWT bearer tokens, bcrypt password hashing |
| Validation | Zod request schemas |
| Source analysis | Bounded ZIP intake, static pattern checks, optional local Ollama analysis |

The client is in `client/`. It calls the API through `client/src/lib/api.ts`;
`VITE_API_URL` can override the default `http://localhost:5000`. The API starts
in `server/src/server.ts`, connects to MongoDB, installs authentication and
resource routes, and uses shared error handling and request validation.

Core backend responsibilities are separated into:

- `server/src/routes/` for route declarations and role gates.
- `server/src/controllers/` for API operations.
- `server/src/models/` for persisted Mongoose records.
- `server/src/services/` for lifecycle rules, payroll calculations, auditing,
  and source-analysis logic.
- `client/src/components/` for the marketing page and workspace panels.

## Roles and access

| Role | Main capabilities |
| --- | --- |
| Employee | View assigned projects/tasks, update own task progress, submit completed tasks, resolve assigned defects as permitted, log work against assigned tasks, and view personal payroll adjustments. |
| Manager | Create projects/tasks and defect reports, review task submissions and defects, review corrective time and payroll proposals, use code analysis findings for defect assignment, and view quality and audit information. |
| Administrator | Manager capabilities plus account provisioning/deactivation and compensation settings. |

API routes enforce JWT authentication. Manager/admin-only operations are
protected on the server; client navigation is also filtered by role but is not
the authorization boundary. Public registration creates employee accounts
only. Administrators can create employee/manager accounts, change account
activity, and edit hourly rate, base salary, and payroll currency.

## Main workflows

### Project and task delivery

1. A manager creates a project with a name and optional description, GitHub
   URL, deadline, and employee assignment.
2. An assigned project receives a delivery task. The project listing also
   ensures an assigned project has a corresponding delivery task.
3. A manager may create additional tasks and assign them to active employees.
   Tasks can include committed dates and contributor IDs.
4. The assigned employee updates task status/progress and submits a completed
   task for review.
5. A manager accepts the submission or requests changes. Acceptance closes the
   task and records a delivery snapshot; requesting changes moves it to
   `under_fix`.
6. Task status transitions made through the status endpoint are validated
   against the task transition rules and added to task history with actor,
   timestamp, and optional reason.

Task statuses are `assigned`, `in_progress`, `completed`, `reopened`,
`under_fix`, and `closed`. Defect approval reopens an eligible completed task.
When a defect fix is accepted and no other open defects remain, the task can be
closed with a new delivery snapshot.

### Defect and corrective-work lifecycle

1. A manager reports a defect against a completed/closed task, including module,
   title, instructions, severity, cause, and optional resolution estimate.
2. A manager reviews the defect. An approved defect reopens its linked task;
   exemption requires a written reason.
3. The assigned employee tracks time against the defect, submits a fix
   description and evidence, and submits the resolution for manager review.
4. The manager accepts the fix. If no corrective time entry already exists,
   the accepted resolution is retained as a pending corrective-time entry for
   review.
5. Managers review time entries separately. Corrective entries require an
   approved/resolved linked defect; new manual corrective entries are allowed
   only while the task is reopened or under fix, and only by the assigned
   employee.

Time-entry categories are `regular_work` and `corrective_work`. A regular entry
cannot reference a defect. A corrective entry records its source and snapshots
of the employee's rate, salary, and currency. The defect workflow also offers
a local timer and advisory local-Ollama defect triage (estimated cause,
severity, and fix hours) that an authorized reviewer must verify. A
manager-verified hours backfill is also available for resolved legacy defects
when no corrective entry or payroll adjustment already exists; this legacy
backfill path creates a pending adjustment directly rather than waiting for the
monthly payroll action. The current Time tracking form is focused on corrective
entries; the API/model also recognize `regular_work`, but a regular-hours entry
form is not exposed in that panel.

### Monthly payroll proposals and employee disputes

1. A manager/admin selects an active employee and rework month in the Salary
   adjustments workspace and requests a monthly calculation.
2. The API selects approved corrective entries in that date range that have not
   already been reserved in another adjustment. It requires the linked defect
   to be approved or resolved and uses the entry's saved compensation rate
   where available.
3. Each calculation stores its input time-entry IDs and line-by-line hours,
   rate, amount, cause, task, and defect references. Entry reservation and
   proposal creation are transactional to prevent duplicate inclusion.
4. The proposal remains pending until a manager/admin approves or rejects it
   with a reason. An employee cannot approve their own adjustment.
5. An employee can submit a written dispute against a pending deduction.
   Payroll review and voiding are blocked while the dispute is pending. A
   manager/admin must record a resolution; accepting the dispute rejects the
   proposal, while denying it allows normal payroll review to continue.
6. Employees can see their adjustment status, salary projection, hours, and
   calculation breakdown in Salary adjustments.

The payroll engine currently applies the configured cause policy: `code_defect`
amounts are debits; other causes contribute credits. Confirm this policy with
the organization before operational use. Approval records the application's
decision; it does not apply wages in an external payroll system.

### Code analysis and defect assignment

1. A user with access to a task uploads a ZIP archive in Code analysis and may
   provide a version/commit reference and expected behavior.
2. The API scans JavaScript and TypeScript source files with static checks for
   patterns such as `eval`, HTML sinks, TypeScript checking suppressions,
   TODO/FIXME markers, and empty catch blocks.
3. If enabled, bounded source chunks are also reviewed using a local Ollama
   endpoint. AI output is schema-checked and its line/evidence references are
   validated against the uploaded source.
4. Findings are suggestions, not confirmed defects. A manager/admin records a
   review decision and reason. A confirmed finding can become a defect linked
   to the completed task.

The ZIP upload is limited to 10 MB, 500 archive entries, and 25 MB of
uncompressed source. Unsafe paths are rejected. Uploaded code is not executed.
Local AI analysis is enabled by default in the server configuration but can be
disabled; its default endpoint is localhost. If AI analysis fails, static
results remain available.

### Quality overview and audit history

The Overview page displays live projects/defects, a date-filtered corrective
hours chart, and project quality signals. Quality intelligence reports
reopen rate, elapsed fix time, corrective hours, defect counts and causes, and
quality metrics grouped by module, project, and employee. Payroll proposals are
summarized by month, including pending proposal amounts and approved deductions.

The Audit trail is available to manager/admin roles and lists recent recorded
audit events, with optional entity filtering. Audited actions include a number
of task, defect, time-entry, account compensation-setting, and payroll
decisions. Audit coverage is not yet complete for every read or write action.

## Feature inventory

- Public promotional landing page and role-selected login UI.
- JWT authentication with employee, manager, and administrator roles.
- Project creation, assignment, deadlines, GitHub links, and project status.
- Task creation, progress updates, submission/review, status rules, lifecycle
  history, delivery snapshots, and contributor snapshots.
- Defect reporting, severity/cause classification, review, exemption reason,
  task reopening, fix evidence, time tracking, and closure.
- Distinct regular and corrective time-entry records with approval state.
- Shared cause-aware payroll calculation, employee compensation settings,
  per-entry calculation snapshots, duplicate-entry reservation protection,
  payroll review, employee-visible breakdowns, and deduction disputes.
- Static code checks and optional locally hosted AI findings with human review.
- Dashboard charts, quality metrics, role-specific navigation, and audit view.
- Admin staff management and payroll-rate/currency configuration.

## Data model

| Model | Purpose |
| --- | --- |
| `User` | Credentials, role, active state, and compensation settings. |
| `Project` | Project metadata, manager, assigned employee, deadline, status. |
| `Task` | Project delivery/task, assignee, contributors, committed/completion dates, status history, delivery history, and review state. |
| `Defect` | Task/project/delivery link, original assignee snapshot, module, severity/cause, lifecycle history, resolution details. |
| `TimeEntry` | Employee/task/defect link, category, hours/date, review status, compensation snapshots, and payroll reservation. |
| `PayrollAdjustment` | Proposed payroll change, source entries, calculation breakdown, review decision, and dispute state. |
| `AnalysisScan` | ZIP scan state, static/local-AI findings, human finding reviews, and optional defect link. |
| `AuditLog` | Timestamped action records with actor, entity, before/after values, and reason when provided. |

## API overview

All resource endpoints require a bearer token unless stated otherwise.
Request bodies are validated with Zod.

| Resource | Implemented operations |
| --- | --- |
| Authentication/users | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`, `PATCH /api/auth/me/profile`, and admin user/settings routes. |
| Projects | `GET/POST /api/projects`, `GET /api/projects/:id`, `GET /api/projects/employees`. |
| Tasks | `GET/POST /api/tasks`, `GET /api/tasks/:id`, status/progress updates, task submission, and manager review. |
| Defects | `GET/POST /api/defects`, `GET /api/defects/:id`, review, fix submission, fix acceptance, and resolved-hours backfill. |
| Time entries | `GET/POST /api/time-entries`, `GET /api/time-entries/:id`, and manager/admin review. |
| Payroll | `GET /api/payroll`, employee options, monthly calculation, employee dispute submission, dispute review, payroll review, and voiding. |
| Code analysis | Task scan listing/upload, finding review, and confirmed-finding-to-defect creation. |
| Audit | `GET /api/audit-logs` with entity filters. |

For exact payload schemas and route guards, see `server/src/routes/` and
`server/src/validation/schemas.ts`.

## Local development

Requirements: a supported Node.js/npm installation and an accessible MongoDB
deployment. Local Ollama is optional.

1. Create the server environment file from the supplied example:

   ```bash
   cp server/.env.example server/.env
   ```

2. Set `MONGODB_URI` to the MongoDB deployment and replace `JWT_SECRET` with a
   long, random secret. Configure `PORT`, `CLIENT_URL`, and `NODE_ENV` as
   needed. For optional local AI, configure `CODE_ANALYSIS_AI_ENABLED`,
   `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `OLLAMA_TIMEOUT_MS`.
3. Install dependencies and run the API and client in separate terminals:

   ```bash
   npm --prefix server install
   npm --prefix client install
   npm --prefix server run dev
   npm --prefix client run dev
   ```

The API defaults to port `5000`; Vite defaults to port `5173`. The client API
base defaults to `http://localhost:5000`. In non-production mode the API
permits local Vite origins on ports `5173` and `5174` (and loopback equivalents).

Useful validation commands:

```bash
npm --prefix server test
npm --prefix server run build
npm --prefix client run lint
npm --prefix client run build
```

## Validation

The repository includes server tests for task/defect rules, payroll calculation
and validation, and code-analysis behavior. At the time this guide was written,
validation completed successfully:

- Server test suite: 29 passing tests.
- Server TypeScript build.
- Client ESLint.
- Client TypeScript/Vite production build.

These checks validate code and tested business rules; they do not substitute
for staging tests against the organization's MongoDB deployment or an external
payroll provider.

## Current limitations

- Payroll proposals are not uploaded to a provider, transferred as wages, or
  reconciled with an external payroll system.
- There is no full payroll-period entity/state machine, finalization operation,
  or immutable payslip workflow.
- The resolved-defect legacy-hours backfill is an exception to the monthly
  proposal workflow: it creates a pending adjustment directly.
- The dispute feature currently applies to pending deduction proposals; it is
  not a general dispute workflow for finalized payroll.
- The in-app notification affordance is a pending-review summary, not a
  persistent notification center with delivery, acknowledgment, or history.
- Task assignment history is not a separate record. Assignment changes do not
  have their own complete event history.
- Some manager task-review actions update status through the review workflow
  rather than the shared status-transition endpoint; task transition
  enforcement and history should be unified before relying on lifecycle
  records as a complete audit.
- Legacy tasks/defects may not have delivery snapshots or original-contributor
  data. Fallback attribution uses current task data and cannot establish
  historical certainty.
- The quality reports do not yet implement every requested metric/filter, such
  as first-pass acceptance, repeat-defect tracking, finalized payroll totals,
  or outstanding disputes as a report dimension.
- Payroll cause policy is currently code-defect debit versus non-code-defect
  credit. The organization must validate this policy and applicable employment
  law before using proposals operationally.
- Audit records cover important decisions but are not a complete append-only
  event ledger for every workflow transition.
- Local AI suggestions are bounded and reviewed, but their accuracy is not
  guaranteed; static checks also produce candidates that require human review.
