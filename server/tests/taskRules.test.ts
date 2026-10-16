import assert from 'node:assert/strict';
import test from 'node:test';
import { canTransitionTask, getCompletionDates } from '../src/services/taskRules.js';

test('allows completing an in-progress task', () => {
  assert.equal(canTransitionTask('in_progress', 'completed'), true);
});

test('rejects invalid task status transitions', () => {
  assert.equal(canTransitionTask('assigned', 'closed'), false);
  assert.equal(canTransitionTask('closed', 'reopened'), false);
});

test('preserves original completion time when a reopened task is completed again', () => {
  const original = new Date('2026-05-01T10:00:00.000Z');
  const current = new Date('2026-05-03T10:00:00.000Z');
  const dates = getCompletionDates('completed', original, current);

  assert.equal(dates.originalCompletedAt?.toISOString(), original.toISOString());
  assert.equal(dates.currentCompletedAt?.toISOString(), current.toISOString());
});

test('records the first completion time for a task without delivery history', () => {
  const current = new Date('2026-05-03T10:00:00.000Z');
  const dates = getCompletionDates('completed', undefined, current);

  assert.equal(dates.originalCompletedAt?.toISOString(), current.toISOString());
  assert.equal(dates.currentCompletedAt?.toISOString(), current.toISOString());
});
