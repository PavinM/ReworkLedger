import type { Types } from 'mongoose';

export const projectStatuses = ['active', 'completed', 'archived'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const taskStatuses = ['assigned', 'in_progress', 'completed', 'reopened', 'under_fix', 'closed'] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const defectSeverities = ['low', 'medium', 'high', 'critical'] as const;
export type DefectSeverity = (typeof defectSeverities)[number];

export const defectCauses = ['code_defect', 'requirement_change', 'external_dependency', 'other'] as const;
export type DefectCause = (typeof defectCauses)[number];

export const defectStatuses = ['reported', 'under_review', 'approved', 'exempted', 'resolved'] as const;
export type DefectStatus = (typeof defectStatuses)[number];

export const timeEntryCategories = ['regular_work', 'corrective_work'] as const;
export type TimeEntryCategory = (typeof timeEntryCategories)[number];

export const approvalStatuses = ['pending', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const payrollStatuses = ['draft', 'pending_review', 'approved', 'rejected', 'voided'] as const;
export type PayrollStatus = (typeof payrollStatuses)[number];

export type ObjectId = Types.ObjectId;
