import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validation.js';
import { createProjectSchema } from '../validation/schemas.js';
import { createProject, getProject, listEmployees, listProjects } from '../controllers/projects.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

export const projectRouter = Router();
projectRouter.use(authenticate);
projectRouter.get('/', asyncHandler(listProjects));
projectRouter.get('/employees', requireRoles('manager', 'admin'), asyncHandler(listEmployees));
projectRouter.post('/', requireRoles('manager', 'admin'), validateBody(createProjectSchema), asyncHandler(createProject));
projectRouter.get('/:id', asyncHandler(getProject));
