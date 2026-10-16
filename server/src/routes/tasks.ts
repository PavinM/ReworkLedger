import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validation.js';
import { createTaskSchema, updateTaskStatusSchema } from '../validation/schemas.js';
import { createTask, getTask, listTasks, updateTaskStatus } from '../controllers/tasks.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

export const taskRouter = Router();
taskRouter.use(authenticate);
taskRouter.get('/', asyncHandler(listTasks));
taskRouter.post('/', requireRoles('manager', 'admin'), validateBody(createTaskSchema), asyncHandler(createTask));
taskRouter.get('/:id', asyncHandler(getTask));
taskRouter.patch('/:id/status', requireRoles('employee', 'manager', 'admin'), validateBody(updateTaskStatusSchema), asyncHandler(updateTaskStatus));
