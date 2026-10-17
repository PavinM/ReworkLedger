import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDefectSalaryAdjustment, calculateNextMonthSalary, calculateProposedAdjustment, roundMoney } from '../src/services/payrollCalculation.js';
import { calculateReworkPayroll } from '../src/services/reworkPayroll.js';
import { canReviewTimeEntry, validateTimeEntryEligibility } from '../src/services/timeEntryRules.js';
import { calculatePayrollSchema, createDefectSchema, createTimeEntrySchema, payrollDisputeSchema, reviewPayrollDisputeSchema, reviewPayrollSchema } from '../src/validation/schemas.js';

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

test('calculates rework payroll consistently using frozen per-entry rates and defect causes', () => {
  const proposal = calculateReworkPayroll([
    { id: objectId(ids.first), taskId: objectId(ids.second), defectId: objectId(ids.first), date: new Date('2026-05-01'), hours: 2, cause: 'code_defect', hourlyRate: 50 },
    { id: objectId(ids.second), taskId: objectId(ids.second), defectId: objectId(ids.second), date: new Date('2026-05-02'), hours: 1, cause: 'requirement_change', hourlyRate: 75 },
  ]);

  assert.equal(proposal.eligibleCorrectiveHours, 3);
  assert.equal(proposal.calculationBreakdown[0].amount, 100);
  assert.equal(proposal.calculationBreakdown[1].amount, 75);
  assert.equal(proposal.proposedAmount, 25);
  assert.equal(proposal.adjustmentType, 'debit');
});

test('rejects duplicate time entries in a rework payroll proposal', () => {
  const input = { id: objectId(ids.first), taskId: objectId(ids.second), defectId: objectId(ids.first), date: new Date(), hours: 1, cause: 'code_defect' as const, hourlyRate: 10 };
  assert.throws(() => calculateReworkPayroll([input, input]), /cannot be included more than once/);
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
  assert.equal(validateTimeEntryEligibility('corrective_work', true, 'approved', 'completed'), 'Corrective work can only be logged while the task is reopened or under fix');
  assert.equal(validateTimeEntryEligibility('corrective_work', true, 'approved', 'reopened'), undefined);
  assert.equal(validateTimeEntryEligibility('corrective_work', true, 'approved', 'under_fix'), undefined);
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

test('requires a reason for every payroll decision', () => {
  const review = { status: 'approved', reviewedBy: ids.first };
  assert.equal(reviewPayrollSchema.safeParse({ ...review, reviewReason: 'Verified against the approved corrective work.' }).success, true);
  assert.equal(reviewPayrollSchema.safeParse(review).success, false);
  assert.equal(reviewPayrollSchema.safeParse({ ...review, reviewReason: ' ' }).success, false);
});

test('requires a reason and manager resolution for payroll disputes', () => {
  assert.equal(payrollDisputeSchema.safeParse({ reason: ' ' }).success, false);
  assert.equal(payrollDisputeSchema.safeParse({ reason: 'Hours include work outside this defect' }).success, true);
  assert.equal(reviewPayrollDisputeSchema.safeParse({ decision: 'accepted', resolution: '' }).success, false);
  assert.equal(reviewPayrollDisputeSchema.safeParse({ decision: 'denied', resolution: 'The approved hours match the submitted log' }).success, true);
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
