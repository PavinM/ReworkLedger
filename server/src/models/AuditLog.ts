import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export interface AuditLogDocument extends Document {
  actorId?: Types.ObjectId;
  entityType: 'Task' | 'Defect' | 'User' | 'TimeEntry' | 'PayrollAdjustment';
  entityId: Types.ObjectId;
  action: string;
  timestamp: Date;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    entityType: { type: String, enum: ['Task', 'Defect', 'User', 'TimeEntry', 'PayrollAdjustment'], required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    reason: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: false },
);

export const AuditLog: Model<AuditLogDocument> = model<AuditLogDocument>('AuditLog', auditLogSchema);
