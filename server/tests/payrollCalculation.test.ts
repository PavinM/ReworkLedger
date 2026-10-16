import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDefectSalaryAdjustment, calculateNextMonthSalary, calculateProposedAdjustment, roundMoney } from '../src/services/payrollCalculation.js';
import { canReviewTimeEntry, validateTimeEntryEligibility } from '../src/services/timeEntryRules.js';
import { calculatePayrollSchema, createDefectSchema, createTimeEntrySchema } from '../src/validation/schemas.js';

const ids = {
  first: '507f1f77bcf86cd799439011',
  second: '507f1f77bcf86cd799439012',
};

function objectId(value: string) {
  return { toString: () => value } as never;
}

test('calculates a proposed adjustment from approved corrective hours', () => {
  const result = calculateProposedAdjustment([
    { id: objectId(ids.first), taskId: objectId(ids.second), defectId: objectId(ids.first), date: new Date('2026-05-01'), hours: 2.5 },
    { id: objectId(ids.second), taskId: objectId(ids.second), defectId: objectId(ids.first), date: new Date('2026-05-02'), hours: 1.25 },
  ], 40);

  assert.equal(result.eligibleCorrectiveHours, 3.75);
  assert.equal(result.proposedAmount, 150);
  assert.equal(result.calculationBreakdown[0].amount, 100);
});

test('rounds money consistently and rejects duplicate time entries', () => {
  assert.equal(roundMoney(10.005), 10.01);
  assert.throws(() => calculateProposedAdjustment([
    { id: objectId(ids.first), taskId: objectId(ids.second), defectId: objectId(ids.first), date: new Date(), hours: 1 },
    { id: objectId(ids.first), taskId: objectId(ids.second), defectId: objectId(ids.first), date: new Date(), hours: 1 },
  ], 10), /more than once/);
});

test('requires an approved defect for corrective time', () => {
  assert.equal(validateTimeEntryEligibility('corrective_work', false), 'Corrective work must reference a defect');
  assert.equal(validateTimeEntryEligibility('corrective_work', true, 'exempted'), 'Defect is not eligible for corrective work');
  assert.equal(validateTimeEntryEligibility('corrective_work', true, 'approved'), undefined);
});

test('prevents self-review and review after a terminal decision', () => {
  assert.equal(canReviewTimeEntry('pending', 'employee', 'employee'), 'Employees cannot review their own time entries');
  assert.equal(canReviewTimeEntry('approved', 'employee', 'manager'), 'Only pending time entries can be reviewed');
  assert.equal(canReviewTimeEntry('pending', 'employee', 'manager'), undefined);
});

test('rejects invalid hours and invalid payroll periods', () => {
  const validId = ids.first;
  assert.equal(createTimeEntrySchema.safeParse({
    taskId: validId,
    employeeId: validId,
    date: '2026-05-01',
    hours: 0,
    category: 'corrective_work',
  }).success, false);
  assert.equal(calculatePayrollSchema.safeParse({
    employeeId: validId,
    periodStart: '2026-05-10',
    periodEnd: '2026-05-01',
    currency: 'USD',
    configuredHourlyRate: 40,
  }).success, false);
});

test('calculation engine only processes the entries it receives', () => {
  const approvedEntry = { id: objectId(ids.first), taskId: objectId(ids.second), defectId: objectId(ids.first), date: new Date(), hours: 2 };
  const result = calculateProposedAdjustment([approvedEntry], 25);
  assert.deepEqual(result.calculationBreakdown.map((line) => line.timeEntryId.toString()), [ids.first]);
  assert.equal(result.proposedAmount, 50);
});

test('does not propose overrun deductions below or at the AI estimate', () => {
  assert.deepEqual(calculateDefectSalaryAdjustment(1.5, 2, 1000), {
    overrunHours: 0,
    overrunPenalty: 0,
    requiresApproval: false,
  });
  assert.deepEqual(calculateDefectSalaryAdjustment(2, 2, 1000), {
    overrunHours: 0,
    overrunPenalty: 0,
    requiresApproval: false,
  });
});

test('calculates a pending deduction of 1000 INR per excess hour', () => {
  assert.deepEqual(calculateDefectSalaryAdjustment(3.5, 2, 1000), {
    overrunHours: 1.5,
    overrunPenalty: 1500,
    requiresApproval: true,
  });
});

test('applies a pending overrun deduction only after it is approved', () => {
  const existing = [{ adjustmentType: 'credit' as const, proposedAmount: 2000 }];
  const penalty = { adjustmentType: 'debit' as const, proposedAmount: 1500 };
  assert.equal(calculateNextMonthSalary(50000, existing), 52000);
  assert.equal(calculateNextMonthSalary(50000, [...existing, penalty]), 50500);
});

test('validates the optional Ollama estimate on defect assignments', () => {
  const assignment = {
    taskId: ids.first,
    module: 'Payments',
    title: 'Incorrect total',
    description: 'Totals are inconsistent.',
    debugInstructions: 'Trace the calculation.',
    severity: 'medium',
    cause: 'code_defect',
    reportedBy: ids.second,
  };
  assert.equal(createDefectSchema.safeParse({ ...assignment, estimatedResolutionHours: 2, estimateModel: 'qwen2.5-coder:3b' }).success, true);
  assert.equal(createDefectSchema.safeParse({ ...assignment, estimatedResolutionHours: 25 }).success, false);
});
