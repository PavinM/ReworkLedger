import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validation.js';
import { createProjectSchema } from '../validation/schemas.js';
import { createProject, getProject, listProjects } from '../controllers/projects.js';
import { developmentAccess } from '../middleware/auth.js';

export const projectRouter = Router();
projectRouter.use(developmentAccess);
projectRouter.get('/', asyncHandler(listProjects));
projectRouter.post('/', validateBody(createProjectSchema), asyncHandler(createProject));
projectRouter.get('/:id', asyncHandler(getProject));
