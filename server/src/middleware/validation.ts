import type { RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from './errors.js';

export const validateBody = (schema: z.ZodType): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    next(new HttpError(400, 'Request body is invalid', result.error.flatten()));
    return;
  }
  req.body = result.data;
  next();
};
