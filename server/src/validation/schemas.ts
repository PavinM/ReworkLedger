import mongoose from 'mongoose';
import { z } from 'zod';
import { approvalStatuses, defectCauses, defectSeverities, defectStatuses, projectStatuses, taskStatuses, timeEntryCategories } from '../types/domain.js';

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

const date = z.coerce.date();

export const createTimeEntrySchema = z.object({
  taskId: objectId,
  defectId: objectId.optional(),
  employeeId: objectId.optional(),
  date,
  hours: z.number().finite().positive().max(24),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(timeEntryCategories),
});

export const timeEntryQuerySchema = z.object({
  employeeId: objectId.optional(),
  taskId: objectId.optional(),
  defectId: objectId.optional(),
  approvalStatus: z.enum(approvalStatuses).optional(),
  startDate: date.optional(),
  endDate: date.optional(),
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate must be on or after startDate' });
  }
});

export const reviewTimeEntrySchema = z.object({
  approvalStatus: z.enum(['approved', 'rejected']),
  reviewedBy: objectId,
  reviewReason: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.approvalStatus === 'rejected' && !value.reviewReason) {
    context.addIssue({ code: 'custom', path: ['reviewReason'], message: 'A rejection reason is required' });
  }
});

export const calculatePayrollSchema = z.object({
  employeeId: objectId,
  periodStart: date,
  periodEnd: date,
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, 'currency must be a 3-letter ISO code').transform((value) => value.toUpperCase()),
  configuredHourlyRate: z.number().finite().nonnegative().max(100000),
}).superRefine((value, context) => {
  if (value.periodStart > value.periodEnd) {
    context.addIssue({ code: 'custom', path: ['periodEnd'], message: 'periodEnd must be on or after periodStart' });
  }
});

export const reviewPayrollSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewedBy: objectId,
  reviewReason: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.status === 'rejected' && !value.reviewReason) {
    context.addIssue({ code: 'custom', path: ['reviewReason'], message: 'A rejection reason is required' });
  }
});

export const voidPayrollSchema = z.object({
  reviewedBy: objectId,
  reviewReason: z.string().trim().min(1).max(2000),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
});

export const registerEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
});
