import type { RequestHandler } from 'express';
import { AuditLog } from '../models/AuditLog.js';

export const listAuditLogs: RequestHandler = async (req, res) => {
  const filter: Record<string, string> = {};
  if (typeof req.query.entityType === 'string') filter.entityType = req.query.entityType;
  if (typeof req.query.entityId === 'string') filter.entityId = req.query.entityId;
  const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(100).lean();
  res.json({ data: logs });
};
