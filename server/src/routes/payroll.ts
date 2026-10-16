import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { calculatePayrollSchema, reviewPayrollSchema, voidPayrollSchema } from '../validation/schemas.js';
import { calculatePayroll, getPayroll, listPayroll, reviewPayroll, voidPayroll } from '../controllers/payroll.js';

export const payrollRouter = Router();
payrollRouter.use(authenticate);
payrollRouter.get('/', asyncHandler(listPayroll));
payrollRouter.get('/:id', asyncHandler(getPayroll));
payrollRouter.post('/calculate', requireRoles('manager', 'admin'), validateBody(calculatePayrollSchema), asyncHandler(calculatePayroll));
payrollRouter.patch('/:id/review', requireRoles('manager', 'admin'), validateBody(reviewPayrollSchema), asyncHandler(reviewPayroll));
payrollRouter.patch('/:id/void', requireRoles('manager', 'admin'), validateBody(voidPayrollSchema), asyncHandler(voidPayroll));
