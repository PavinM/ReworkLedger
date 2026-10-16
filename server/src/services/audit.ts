import type { ClientSession, Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';

export async function recordAudit(input: {
  actorId?: Types.ObjectId;
  entityType: 'Task' | 'Defect' | 'User' | 'TimeEntry' | 'PayrollAdjustment';
  entityId: Types.ObjectId;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}, session?: ClientSession): Promise<void> {
  await AuditLog.create([input], session ? { session } : undefined);
}
