import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
import { Defect } from '../models/Defect.js';
import { PayrollAdjustment } from '../models/PayrollAdjustment.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/errors.js';
import { recordAudit } from '../services/audit.js';
import { calculateNextMonthSalary, calculateProposedAdjustment } from '../services/payrollCalculation.js';

export const calculatePayroll: RequestHandler = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { employeeId, periodStart, periodEnd, currency, configuredHourlyRate, baseSalary } = req.body;
    const entries = await TimeEntry.find({
      employeeId,
      date: { $gte: periodStart, $lte: periodEnd },
      category: 'corrective_work',
      approvalStatus: 'approved',
      $or: [{ payrollAdjustmentId: { $exists: false } }, { payrollAdjustmentId: null }],
    }).session(session);

    const eligibleDefectIds = [...new Set(entries.flatMap((entry) => entry.defectId ? [entry.defectId.toString()] : []))];
    const approvedDefects = await Defect.find({ _id: { $in: eligibleDefectIds }, status: 'approved' }).session(session).select('_id');
    const approvedDefectSet = new Set(approvedDefects.map((defect) => defect._id.toString()));
    const eligibleEntries = entries.filter((entry) => entry.defectId && approvedDefectSet.has(entry.defectId.toString()));
    if (!eligibleEntries.length) throw new HttpError(400, 'No eligible approved corrective time entries found for this period');

    const calculation = calculateProposedAdjustment(
      eligibleEntries.map((entry) => ({
        id: entry._id,
        taskId: entry.taskId,
        defectId: entry.defectId!,
        date: entry.date,
        hours: entry.hours,
      })),
      configuredHourlyRate,
    );
    const defectRecords = await Defect.find({ _id: { $in: eligibleEntries.map((entry) => entry.defectId) } }).select('_id cause').session(session).lean();
    const causeByDefect = new Map(defectRecords.map((defect) => [defect._id.toString(), defect.cause]));
    const naturalAmount = eligibleEntries.reduce((sum, entry) => {
      return sum + (causeByDefect.get(entry.defectId!.toString()) !== 'code_defect' ? entry.hours * configuredHourlyRate : 0);
    }, 0);
    const humanAmount = eligibleEntries.reduce((sum, entry) => {
      return sum + (causeByDefect.get(entry.defectId!.toString()) === 'code_defect' ? entry.hours * configuredHourlyRate : 0);
    }, 0);
    const signedAmount = Math.round((naturalAmount - humanAmount + Number.EPSILON) * 100) / 100;
    const adjustmentType = signedAmount > 0 ? 'credit' : signedAmount < 0 ? 'debit' : 'none';
    const nextMonthSalary = Math.max(0, Math.round((baseSalary + signedAmount + Number.EPSILON) * 100) / 100);
    const adjustment = await PayrollAdjustment.create([{
      employeeId,
      periodStart,
      periodEnd,
      currency,
      approvedTimeEntryIds: eligibleEntries.map((entry) => entry._id),
      ...calculation,
      proposedAmount: Math.abs(signedAmount),
      baseSalary,
      nextMonthSalary,
      adjustmentType,
      status: 'pending_review',
    }], { session }).then(([created]) => created);

    const reservation = await TimeEntry.updateMany(
      {
        _id: { $in: eligibleEntries.map((entry) => entry._id) },
        approvalStatus: 'approved',
        $or: [{ payrollAdjustmentId: { $exists: false } }, { payrollAdjustmentId: null }],
      },
      { $set: { payrollAdjustmentId: adjustment._id } },
      { session },
    );
    if (reservation.modifiedCount !== eligibleEntries.length) {
      throw new HttpError(409, 'One or more time entries were already included in another payroll adjustment');
    }

    await recordAudit({
      entityType: 'PayrollAdjustment',
      entityId: adjustment._id,
      action: 'payroll_calculation_created',
      after: { status: adjustment.status, proposedAmount: adjustment.proposedAmount, approvedTimeEntryIds: adjustment.approvedTimeEntryIds },
    }, session);
    await session.commitTransaction();
    res.status(201).json({ data: adjustment });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const listPayroll: RequestHandler = async (req, res) => {
  const filter = req.user?.role === 'employee' ? { employeeId: req.user.id } : {};
  const adjustments = await PayrollAdjustment.find(filter).sort({ createdAt: -1 }).lean();
  const employeeIds = [...new Set(adjustments.map((adjustment) => adjustment.employeeId.toString()))];
  const employees = await User.find({ _id: { $in: employeeIds } }).select('_id name').lean();
  const employeeNames = new Map(employees.map((employee) => [employee._id.toString(), employee.name]));
  res.json({
    data: adjustments.map((adjustment) => ({
      ...adjustment,
      employeeName: employeeNames.get(adjustment.employeeId.toString()) ?? 'Employee',
    })),
  });
};

export const getPayroll: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Payroll adjustment id is required');
  const adjustment = await PayrollAdjustment.findById(req.params.id).lean();
  if (!adjustment) throw new HttpError(404, 'Payroll adjustment not found');
  if (req.user?.role === 'employee' && adjustment.employeeId.toString() !== req.user.id) {
    throw new HttpError(403, 'You do not have access to this payroll adjustment');
  }
  res.json({ data: adjustment });
};

export const reviewPayroll: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Payroll adjustment id is required');
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const adjustment = await PayrollAdjustment.findById(req.params.id).session(session);
    if (!adjustment) throw new HttpError(404, 'Payroll adjustment not found');
    if (adjustment.status !== 'pending_review') throw new HttpError(400, `Payroll adjustment cannot be reviewed from ${adjustment.status} status`);
    if (adjustment.employeeId.toString() === req.user!.id) throw new HttpError(403, 'Employees cannot approve their own payroll adjustment');
    const before = { status: adjustment.status };
    adjustment.status = req.body.status;
    adjustment.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
    adjustment.reviewedAt = new Date();
    adjustment.reviewReason = req.body.reviewReason;
    const approvedAdjustments = await PayrollAdjustment.find({
      employeeId: adjustment.employeeId,
      periodStart: adjustment.periodStart,
      status: 'approved',
      _id: { $ne: adjustment._id },
    }).session(session).select('adjustmentType proposedAmount').lean();
    adjustment.nextMonthSalary = calculateNextMonthSalary(
      adjustment.baseSalary,
      adjustment.status === 'approved'
        ? [...approvedAdjustments, adjustment]
        : approvedAdjustments,
    );
    await adjustment.save({ session });
    await recordAudit({
      actorId: adjustment.reviewedBy,
      entityType: 'PayrollAdjustment',
      entityId: adjustment._id,
      action: `payroll_adjustment_${adjustment.status}`,
      before,
      after: { status: adjustment.status, reviewedAt: adjustment.reviewedAt, nextMonthSalary: adjustment.nextMonthSalary },
      reason: adjustment.reviewReason,
    }, session);
    await session.commitTransaction();
    res.json({ data: adjustment });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const voidPayroll: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Payroll adjustment id is required');
  const adjustment = await PayrollAdjustment.findById(req.params.id);
  if (!adjustment) throw new HttpError(404, 'Payroll adjustment not found');
  if (adjustment.status === 'voided') throw new HttpError(400, 'Payroll adjustment is already voided');
  if (adjustment.status === 'approved') throw new HttpError(400, 'Approved payroll adjustments cannot be voided');
  const before = { status: adjustment.status };
  adjustment.status = 'voided';
  adjustment.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
  adjustment.reviewedAt = new Date();
  adjustment.reviewReason = req.body.reviewReason;
  await adjustment.save();
  await recordAudit({
    actorId: adjustment.reviewedBy,
    entityType: 'PayrollAdjustment',
    entityId: adjustment._id,
    action: 'payroll_adjustment_voided',
    before,
    after: { status: adjustment.status, reviewedAt: adjustment.reviewedAt },
    reason: adjustment.reviewReason,
  });
  res.json({ data: adjustment });
};
