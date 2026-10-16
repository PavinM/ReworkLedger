import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { payrollStatuses, type PayrollStatus } from '../types/domain.js';

export interface CalculationLine {
  timeEntryId: Types.ObjectId;
  taskId: Types.ObjectId;
  defectId: Types.ObjectId;
  date: Date;
  hours: number;
  hourlyRate: number;
  amount: number;
}

export interface PayrollAdjustmentDocument extends Document {
  employeeId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  approvedTimeEntryIds: Types.ObjectId[];
  eligibleCorrectiveHours: number;
  configuredHourlyRate: number;
  proposedAmount: number;
  baseSalary: number;
  nextMonthSalary: number;
  adjustmentType: 'credit' | 'debit' | 'none';
  calculationBreakdown: CalculationLine[];
  status: PayrollStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const calculationLineSchema = new Schema<CalculationLine>(
  {
    timeEntryId: { type: Schema.Types.ObjectId, required: true, ref: 'TimeEntry' },
    taskId: { type: Schema.Types.ObjectId, required: true, ref: 'Task' },
    defectId: { type: Schema.Types.ObjectId, required: true, ref: 'Defect' },
    date: { type: Date, required: true },
    hours: { type: Number, required: true, min: 0 },
    hourlyRate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const payrollAdjustmentSchema = new Schema<PayrollAdjustmentDocument>(
  {
    employeeId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    approvedTimeEntryIds: [{ type: Schema.Types.ObjectId, required: true, ref: 'TimeEntry' }],
    eligibleCorrectiveHours: { type: Number, required: true, min: 0 },
    configuredHourlyRate: { type: Number, required: true, min: 0 },
    proposedAmount: { type: Number, required: true, min: 0 },
    baseSalary: { type: Number, required: true, min: 0, default: 50000 },
    nextMonthSalary: { type: Number, required: true, min: 0, default: 50000 },
    adjustmentType: { type: String, enum: ['credit', 'debit', 'none'], required: true, default: 'none' },
    calculationBreakdown: { type: [calculationLineSchema], required: true },
    status: { type: String, enum: payrollStatuses, required: true, default: 'pending_review', index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewReason: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

payrollAdjustmentSchema.index({ employeeId: 1, periodStart: 1, periodEnd: 1, status: 1 });

export const PayrollAdjustment: Model<PayrollAdjustmentDocument> = model<PayrollAdjustmentDocument>('PayrollAdjustment', payrollAdjustmentSchema);
