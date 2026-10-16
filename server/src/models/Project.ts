import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { projectStatuses, type ProjectStatus } from '../types/domain.js';

export interface ProjectDocument extends Document {
  name: string;
  description?: string;
  githubUrl?: string;
  deadline?: Date;
  assignedEmployeeId?: Types.ObjectId;
  status: ProjectStatus;
  managerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000 },
    githubUrl: { type: String, trim: true, maxlength: 500 },
    deadline: { type: Date },
    assignedEmployeeId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    status: { type: String, enum: projectStatuses, default: 'active', required: true },
    managerId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  },
  { timestamps: true },
);

projectSchema.index({ status: 1, updatedAt: -1 });

export const Project: Model<ProjectDocument> = model<ProjectDocument>('Project', projectSchema);
