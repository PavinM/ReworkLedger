import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validation.js';
import { acceptDefectResolutionSchema, createDefectSchema, resolveDefectSchema, reviewDefectSchema } from '../validation/schemas.js';
import { acceptDefectResolution, createDefect, getDefect, listDefects, reviewDefect, submitDefectResolution } from '../controllers/defects.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

export const defectRouter = Router();
defectRouter.use(authenticate);
defectRouter.get('/', asyncHandler(listDefects));
defectRouter.post('/', validateBody(createDefectSchema), asyncHandler(createDefect));
defectRouter.get('/:id', asyncHandler(getDefect));
defectRouter.patch('/:id/review', requireRoles('manager', 'admin'), validateBody(reviewDefectSchema), asyncHandler(reviewDefect));
defectRouter.patch('/:id/resolve', requireRoles('employee'), validateBody(resolveDefectSchema), asyncHandler(submitDefectResolution));
defectRouter.patch('/:id/accept-resolution', requireRoles('manager', 'admin'), validateBody(acceptDefectResolutionSchema), asyncHandler(acceptDefectResolution));
