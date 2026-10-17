import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { taskStatuses, type TaskStatus } from '../types/domain.js';

export interface TaskDocument extends Document {
  projectId: Types.ObjectId;
  title: string;
  description?: string;
  committedAt?: Date;
  progressDescription?: string;
  reviewStatus: 'not_submitted' | 'submitted' | 'changes_requested' | 'accepted';
  reviewReason?: string;
  reviewedBy?: Types.ObjectId;
  assigneeId: Types.ObjectId;
  assigneeName: string;
  contributorIds: Types.ObjectId[];
  status: TaskStatus;
  originalCompletedAt?: Date;
  currentCompletedAt?: Date;
  statusHistory: Array<{
    fromStatus?: TaskStatus;
    toStatus: TaskStatus;
    changedBy: Types.ObjectId;
    changedAt: Date;
    reason?: string;
  }>;
  deliveryHistory: Array<{
    _id?: Types.ObjectId;
    version: number;
    projectId: Types.ObjectId;
    taskTitle: string;
    deliveredAt: Date;
    acceptedBy: Types.ObjectId;
    contributors: Array<{ employeeId: Types.ObjectId; name: string }>;
  }>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<TaskDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project', index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000 },
    committedAt: { type: Date },
    progressDescription: { type: String, trim: true, maxlength: 4000 },
    reviewStatus: { type: String, enum: ['not_submitted', 'submitted', 'changes_requested', 'accepted'], default: 'not_submitted', required: true, index: true },
    reviewReason: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assigneeId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    assigneeName: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
    contributorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: taskStatuses, default: 'assigned', required: true, index: true },
    originalCompletedAt: { type: Date },
    currentCompletedAt: { type: Date },
    statusHistory: [{
      fromStatus: { type: String, enum: taskStatuses },
      toStatus: { type: String, enum: taskStatuses, required: true },
      changedBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
      changedAt: { type: Date, required: true, default: Date.now },
      reason: { type: String, trim: true, maxlength: 2000 },
    }],
    deliveryHistory: [{
      version: { type: Number, required: true, min: 1 },
      projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project' },
      taskTitle: { type: String, required: true, trim: true, maxlength: 200 },
      deliveredAt: { type: Date, required: true },
      acceptedBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
      contributors: [{
        employeeId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
        name: { type: String, required: true, trim: true, maxlength: 160 },
      }],
    }],
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: true },
);

taskSchema.index({ projectId: 1, status: 1 });

export const Task: Model<TaskDocument> = model<TaskDocument>('Task', taskSchema);
