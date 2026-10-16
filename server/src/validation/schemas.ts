import mongoose from 'mongoose';
import { z } from 'zod';
import { defectCauses, defectSeverities, defectStatuses, projectStatuses, taskStatuses } from '../types/domain.js';

const objectId = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), 'Must be a valid MongoDB ObjectId');

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(projectStatuses).optional(),
  managerId: objectId,
});

export const createTaskSchema = z.object({
  projectId: objectId,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  assigneeId: objectId,
  assigneeName: z.string().trim().min(1).max(160),
  status: z.enum(taskStatuses).optional(),
  createdBy: objectId,
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(taskStatuses),
});

export const createDefectSchema = z.object({
  taskId: objectId,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  severity: z.enum(defectSeverities),
  cause: z.enum(defectCauses),
  reportedBy: objectId,
});

export const reviewDefectSchema = z.object({
  status: z.enum(defectStatuses).refine((value) => value === 'approved' || value === 'exempted', 'Review status must be approved or exempted'),
  reviewedBy: objectId,
  reviewReason: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.status === 'exempted' && !value.reviewReason) {
    context.addIssue({ code: 'custom', path: ['reviewReason'], message: 'An exemption reason is required' });
  }
});
