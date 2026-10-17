import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { Defect } from '../models/Defect.js';
import { Task } from '../models/Task.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { HttpError } from '../middleware/errors.js';
import { recordAudit } from '../services/audit.js';
import type { TimeEntryCategory } from '../types/domain.js';
import { timeEntryQuerySchema } from '../validation/schemas.js';
import { canReviewTimeEntry, validateTimeEntryEligibility } from '../services/timeEntryRules.js';
import { User } from '../models/User.js';

export const listTimeEntries: RequestHandler = async (req, res) => {
  const parsed = timeEntryQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, 'Time entry filters are invalid', parsed.error.flatten());
  const query = parsed.data;
  const filter: Record<string, unknown> = {};
  if (req.user?.role === 'employee') {
    filter.employeeId = req.user.id;
  } else if (query.employeeId) {
    filter.employeeId = query.employeeId;
  }
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
  const employeeIds = [...new Set(entries.map((entry) => entry.employeeId.toString()))];
  const employees = await User.find({ _id: { $in: employeeIds } }).select('_id name').lean();
  const employeeNames = new Map(employees.map((employee) => [employee._id.toString(), employee.name]));
  res.json({
    data: entries.map((entry) => ({
      ...entry,
      employeeName: employeeNames.get(entry.employeeId.toString()) ?? 'Former employee',
    })),
  });
};

export const createTimeEntry: RequestHandler = async (req, res) => {
  const task = await Task.findById(req.body.taskId);
  if (!task) throw new HttpError(404, 'Task not found');
  if (task.assigneeId.toString() !== req.user!.id) {
    throw new HttpError(403, 'Time entries can only be logged against your assigned tasks');
  }
  if (req.body.employeeId && req.body.employeeId !== req.user!.id) {
    throw new HttpError(403, 'Time entries must belong to the authenticated employee');
  }

  const category = req.body.category as TimeEntryCategory;
  if (category === 'corrective_work') {
    if (!req.body.defectId) throw new HttpError(400, 'Corrective work must reference a defect');
    const defect = await Defect.findById(req.body.defectId);
    if (!defect) throw new HttpError(404, 'Defect not found');
    if (defect.taskId.toString() !== task._id.toString()) throw new HttpError(400, 'Defect does not belong to the referenced task');
    const eligibilityError = validateTimeEntryEligibility(category, true, defect.status, task.status);
    if (eligibilityError) throw new HttpError(400, eligibilityError);
  } else {
    const eligibilityError = validateTimeEntryEligibility(category, Boolean(req.body.defectId));
    if (eligibilityError) throw new HttpError(400, eligibilityError);
  }

  const employee = await User.findById(req.user!.id).select('hourlyRate baseSalary payrollCurrency').lean();
  if (!employee) throw new HttpError(404, 'Time-entry employee account not found');
  const entry = await TimeEntry.create({
    ...req.body,
    employeeId: req.user!.id,
    source: 'manual',
    compensationHourlyRate: employee.hourlyRate ?? 1000,
    compensationBaseSalary: employee.baseSalary ?? 50000,
    compensationCurrency: employee.payrollCurrency ?? 'INR',
  });
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
  if (req.user?.role === 'employee' && entry.employeeId.toString() !== req.user.id) {
    throw new HttpError(403, 'You can only view your own time entries');
  }
  res.json({ data: entry });
};

export const reviewTimeEntry: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Time entry id is required');
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const entry = await TimeEntry.findById(req.params.id).session(session);
    if (!entry) throw new HttpError(404, 'Time entry not found');
    const reviewError = canReviewTimeEntry(entry.approvalStatus, entry.employeeId.toString(), req.user!.id);
    if (reviewError) throw new HttpError(reviewError.startsWith('Employees') ? 403 : 400, reviewError);
    const defect = entry.category === 'corrective_work' && entry.defectId
      ? await Defect.findById(entry.defectId).session(session)
      : null;
    if (entry.category === 'corrective_work' && (
      !defect
      || !['approved', 'resolved'].includes(defect.status)
      || defect.taskId.toString() !== entry.taskId.toString()
    )) {
      throw new HttpError(400, 'Corrective entry is no longer eligible for approval');
    }

    const before = { approvalStatus: entry.approvalStatus };
    entry.approvalStatus = req.body.approvalStatus;
    entry.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
    entry.reviewedAt = new Date();
    entry.reviewReason = req.body.reviewReason;
    await entry.save({ session });
    await recordAudit({
      actorId: entry.reviewedBy,
      entityType: 'TimeEntry',
      entityId: entry._id,
      action: `time_entry_${entry.approvalStatus}`,
      before,
      after: { approvalStatus: entry.approvalStatus, reviewedAt: entry.reviewedAt },
      reason: entry.reviewReason,
    }, session);
    await session.commitTransaction();
    res.json({ data: entry });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};
