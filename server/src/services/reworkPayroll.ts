import type { Types } from 'mongoose';
import type { DefectCause } from '../types/domain.js';
import { roundMoney } from './payrollCalculation.js';

export interface ReworkPayrollInput {
  id: Types.ObjectId;
  taskId: Types.ObjectId;
  defectId: Types.ObjectId;
  date: Date;
  hours: number;
  cause: DefectCause;
  hourlyRate: number;
}

export function calculateReworkPayroll(inputs: ReworkPayrollInput[]) {
  const seen = new Set<string>();
  const calculationBreakdown = inputs.map((input) => {
    const id = input.id.toString();
    if (seen.has(id)) throw new Error('A time entry cannot be included more than once');
    seen.add(id);
    if (!Number.isFinite(input.hourlyRate) || input.hourlyRate < 0) {
      throw new Error('Hourly rate must be a non-negative finite number');
    }
    const amount = roundMoney(input.hours * input.hourlyRate);
    return {
      timeEntryId: input.id,
      taskId: input.taskId,
      defectId: input.defectId,
      date: input.date,
      hours: input.hours,
      hourlyRate: input.hourlyRate,
      amount,
      cause: input.cause,
    };
  });
  const signedAmount = roundMoney(calculationBreakdown.reduce((total, line) => (
    total + (line.cause === 'code_defect' ? -line.amount : line.amount)
  ), 0));
  return {
    eligibleCorrectiveHours: roundMoney(calculationBreakdown.reduce((total, line) => total + line.hours, 0)),
    proposedAmount: Math.abs(signedAmount),
    adjustmentType: signedAmount > 0 ? 'credit' as const : signedAmount < 0 ? 'debit' as const : 'none' as const,
    calculationBreakdown,
  };
}
