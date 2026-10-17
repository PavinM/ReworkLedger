# ReworkLedger API

Milestone 1 provides project, task, and defect management over the existing
MongoDB connection.

## Development

```bash
npm run dev
npm run build
npm test
```

All resource routes require a JWT bearer token. The three roles are
`employee`, `manager`, and `admin`. Employee registration is public and always
creates an employee account; manager/admin accounts must be provisioned
privately. Review and payroll routes require manager or admin access.

## Endpoints

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `PATCH /api/tasks/:id/review`
- `GET /api/defects`
- `POST /api/defects`
- `GET /api/defects/:id`
- `PATCH /api/defects/:id/review`
- `PATCH /api/defects/:id/resolve`
- `PATCH /api/defects/:id/accept-resolution`
- `POST /api/time-entries`
- `GET /api/time-entries`
- `GET /api/time-entries/:id`
- `PATCH /api/time-entries/:id/review`
- `POST /api/payroll/calculate`
- `GET /api/payroll`
- `GET /api/payroll/employees`
- `GET /api/payroll/:id`
- `POST /api/payroll/:id/dispute`
- `PATCH /api/payroll/:id/dispute`
- `PATCH /api/payroll/:id/review`
- `PATCH /api/payroll/:id/void`
- `GET /api/audit-logs`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/auth/users`
- `PATCH /api/auth/users/:id/payroll-settings`

All request bodies are validated with Zod. Successful creates return `201`;
invalid input returns `400`; missing resources return `404`.

Code analysis always runs its existing static checks first. When enabled, it
also reviews bounded source chunks with a local Ollama service (defaults:
`http://127.0.0.1:11434`, model `qwen2.5-coder:3b`). Configure
`CODE_ANALYSIS_AI_ENABLED`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and
`OLLAMA_TIMEOUT_MS` in the server environment. Ollama URLs are restricted to
local HTTP hosts so uploaded source is not sent to a remote service. If Ollama
is unavailable, the scan completes with static results and records the AI
failure separately. AI findings are unverified suggestions and still require
the existing manager/admin review before they can create a defect. Uploaded
code is not executed.

Defects can only be reported for completed tasks. The task's `projectId` is
always used when creating a defect. An approved defect reopens its task while
preserving `originalCompletedAt`; an exemption requires `reviewReason`.

Employees can log corrective time only against their assigned task while it is
reopened or under fix, and only for an approved defect linked to that task.
Entries remain separately reviewable. Payroll calculation is a distinct
manager/admin monthly action using approved, unreserved corrective entries in
the selected employee/date period; it stores exact calculation lines and
reserves entries transactionally to prevent duplicate proposals. The monthly
payroll workspace loads active employee compensation settings and creates the
proposal for review. Rework proposals use the employee's configured hourly
rate, salary, and currency (legacy accounts retain the INR defaults).
Employees can dispute a pending deduction with a written reason. A manager or
administrator must resolve the dispute before reviewing the proposal;
accepting the dispute rejects the proposal, while denying it returns the
proposal to normal payroll review. Each action is audited. Approval records the
decision but does not initiate a bank payment.

Tasks keep committed dates, completion timestamps, delivery snapshots, and
status-change history. Accepted deliveries retain their task title, date,
contributors, and accepting manager; defect records retain the linked delivery
and original assignee. The task list includes lifecycle history with actor
names and reasons when available. The Quality intelligence view summarizes
reopen rates, fix time, rework by module/project/employee, and monthly approved
savings and pending payroll proposals.

Corrective entries keep their source, employee compensation snapshot, defect
cause, approval state, and payroll reservation. A manager can approve or reject
proposals with a reason, and each decision is audited. Legacy tasks without
delivery snapshots use the available task assignee as a fallback, so historical
contributor attribution is not guaranteed for records created before snapshots
were introduced. Payroll adjustments are reviewed proposals; approval records
the decision but does not apply wages in an external payroll provider or
transfer funds. Connect a payroll provider and agree the organization's
deduction policy before representing a proposal as an applied payroll change.

Set a long random `JWT_SECRET` in the server environment. JWTs expire after
eight hours. The API derives actor identities from the verified token and

No default role accounts are provisioned by the application. Public
registration creates employee accounts; manager and administrator accounts
must be provisioned securely out of band before the admin account-management
workflow can be used. Only administrators can create, activate, or deactivate
employee and manager accounts from the Settings page. The API derives actor
identities from the verified token and does not trust reviewer/employee IDs
supplied by clients.

During non-production development, the API allows local Vite origins on
alternate ports such as `5174`. Create real organization accounts through the
authenticated account-management workflow; no demo users or seed data are
included.
