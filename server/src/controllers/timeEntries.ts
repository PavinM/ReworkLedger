import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { Defect } from '../models/Defect.js';
import { Task } from '../models/Task.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { PayrollAdjustment } from '../models/PayrollAdjustment.js';
import { HttpError } from '../middleware/errors.js';
import { recordAudit } from '../services/audit.js';
import type { TimeEntryCategory } from '../types/domain.js';
import { timeEntryQuerySchema } from '../validation/schemas.js';
import { canReviewTimeEntry, validateTimeEntryEligibility } from '../services/timeEntryRules.js';
import { calculateProposedAdjustment } from '../services/payrollCalculation.js';

export const listTimeEntries: RequestHandler = async (req, res) => {
  const parsed = timeEntryQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, 'Time entry filters are invalid', parsed.error.flatten());
  const query = parsed.data;
  const filter: Record<string, unknown> = {};
  if (req.user?.role === 'employee') filter.employeeId = req.user.id;
  if (query.employeeId) filter.employeeId = query.employeeId;
  if (query.taskId) filter.taskId = query.taskId;
  if (query.defectId) filter.defectId = query.defectId;
  if (query.approvalStatus) filter.approvalStatus = query.approvalStatus;
  if (query.startDate || query.endDate) {
    filter.date = {
      ...(query.startDate ? { $gte: query.startDate } : {}),
      ...(query.endDate ? { $lte: query.endDate } : {}),
    };
  }
  const entries = await TimeEntry.find(filter).sort({ date: -1, createdAt: -1 }).lean();
  res.json({ data: entries });
};

export const createTimeEntry: RequestHandler = async (req, res) => {
  const task = await Task.findById(req.body.taskId);
  if (!task) throw new HttpError(404, 'Task not found');

  const category = req.body.category as TimeEntryCategory;
  if (category === 'corrective_work') {
    if (!req.body.defectId) throw new HttpError(400, 'Corrective work must reference a defect');
    const defect = await Defect.findById(req.body.defectId);
    if (!defect) throw new HttpError(404, 'Defect not found');
    if (defect.taskId.toString() !== task._id.toString()) throw new HttpError(400, 'Defect does not belong to the referenced task');
    const eligibilityError = validateTimeEntryEligibility(category, true, defect.status);
    if (eligibilityError) throw new HttpError(400, eligibilityError);
  } else {
    const eligibilityError = validateTimeEntryEligibility(category, Boolean(req.body.defectId));
    if (eligibilityError) throw new HttpError(400, eligibilityError);
  }

  const entry = await TimeEntry.create({ ...req.body, employeeId: req.user!.id });
  await recordAudit({
    entityType: 'TimeEntry',
    entityId: entry._id,
    action: 'time_entry_created',
    after: { taskId: entry.taskId, defectId: entry.defectId, category: entry.category, hours: entry.hours },
  });
  res.status(201).json({ data: entry });
};

export const getTimeEntry: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Time entry id is required');
  const entry = await TimeEntry.findById(req.params.id).lean();
  if (!entry) throw new HttpError(404, 'Time entry not found');
  res.json({ data: entry });
};

export const reviewTimeEntry: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Time entry id is required');
  const entry = await TimeEntry.findById(req.params.id);
  if (!entry) throw new HttpError(404, 'Time entry not found');
  const reviewError = canReviewTimeEntry(entry.approvalStatus, entry.employeeId.toString(), req.user!.id);
  if (reviewError) throw new HttpError(reviewError.startsWith('Employees') ? 403 : 400, reviewError);
  if (entry.category === 'corrective_work') {
    const defect = entry.defectId ? await Defect.findById(entry.defectId) : null;
    if (!defect || defect.status !== 'approved') throw new HttpError(400, 'Corrective entry is no longer eligible for approval');
  }

  const before = { approvalStatus: entry.approvalStatus };
  entry.approvalStatus = req.body.approvalStatus;
  entry.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
  entry.reviewedAt = new Date();
  entry.reviewReason = req.body.reviewReason;
  await entry.save();
  if (entry.approvalStatus === 'approved' && entry.category === 'corrective_work' && entry.defectId && !entry.payrollAdjustmentId) {
    const defect = await Defect.findById(entry.defectId).select('cause').lean();
    if (!defect) throw new HttpError(404, 'Defect not found');
    const hourlyRate = 1000;
    const amount = Math.round(entry.hours * hourlyRate * 100) / 100;
    const isHumanError = defect.cause === 'code_defect';
    const signedAmount = isHumanError ? -amount : amount;
    const baseSalary = 50000;
    const adjustment = await PayrollAdjustment.create({
      employeeId: entry.employeeId,
      periodStart: new Date(new Date(entry.date).getFullYear(), new Date(entry.date).getMonth() + 1, 1),
      periodEnd: new Date(new Date(entry.date).getFullYear(), new Date(entry.date).getMonth() + 2, 0),
      currency: 'INR',
      approvedTimeEntryIds: [entry._id],
      ...calculateProposedAdjustment([{ id: entry._id, taskId: entry.taskId, defectId: entry.defectId, date: entry.date, hours: entry.hours }], hourlyRate),
      proposedAmount: Math.abs(signedAmount),
      baseSalary,
      nextMonthSalary: Math.max(0, baseSalary + signedAmount),
      adjustmentType: signedAmount > 0 ? 'credit' : 'debit',
      status: 'approved',
      reviewedBy: entry.reviewedBy,
      reviewedAt: entry.reviewedAt,
      reviewReason: `Automatic ${isHumanError ? 'human-error deduction' : 'natural/technical rework credit'} based on approved corrective time`,
    });
    entry.payrollAdjustmentId = adjustment._id;
    await entry.save();
  }
  await recordAudit({
    actorId: entry.reviewedBy,
    entityType: 'TimeEntry',
    entityId: entry._id,
    action: `time_entry_${entry.approvalStatus}`,
    before,
    after: { approvalStatus: entry.approvalStatus, reviewedAt: entry.reviewedAt },
    reason: entry.reviewReason,
  });
  res.json({ data: entry });
};
