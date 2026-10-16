import type { RequestHandler } from 'express';

/**
 * Authentication is not implemented in milestone 1. Keep this middleware at
 * the route boundary so a real JWT/session guard can replace it later.
 * Set AUTH_REQUIRED=true in a deployment only after that guard is implemented.
 */
export const developmentAccess: RequestHandler = (_req, _res, next) => {
  next();
};
