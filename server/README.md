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

For the local development workspace, the initial role accounts are:

| Role | Email | Password |
| --- | --- | --- |
| Employee | `emp@gmail.com` | `123456` |
| Manager | `man@gmail.com` | `123456` |
| Administrator | `admin@gmail.com` | `123456` |

Change these credentials before using a shared or production environment. Only
administrators can create, activate, or deactivate employee and manager
accounts from the Settings page. The API derives actor identities from the verified token and
does not trust reviewer/employee IDs supplied by clients.

During non-production development, the API allows local Vite origins on
alternate ports such as `5174`. Create real organization accounts through the
authenticated account-management workflow; no demo users or seed data are
included.
