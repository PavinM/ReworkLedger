import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { Defect } from '../models/Defect.js';
import { Task } from '../models/Task.js';
import { HttpError } from '../middleware/errors.js';
import { canReportDefect, shouldReopenTask } from '../services/defectRules.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { PayrollAdjustment } from '../models/PayrollAdjustment.js';
import { calculateProposedAdjustment } from '../services/payrollCalculation.js';
import { recordAudit } from '../services/audit.js';

export const listDefects: RequestHandler = async (req, res) => {
  const filter: Record<string, unknown> = typeof req.query.projectId === 'string' ? { projectId: req.query.projectId } : {};
  if (req.user?.role === 'employee') {
    const assignedTasks = await Task.find({ assigneeId: req.user.id }).select('_id').lean();
    filter.taskId = { $in: assignedTasks.map((task) => task._id) };
  }
  const defects = await Defect.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ data: defects });
};

export const createDefect: RequestHandler = async (req, res) => {
  const task = await Task.findById(req.body.taskId);
  if (!task) throw new HttpError(404, 'Task not found');
  if (!canReportDefect(task.status)) {
    throw new HttpError(400, 'Defects can only be reported against completed or accepted projects');
  }
  const defect = await Defect.create({ ...req.body, projectId: task.projectId, reportedBy: req.user!.id });
  res.status(201).json({ data: defect });
};

export const getDefect: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Defect id is required');
  const defect = await Defect.findById(req.params.id).lean();
  if (!defect) throw new HttpError(404, 'Defect not found');
  if (req.user?.role === 'employee') {
    const assigned = await Task.exists({ _id: defect.taskId, assigneeId: req.user.id });
    if (!assigned) throw new HttpError(403, 'You can only view defects assigned to your projects');
  }
  res.json({ data: defect });
};

export const reviewDefect: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Defect id is required');
  const defect = await Defect.findById(req.params.id);
  if (!defect) throw new HttpError(404, 'Defect not found');
  if (defect.status !== 'reported' && defect.status !== 'under_review') {
    throw new HttpError(400, `Defect cannot be reviewed from ${defect.status} status`);
  }

  defect.status = req.body.status;
  defect.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
  defect.reviewReason = req.body.reviewReason;
  await defect.save();

  if (defect.status === 'approved') {
    const task = await Task.findById(defect.taskId);
    if (!task) throw new HttpError(404, 'Original task not found');
    if (shouldReopenTask(defect.status, task.status)) {
      task.status = 'reopened';
      await task.save();
    }
  }

  res.json({ data: defect });
};

export const submitDefectResolution: RequestHandler = async (req, res) => {
  const defect = await Defect.findById(req.params.id);
  if (!defect) throw new HttpError(404, 'Defect not found');
  const task = await Task.findById(defect.taskId).select('assigneeId');
  if (!task || task.assigneeId.toString() !== req.user!.id) throw new HttpError(403, 'Only the assigned employee can submit this fix');
  if (!['reported', 'approved'].includes(defect.status)) throw new HttpError(400, 'This defect is not awaiting an employee fix');
  defect.resolutionDescription = req.body.resolutionDescription;
  defect.resolutionEvidence = req.body.resolutionEvidence;
  defect.resolutionHours = req.body.resolutionHours;
  defect.resolutionSubmittedAt = new Date();
  defect.resolutionSubmittedBy = new mongoose.Types.ObjectId(req.user!.id);
  defect.status = 'under_review';
  await defect.save();
  res.json({ data: defect });
};

export const acceptDefectResolution: RequestHandler = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
  const defect = await Defect.findById(req.params.id).session(session);
  if (!defect) throw new HttpError(404, 'Defect not found');
  if (defect.status !== 'under_review' || !defect.resolutionDescription || !defect.resolutionEvidence || !defect.resolutionHours) throw new HttpError(400, 'Employee resolution, evidence, and time spent must be submitted before acceptance');
  const task = await Task.findById(defect.taskId).session(session);
  if (!task) throw new HttpError(404, 'Project delivery not found');
  const existingAdjustment = await PayrollAdjustment.findOne({
    employeeId: task.assigneeId,
    'calculationBreakdown.defectId': defect._id,
  }).session(session);
  if (existingAdjustment) throw new HttpError(409, 'A salary adjustment already exists for this defect');
  const reviewedAt = new Date();
  const timeEntry = await TimeEntry.create([{
    taskId: defect.taskId,
    defectId: defect._id,
    employeeId: task.assigneeId,
    date: reviewedAt,
    hours: defect.resolutionHours,
    description: defect.resolutionDescription,
    category: 'corrective_work',
    approvalStatus: 'approved',
    reviewedBy: req.user!.id,
    reviewedAt,
    reviewReason: req.body.reviewReason || 'Corrective time verified with accepted defect fix',
  }], { session }).then(([created]) => created);
  const hourlyRate = 1000;
  const amount = Math.round(defect.resolutionHours * hourlyRate * 100) / 100;
  const signedAmount = defect.cause === 'code_defect' ? -amount : amount;
  const baseSalary = 50000;
  const periodStart = new Date(reviewedAt.getFullYear(), reviewedAt.getMonth() + 1, 1);
  const periodEnd = new Date(reviewedAt.getFullYear(), reviewedAt.getMonth() + 2, 0);
  const previousAdjustments = await PayrollAdjustment.find({
    employeeId: task.assigneeId,
    periodStart,
    status: 'approved',
  }).session(session).select('adjustmentType proposedAmount').lean();
  const cumulative = previousAdjustments.reduce((total, adjustment) => total + (adjustment.adjustmentType === 'credit' ? adjustment.proposedAmount : adjustment.adjustmentType === 'debit' ? -adjustment.proposedAmount : 0), 0) + signedAmount;
  const nextMonthSalary = Math.max(0, Math.round((baseSalary + cumulative + Number.EPSILON) * 100) / 100);
  const adjustment = await PayrollAdjustment.create([{
    employeeId: task.assigneeId,
    periodStart,
    periodEnd,
    currency: 'INR',
    approvedTimeEntryIds: [timeEntry._id],
    configuredHourlyRate: hourlyRate,
    ...calculateProposedAdjustment([{
      id: timeEntry._id,
      taskId: defect.taskId,
      defectId: defect._id,
      date: reviewedAt,
      hours: defect.resolutionHours,
    }], hourlyRate),
    proposedAmount: Math.abs(signedAmount),
    baseSalary,
    nextMonthSalary,
    adjustmentType: signedAmount > 0 ? 'credit' : 'debit',
    status: 'approved',
    reviewedBy: req.user!.id,
    reviewedAt,
    reviewReason: req.body.reviewReason || `Automatic ${signedAmount < 0 ? 'human-error salary deduction' : 'natural/technical rework credit'} for ${defect.resolutionHours} approved hours`,
  }], { session }).then(([created]) => created);
  timeEntry.payrollAdjustmentId = adjustment._id;
  await timeEntry.save({ session });
  defect.status = 'resolved';
  defect.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
  defect.reviewReason = req.body.reviewReason;
  await defect.save({ session });
  await recordAudit({
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    entityType: 'PayrollAdjustment',
    entityId: adjustment._id,
    action: `automatic_salary_${adjustment.adjustmentType}`,
    after: { employeeId: task.assigneeId, defectId: defect._id, hours: defect.resolutionHours, amount: adjustment.proposedAmount, nextMonthSalary },
    reason: adjustment.reviewReason,
  }, session);
  await session.commitTransaction();
  res.json({ data: defect });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const backfillResolvedDefectHours: RequestHandler = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const defect = await Defect.findById(req.params.id).session(session);
    if (!defect) throw new HttpError(404, 'Defect not found');
    if (defect.status !== 'resolved') throw new HttpError(400, 'Only resolved defects can have past resolution hours recorded');
    if (defect.resolutionHours) throw new HttpError(409, 'Resolution hours are already recorded');
    const task = await Task.findById(defect.taskId).session(session);
    if (!task) throw new HttpError(404, 'Project delivery not found');
    const existingAdjustment = await PayrollAdjustment.findOne({
      employeeId: task.assigneeId,
      'calculationBreakdown.defectId': defect._id,
    }).session(session);
    if (existingAdjustment) throw new HttpError(409, 'A salary adjustment already exists for this defect');
    const reviewedAt = new Date();
    const hours = req.body.hours as number;
    const timeEntry = await TimeEntry.create([{
      taskId: defect.taskId,
      defectId: defect._id,
      employeeId: task.assigneeId,
      date: reviewedAt,
      hours,
      description: defect.resolutionDescription || 'Verified corrective work for previously resolved defect',
      category: 'corrective_work',
      approvalStatus: 'approved',
      reviewedBy: new mongoose.Types.ObjectId(req.user!.id),
      reviewedAt,
      reviewReason: req.body.reviewReason,
    }], { session }).then(([created]) => created);
    const hourlyRate = 1000;
    const amount = Math.round(hours * hourlyRate * 100) / 100;
    const signedAmount = defect.cause === 'code_defect' ? -amount : amount;
    const baseSalary = 50000;
    const periodStart = new Date(reviewedAt.getFullYear(), reviewedAt.getMonth() + 1, 1);
    const periodEnd = new Date(reviewedAt.getFullYear(), reviewedAt.getMonth() + 2, 0);
    const previousAdjustments = await PayrollAdjustment.find({ employeeId: task.assigneeId, periodStart, status: 'approved' }).session(session).select('adjustmentType proposedAmount').lean();
    const cumulative = previousAdjustments.reduce((total, adjustment) => total + (adjustment.adjustmentType === 'credit' ? adjustment.proposedAmount : adjustment.adjustmentType === 'debit' ? -adjustment.proposedAmount : 0), 0) + signedAmount;
    const nextMonthSalary = Math.max(0, Math.round((baseSalary + cumulative + Number.EPSILON) * 100) / 100);
    const adjustment = await PayrollAdjustment.create([{
      employeeId: task.assigneeId,
      periodStart,
      periodEnd,
      currency: 'INR',
      approvedTimeEntryIds: [timeEntry._id],
      configuredHourlyRate: hourlyRate,
      ...calculateProposedAdjustment([{ id: timeEntry._id, taskId: defect.taskId, defectId: defect._id, date: reviewedAt, hours }], hourlyRate),
      proposedAmount: amount,
      baseSalary,
      nextMonthSalary,
      adjustmentType: signedAmount > 0 ? 'credit' : 'debit',
      status: 'approved',
      reviewedBy: new mongoose.Types.ObjectId(req.user!.id),
      reviewedAt,
      reviewReason: req.body.reviewReason,
    }], { session }).then(([created]) => created);
    timeEntry.payrollAdjustmentId = adjustment._id;
    await timeEntry.save({ session });
    defect.resolutionHours = hours;
    await defect.save({ session });
    await recordAudit({
      actorId: new mongoose.Types.ObjectId(req.user!.id),
      entityType: 'PayrollAdjustment',
      entityId: adjustment._id,
      action: `automatic_salary_${adjustment.adjustmentType}`,
      after: { employeeId: task.assigneeId, defectId: defect._id, hours, amount, nextMonthSalary },
      reason: req.body.reviewReason,
    }, session);
    await session.commitTransaction();
    res.status(201).json({ data: { defect, adjustment } });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};
