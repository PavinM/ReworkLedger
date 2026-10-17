import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { approvalStatuses, timeEntryCategories, type ApprovalStatus, type TimeEntryCategory } from '../types/domain.js';

export interface TimeEntryDocument extends Document {
  taskId: Types.ObjectId;
  defectId?: Types.ObjectId;
  employeeId: Types.ObjectId;
  date: Date;
  hours: number;
  description?: string;
  category: TimeEntryCategory;
  source: 'manual' | 'resolution_submission' | 'manager_backfill';
  compensationHourlyRate?: number;
  compensationBaseSalary?: number;
  compensationCurrency?: string;
  approvalStatus: ApprovalStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewReason?: string;
  payrollAdjustmentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const timeEntrySchema = new Schema<TimeEntryDocument>(
  {
    taskId: { type: Schema.Types.ObjectId, required: true, ref: 'Task', index: true },
    defectId: { type: Schema.Types.ObjectId, ref: 'Defect', index: true },
    employeeId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    date: { type: Date, required: true, index: true },
    hours: { type: Number, required: true, min: 0.01, max: 24 },
    description: { type: String, trim: true, maxlength: 2000 },
    category: { type: String, enum: timeEntryCategories, required: true, index: true },
    source: { type: String, enum: ['manual', 'resolution_submission', 'manager_backfill'], required: true, default: 'manual' },
    compensationHourlyRate: { type: Number, min: 0, max: 100000 },
    compensationBaseSalary: { type: Number, min: 0, max: 100000000 },
    compensationCurrency: { type: String, uppercase: true, minlength: 3, maxlength: 3 },
    approvalStatus: { type: String, enum: approvalStatuses, default: 'pending', required: true, index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewReason: { type: String, trim: true, maxlength: 2000 },
    payrollAdjustmentId: { type: Schema.Types.ObjectId, ref: 'PayrollAdjustment', index: true },
  },
  { timestamps: true },
);

timeEntrySchema.index({ employeeId: 1, date: 1, approvalStatus: 1 });
timeEntrySchema.index({ payrollAdjustmentId: 1, approvalStatus: 1 });
timeEntrySchema.index(
  { defectId: 1, source: 1 },
  { unique: true, partialFilterExpression: { source: 'resolution_submission' } },
);

export const TimeEntry: Model<TimeEntryDocument> = model<TimeEntryDocument>('TimeEntry', timeEntrySchema);
