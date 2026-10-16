import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { calculatePayrollSchema, reviewPayrollSchema, voidPayrollSchema } from '../validation/schemas.js';
import { calculatePayroll, getPayroll, listPayroll, reviewPayroll, voidPayroll } from '../controllers/payroll.js';

export const payrollRouter = Router();
payrollRouter.use(authenticate);
payrollRouter.use(requireRoles('manager', 'admin'));
payrollRouter.post('/calculate', validateBody(calculatePayrollSchema), asyncHandler(calculatePayroll));
payrollRouter.get('/', asyncHandler(listPayroll));
payrollRouter.get('/:id', asyncHandler(getPayroll));
payrollRouter.patch('/:id/review', validateBody(reviewPayrollSchema), asyncHandler(reviewPayroll));
payrollRouter.patch('/:id/void', validateBody(voidPayrollSchema), asyncHandler(voidPayroll));
