import type { DefectStatus, TaskStatus, TimeEntryCategory } from '../types/domain.js';

export function validateTimeEntryEligibility(
  category: TimeEntryCategory,
  hasDefect: boolean,
  defectStatus?: DefectStatus,
  taskStatus?: TaskStatus,
): string | undefined {
  if (category === 'corrective_work') {
    if (!hasDefect) return 'Corrective work must reference a defect';
    if (defectStatus !== 'approved') return 'Defect is not eligible for corrective work';
    if (taskStatus !== 'reopened' && taskStatus !== 'under_fix') {
      return 'Corrective work can only be logged while the task is reopened or under fix';
    }
  }
  if (category === 'regular_work' && hasDefect) return 'Regular work cannot reference a defect';
  return undefined;
}

export function canReviewTimeEntry(
  approvalStatus: 'pending' | 'approved' | 'rejected',
  employeeId: string,
  reviewerId: string,
): string | undefined {
  if (approvalStatus !== 'pending') return 'Only pending time entries can be reviewed';
  if (employeeId === reviewerId) return 'Employees cannot review their own time entries';
  return undefined;
}
