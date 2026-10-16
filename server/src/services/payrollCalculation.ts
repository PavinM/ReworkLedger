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
