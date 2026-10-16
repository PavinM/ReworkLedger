import assert from 'node:assert/strict';
import test from 'node:test';
import { canReportDefect, shouldReopenTask, validateReviewDecision } from '../src/services/defectRules.js';

test('allows defect reporting only after task completion', () => {
  assert.equal(canReportDefect('completed'), true);
  assert.equal(canReportDefect('in_progress'), false);
  assert.equal(canReportDefect('reopened'), false);
});

test('requires a reason when exempting a defect', () => {
  assert.equal(validateReviewDecision('exempted'), 'An exemption reason is required');
  assert.equal(validateReviewDecision('exempted', 'Not reproducible in production'), undefined);
});

test('approved rework reopens only a completed task', () => {
  assert.equal(shouldReopenTask('approved', 'completed'), true);
  assert.equal(shouldReopenTask('approved', 'in_progress'), false);
  assert.equal(shouldReopenTask('exempted', 'completed'), false);
});
