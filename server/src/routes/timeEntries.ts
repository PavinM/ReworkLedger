import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { createTimeEntrySchema, reviewTimeEntrySchema } from '../validation/schemas.js';
import { createTimeEntry, getTimeEntry, listTimeEntries, reviewTimeEntry } from '../controllers/timeEntries.js';

export const timeEntryRouter = Router();
timeEntryRouter.use(authenticate);
timeEntryRouter.get('/', asyncHandler(listTimeEntries));
timeEntryRouter.post('/', validateBody(createTimeEntrySchema), asyncHandler(createTimeEntry));
timeEntryRouter.get('/:id', asyncHandler(getTimeEntry));
timeEntryRouter.patch('/:id/review', requireRoles('manager', 'admin'), validateBody(reviewTimeEntrySchema), asyncHandler(reviewTimeEntry));
