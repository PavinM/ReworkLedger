import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { HttpError } from './errors.js';
import { userRoles, type UserRole } from '../models/User.js';

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is not configured');
  return value;
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return next(new HttpError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(header.slice(7), secret());
    if (typeof payload !== 'object' || typeof payload.sub !== 'string' || !userRoles.includes(payload.role as UserRole)) {
      return next(new HttpError(401, 'Invalid authentication token'));
    }
    req.user = { id: payload.sub, role: payload.role as UserRole };
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired authentication token'));
  }
};

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to perform this action'));
    return next();
  };
}

/** @deprecated Use authenticate and requireRoles. Kept only for old imports. */
export const developmentAccess = authenticate;
