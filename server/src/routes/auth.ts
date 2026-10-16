import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { loginSchema, registerEmployeeSchema } from '../validation/schemas.js';
import { login, me, registerEmployee } from '../controllers/auth.js';

export const authRouter = Router();
authRouter.post('/login', validateBody(loginSchema), asyncHandler(login));
authRouter.post('/register', validateBody(registerEmployeeSchema), asyncHandler(registerEmployee));
authRouter.get('/me', authenticate, asyncHandler(me));
