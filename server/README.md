# ReworkLedger API

Milestone 1 provides project, task, and defect management over the existing
MongoDB connection.

## Development

```bash
npm run dev
npm run build
npm test
```

The resource routes currently use `developmentAccess`. Authentication and
role-based authorization are not implemented yet; these endpoints must not be
deployed publicly until that middleware is replaced with a real authenticated
guard.

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

All request bodies are validated with Zod. Successful creates return `201`;
invalid input returns `400`; missing resources return `404`.

Defects can only be reported for completed tasks. The task's `projectId` is
always used when creating a defect. An approved defect reopens its task while
preserving `originalCompletedAt`; an exemption requires `reviewReason`.
