import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { listAuditLogs } from '../controllers/audit.js';

export const auditRouter = Router();
auditRouter.use(authenticate, requireRoles('manager', 'admin'));
auditRouter.get('/', asyncHandler(listAuditLogs));
