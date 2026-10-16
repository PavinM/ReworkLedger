import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { createStaffSchema, loginSchema, registerEmployeeSchema, updateOwnProfileSchema, updateUserPayrollSchema, updateUserStatusSchema } from '../validation/schemas.js';
import { createStaff, listUsers, login, me, registerEmployee, updateOwnProfile, updateUserPayrollSettings, updateUserStatus } from '../controllers/auth.js';
import { requireRoles } from '../middleware/auth.js';

export const authRouter = Router();
authRouter.post('/login', validateBody(loginSchema), asyncHandler(login));
authRouter.post('/register', validateBody(registerEmployeeSchema), asyncHandler(registerEmployee));
authRouter.get('/me', authenticate, asyncHandler(me));
authRouter.patch('/me/profile', authenticate, validateBody(updateOwnProfileSchema), asyncHandler(updateOwnProfile));
authRouter.get('/users', authenticate, requireRoles('admin'), asyncHandler(listUsers));
authRouter.post('/users', authenticate, requireRoles('admin'), validateBody(createStaffSchema), asyncHandler(createStaff));
authRouter.patch('/users/:id/status', authenticate, requireRoles('admin'), validateBody(updateUserStatusSchema), asyncHandler(updateUserStatus));
authRouter.patch('/users/:id/payroll-settings', authenticate, requireRoles('admin'), validateBody(updateUserPayrollSchema), asyncHandler(updateUserPayrollSettings));
