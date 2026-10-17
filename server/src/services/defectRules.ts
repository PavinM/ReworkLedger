import type { DefectStatus, TaskStatus } from '../types/domain.js';

export function canReportDefect(taskStatus: TaskStatus): boolean {
  return taskStatus === 'completed' || taskStatus === 'closed';
}

export function validateReviewDecision(status: DefectStatus, reviewReason?: string): string | undefined {
  if (status !== 'approved' && status !== 'exempted') {
    return 'Review status must be approved or exempted';
  }
  if (status === 'exempted' && !reviewReason?.trim()) {
    return 'An exemption reason is required';
  }
  return undefined;
}

export function shouldReopenTask(reviewStatus: DefectStatus, taskStatus: TaskStatus): boolean {
  return reviewStatus === 'approved' && (taskStatus === 'completed' || taskStatus === 'closed');
}
