import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { calculatePayrollSchema, payrollDisputeSchema, reviewPayrollDisputeSchema, reviewPayrollSchema, voidPayrollSchema } from '../validation/schemas.js';
import { calculatePayroll, getPayroll, listPayroll, listPayrollEmployees, reviewPayroll, reviewPayrollDispute, submitPayrollDispute, voidPayroll } from '../controllers/payroll.js';

export const payrollRouter = Router();
payrollRouter.use(authenticate);
payrollRouter.get('/', asyncHandler(listPayroll));
payrollRouter.get('/employees', requireRoles('manager', 'admin'), asyncHandler(listPayrollEmployees));
payrollRouter.get('/:id', asyncHandler(getPayroll));
payrollRouter.post('/calculate', requireRoles('manager', 'admin'), validateBody(calculatePayrollSchema), asyncHandler(calculatePayroll));
payrollRouter.post('/:id/dispute', requireRoles('employee'), validateBody(payrollDisputeSchema), asyncHandler(submitPayrollDispute));
payrollRouter.patch('/:id/dispute', requireRoles('manager', 'admin'), validateBody(reviewPayrollDisputeSchema), asyncHandler(reviewPayrollDispute));
payrollRouter.patch('/:id/review', requireRoles('manager', 'admin'), validateBody(reviewPayrollSchema), asyncHandler(reviewPayroll));
payrollRouter.patch('/:id/void', requireRoles('manager', 'admin'), validateBody(voidPayrollSchema), asyncHandler(voidPayroll));
