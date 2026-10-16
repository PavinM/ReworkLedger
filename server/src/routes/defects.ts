import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validation.js';
import { createDefectSchema, reviewDefectSchema } from '../validation/schemas.js';
import { createDefect, getDefect, listDefects, reviewDefect } from '../controllers/defects.js';
import { developmentAccess } from '../middleware/auth.js';

export const defectRouter = Router();
defectRouter.use(developmentAccess);
defectRouter.get('/', asyncHandler(listDefects));
defectRouter.post('/', validateBody(createDefectSchema), asyncHandler(createDefect));
defectRouter.get('/:id', asyncHandler(getDefect));
defectRouter.patch('/:id/review', validateBody(reviewDefectSchema), asyncHandler(reviewDefect));
