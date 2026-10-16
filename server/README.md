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
- `GET /api/defects`
- `POST /api/defects`
- `GET /api/defects/:id`
- `PATCH /api/defects/:id/review`
- `POST /api/time-entries`
- `GET /api/time-entries`
- `GET /api/time-entries/:id`
- `PATCH /api/time-entries/:id/review`
- `POST /api/payroll/calculate`
- `GET /api/payroll`
- `GET /api/payroll/:id`
- `PATCH /api/payroll/:id/review`
- `PATCH /api/payroll/:id/void`
- `GET /api/audit-logs`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`

All request bodies are validated with Zod. Successful creates return `201`;
invalid input returns `400`; missing resources return `404`.

Defects can only be reported for completed tasks. The task's `projectId` is
always used when creating a defect. An approved defect reopens its task while
preserving `originalCompletedAt`; an exemption requires `reviewReason`.

Corrective time entries require an approved defect. Payroll calculation uses
only approved, unreserved corrective entries in the selected employee/date
period and stores the exact calculation lines. Reservation and adjustment
creation run in a MongoDB transaction, so a time entry cannot be included in
two concurrent adjustments. Calculations create proposed adjustments only;
they do not modify salary records or initiate payments.

Set a long random `JWT_SECRET` in the server environment. JWTs expire after
eight hours. The API derives actor identities from the verified token and
does not trust reviewer/employee IDs supplied by clients.

## Demo seed

The seed is intentionally local-development-only. It refuses to run unless
`DEMO_MODE=true` and `NODE_ENV` is not `production`. It only inserts or
updates records identified by the `[DEMO]` marker and never deletes existing
data.

```bash
DEMO_MODE=true npm run seed:demo
```

Run the seed before using the demo credentials. If the frontend is served on
Vite's alternate development port (`5174`), the API allows both local Vite
ports during non-production development.

The script uses local-only placeholder identities. Do not use these records as
real employee identities or salary data. After seeding, the local demo
accounts are:

```text
manager.demo@reworkledger.local
employee.demo@reworkledger.local
admin.demo@reworkledger.local
password: DemoReworkLedger!2026
```

These credentials are only for the explicit local demonstration workflow and
must never be reused in a deployed environment.
