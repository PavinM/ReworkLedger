import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import {
  defectCauses,
  defectSeverities,
  defectStatuses,
  type DefectCause,
  type DefectSeverity,
  type DefectStatus,
} from '../types/domain.js';

export interface DefectDocument extends Document {
  taskId: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  description?: string;
  severity: DefectSeverity;
  cause: DefectCause;
  status: DefectStatus;
  reportedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const defectSchema = new Schema<DefectDocument>(
  {
    taskId: { type: Schema.Types.ObjectId, required: true, ref: 'Task', index: true },
    projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project', index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000 },
    severity: { type: String, enum: defectSeverities, required: true },
    cause: { type: String, enum: defectCauses, required: true },
    status: { type: String, enum: defectStatuses, default: 'reported', required: true, index: true },
    reportedBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewReason: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

defectSchema.index({ projectId: 1, status: 1, severity: 1 });

export const Defect: Model<DefectDocument> = model<DefectDocument>('Defect', defectSchema);
