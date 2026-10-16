import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { createDefectFromFinding, listScans, reviewFinding, startScan, uploadProject } from '../controllers/analysis.js';
import { validateBody } from '../middleware/validation.js';
import { createDefectFromFindingSchema, reviewFindingSchema } from '../validation/schemas.js';

export const analysisRouter = Router();
analysisRouter.use(authenticate);
analysisRouter.get('/tasks/:taskId/scans', asyncHandler(listScans));
analysisRouter.post('/tasks/:taskId/scans', uploadProject.single('project'), asyncHandler(startScan));
analysisRouter.patch('/scans/:scanId/findings/:findingId/review', requireRoles('manager', 'admin'), validateBody(reviewFindingSchema), asyncHandler(reviewFinding));
analysisRouter.post('/scans/:scanId/findings/:findingId/defect', requireRoles('manager', 'admin'), validateBody(createDefectFromFindingSchema), asyncHandler(createDefectFromFinding));
