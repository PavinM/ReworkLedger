import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { taskStatuses, type TaskStatus } from '../types/domain.js';

export interface TaskDocument extends Document {
  projectId: Types.ObjectId;
  title: string;
  description?: string;
  progressDescription?: string;
  reviewStatus: 'not_submitted' | 'submitted' | 'changes_requested' | 'accepted';
  reviewReason?: string;
  reviewedBy?: Types.ObjectId;
  assigneeId: Types.ObjectId;
  assigneeName: string;
  status: TaskStatus;
  originalCompletedAt?: Date;
  currentCompletedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<TaskDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project', index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000 },
    progressDescription: { type: String, trim: true, maxlength: 4000 },
    reviewStatus: { type: String, enum: ['not_submitted', 'submitted', 'changes_requested', 'accepted'], default: 'not_submitted', required: true, index: true },
    reviewReason: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assigneeId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    assigneeName: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
    status: { type: String, enum: taskStatuses, default: 'assigned', required: true, index: true },
    originalCompletedAt: { type: Date },
    currentCompletedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: true },
);

taskSchema.index({ projectId: 1, status: 1 });

export const Task: Model<TaskDocument> = model<TaskDocument>('Task', taskSchema);
