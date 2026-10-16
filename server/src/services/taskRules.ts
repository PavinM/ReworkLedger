import type { TaskStatus } from '../types/domain.js';

export const validTaskTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  assigned: ['in_progress'],
  in_progress: ['completed'],
  completed: ['reopened', 'closed'],
  reopened: ['under_fix'],
  under_fix: ['completed', 'closed'],
  closed: [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return validTaskTransitions[from].includes(to);
}

export function getCompletionDates(
  status: TaskStatus,
  existingOriginalCompletedAt: Date | undefined,
  now: Date,
): { originalCompletedAt?: Date; currentCompletedAt?: Date } {
  if (status !== 'completed') {
    return { originalCompletedAt: existingOriginalCompletedAt };
  }

  return {
    originalCompletedAt: existingOriginalCompletedAt ?? now,
    currentCompletedAt: now,
  };
}
