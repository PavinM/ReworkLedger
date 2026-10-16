import type { Types } from 'mongoose';

export interface PayrollInput {
  id: Types.ObjectId;
  taskId: Types.ObjectId;
  defectId: Types.ObjectId;
  date: Date;
  hours: number;
}

export interface PayrollLine {
  timeEntryId: Types.ObjectId;
  taskId: Types.ObjectId;
  defectId: Types.ObjectId;
  date: Date;
  hours: number;
  hourlyRate: number;
  amount: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDefectSalaryAdjustment(
  hours: number,
  expectedHours: number | undefined,
  hourlyRate: number,
) {
  const overrunHours = expectedHours === undefined ? 0 : Math.max(0, hours - expectedHours);
  const overrunPenalty = roundMoney(overrunHours * hourlyRate);

  return {
    overrunHours: roundMoney(overrunHours),
    overrunPenalty,
    requiresApproval: overrunPenalty > 0,
  };
}

export function calculateNextMonthSalary(
  baseSalary: number,
  adjustments: Array<{ adjustmentType: 'credit' | 'debit' | 'none'; proposedAmount: number }>,
): number {
  const signedAdjustments = adjustments.reduce((total, adjustment) => (
    total + (adjustment.adjustmentType === 'credit' ? adjustment.proposedAmount : adjustment.adjustmentType === 'debit' ? -adjustment.proposedAmount : 0)
  ), 0);
  return Math.max(0, roundMoney(baseSalary + signedAdjustments));
}

export function calculateProposedAdjustment(entries: PayrollInput[], hourlyRate: number): {
  eligibleCorrectiveHours: number;
  proposedAmount: number;
  calculationBreakdown: PayrollLine[];
} {
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) throw new Error('Hourly rate must be a non-negative finite number');
  const ids = new Set<string>();
  const calculationBreakdown = entries.map((entry) => {
    if (ids.has(entry.id.toString())) throw new Error('A time entry cannot be included more than once');
    ids.add(entry.id.toString());
    const amount = roundMoney(entry.hours * hourlyRate);
    return { timeEntryId: entry.id, taskId: entry.taskId, defectId: entry.defectId, date: entry.date, hours: entry.hours, hourlyRate, amount };
  });
  const eligibleCorrectiveHours = roundMoney(calculationBreakdown.reduce((sum, line) => sum + line.hours, 0));
  const proposedAmount = roundMoney(calculationBreakdown.reduce((sum, line) => sum + line.amount, 0));
  return { eligibleCorrectiveHours, proposedAmount, calculationBreakdown };
}
