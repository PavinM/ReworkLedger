import mongoose from 'mongoose';
import { z } from 'zod';
import { approvalStatuses, defectCauses, defectSeverities, defectStatuses, projectStatuses, taskStatuses, timeEntryCategories } from '../types/domain.js';

const objectId = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), 'Must be a valid MongoDB ObjectId');

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(projectStatuses).optional(),
  managerId: objectId,
  githubUrl: z.string().trim().url().max(500).optional(),
  deadline: z.coerce.date().optional(),
  assignedEmployeeId: objectId.optional(),
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

export const updateTaskProgressSchema = z.object({
  progressDescription: z.string().trim().min(1).max(4000),
});

export const submitTaskReviewSchema = z.object({
  reviewStatus: z.enum(['submitted', 'changes_requested', 'accepted']),
  reviewReason: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.reviewStatus === 'changes_requested' && !value.reviewReason) {
    context.addIssue({ code: 'custom', path: ['reviewReason'], message: 'A reason is required for this review decision' });
  }
});

export const createDefectSchema = z.object({
  taskId: objectId,
  module: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  debugInstructions: z.string().trim().min(1).max(4000),
  severity: z.enum(defectSeverities),
  cause: z.enum(defectCauses),
  reportedBy: objectId,
  estimatedResolutionHours: z.number().finite().min(0.25).max(24).optional(),
  estimateModel: z.string().trim().min(1).max(200).optional(),
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

export const resolveDefectSchema = z.object({
  resolutionDescription: z.string().trim().min(1).max(4000),
  resolutionEvidence: z.string().trim().min(1).max(4000),
  resolutionHours: z.number().finite().positive().max(24),
});

export const acceptDefectResolutionSchema = z.object({
  reviewReason: z.string().trim().max(2000).optional(),
});

export const backfillResolvedDefectHoursSchema = z.object({
  hours: z.number().finite().positive().max(24),
  reviewReason: z.string().trim().min(1).max(2000),
});

export const reviewFindingSchema = z.object({
  status: z.enum(['confirmed_bug', 'false_positive', 'needs_information', 'accepted_risk']),
  reviewReason: z.string().trim().min(1).max(2000),
});

export const createDefectFromFindingSchema = z.object({
  cause: z.enum(defectCauses),
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
  baseSalary: z.number().finite().nonnegative().max(100000000).default(50000),
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
  password: z.string().min(6).max(200),
});

export const registerEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(200),
});

export const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(200),
  role: z.enum(['employee', 'manager']),
});

export const updateUserStatusSchema = z.object({
  active: z.boolean(),
});

export const updateOwnProfileSchema = z.object({
  currentPassword: z.string().min(6).max(200),
  name: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()).optional(),
  newPassword: z.string().min(6).max(200).optional(),
}).superRefine((value, context) => {
  if (!value.name && !value.email && !value.newPassword) {
    context.addIssue({ code: 'custom', path: [], message: 'Enter a profile change to save' });
  }
});
