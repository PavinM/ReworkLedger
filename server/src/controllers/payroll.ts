import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
import { Defect } from '../models/Defect.js';
import { PayrollAdjustment } from '../models/PayrollAdjustment.js';
import { Task } from '../models/Task.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/errors.js';
import { recordAudit } from '../services/audit.js';
import { calculateNextMonthSalary } from '../services/payrollCalculation.js';
import { calculateReworkPayroll } from '../services/reworkPayroll.js';

export const calculatePayroll: RequestHandler = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { employeeId, periodStart, periodEnd, currency, configuredHourlyRate, baseSalary } = req.body;
    const employee = await User.findById(employeeId).session(session).select('hourlyRate baseSalary payrollCurrency').lean();
    if (!employee) throw new HttpError(404, 'Payroll employee not found');
    const effectiveHourlyRate = employee.hourlyRate ?? configuredHourlyRate;
    const effectiveBaseSalary = employee.baseSalary ?? baseSalary;
    const effectiveCurrency = employee.payrollCurrency ?? currency;
    const entries = await TimeEntry.find({
      employeeId,
      date: { $gte: periodStart, $lte: periodEnd },
      category: 'corrective_work',
      approvalStatus: 'approved',
      $or: [{ payrollAdjustmentId: { $exists: false } }, { payrollAdjustmentId: null }],
    }).session(session);

    const eligibleDefectIds = [...new Set(entries.flatMap((entry) => entry.defectId ? [entry.defectId.toString()] : []))];
    const approvedDefects = await Defect.find({ _id: { $in: eligibleDefectIds }, status: { $in: ['approved', 'resolved'] } }).session(session).select('_id');
    const approvedDefectSet = new Set(approvedDefects.map((defect) => defect._id.toString()));
    const eligibleEntries = entries.filter((entry) => entry.defectId && approvedDefectSet.has(entry.defectId.toString()));
    if (!eligibleEntries.length) throw new HttpError(400, 'No eligible approved corrective time entries found for this period');

    const defectRecords = await Defect.find({ _id: { $in: eligibleEntries.map((entry) => entry.defectId) } }).select('_id cause').session(session).lean();
    const causeByDefect = new Map(defectRecords.map((defect) => [defect._id.toString(), defect.cause]));
    const calculation = calculateReworkPayroll(eligibleEntries.map((entry) => {
      const cause = causeByDefect.get(entry.defectId!.toString());
      if (!cause) throw new HttpError(409, `Defect cause is unavailable for time entry ${entry._id}`);
      const snapshotCurrency = entry.compensationCurrency ?? effectiveCurrency;
      if (snapshotCurrency !== effectiveCurrency) {
        throw new HttpError(409, `Time entry ${entry._id} uses ${snapshotCurrency}; split or reconcile payroll by currency`);
      }
      return {
        id: entry._id,
        taskId: entry.taskId,
        defectId: entry.defectId!,
        date: entry.date,
        hours: entry.hours,
        cause,
        hourlyRate: entry.compensationHourlyRate ?? effectiveHourlyRate,
      };
    }));
    const existingApprovedAdjustments = await PayrollAdjustment.find({
      employeeId,
      periodStart,
      status: 'approved',
    }).session(session).select('adjustmentType proposedAmount').lean();
    const nextMonthSalary = calculateNextMonthSalary(effectiveBaseSalary, [
      ...existingApprovedAdjustments,
      calculation,
    ]);
    const adjustment = await PayrollAdjustment.create([{
      employeeId,
      periodStart,
      periodEnd,
      currency: effectiveCurrency,
      approvedTimeEntryIds: eligibleEntries.map((entry) => entry._id),
      ...calculation,
      baseSalary: effectiveBaseSalary,
      nextMonthSalary,
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
      actorId: new mongoose.Types.ObjectId(req.user!.id),
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
  const taskIds = [...new Set(adjustments.flatMap((adjustment) => adjustment.calculationBreakdown.map((line) => line.taskId.toString())))];
  const defectIds = [...new Set(adjustments.flatMap((adjustment) => adjustment.calculationBreakdown.map((line) => line.defectId.toString())))];
  const employees = await User.find({ _id: { $in: employeeIds } }).select('_id name').lean();
  const tasks = await Task.find({ _id: { $in: taskIds } }).select('_id title').lean();
  const defects = await Defect.find({ _id: { $in: defectIds } }).select('_id title module cause').lean();
  const employeeNames = new Map(employees.map((employee) => [employee._id.toString(), employee.name]));
  const taskDetails = new Map(tasks.map((task) => [task._id.toString(), { taskTitle: task.title }]));
  const defectDetails = new Map(defects.map((defect) => [defect._id.toString(), {
    defectTitle: defect.title,
    module: defect.module,
    cause: defect.cause,
  }]));
  res.json({
    data: adjustments.map((adjustment) => ({
      ...adjustment,
      employeeName: employeeNames.get(adjustment.employeeId.toString()) ?? 'Employee',
      calculationBreakdown: adjustment.calculationBreakdown.map((line) => ({
        ...line,
        ...taskDetails.get(line.taskId.toString()),
        ...defectDetails.get(line.defectId.toString()),
      })),
    })),
  });
};

export const listPayrollEmployees: RequestHandler = async (_req, res) => {
  const employees = await User.find({ role: 'employee', active: true })
    .select('_id name hourlyRate baseSalary payrollCurrency')
    .sort({ name: 1 })
    .lean();
  res.json({
    data: employees.map((employee) => ({
      id: employee._id,
      name: employee.name,
      hourlyRate: employee.hourlyRate ?? 1000,
      baseSalary: employee.baseSalary ?? 50000,
      payrollCurrency: employee.payrollCurrency ?? 'INR',
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

export const submitPayrollDispute: RequestHandler = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const adjustment = await PayrollAdjustment.findById(req.params.id).session(session);
    if (!adjustment) throw new HttpError(404, 'Payroll adjustment not found');
    if (req.user!.role !== 'employee' || adjustment.employeeId.toString() !== req.user!.id) {
      throw new HttpError(403, 'Only the employee receiving this adjustment can dispute it');
    }
    if (adjustment.status !== 'pending_review' || adjustment.adjustmentType !== 'debit') {
      throw new HttpError(400, 'Only a pending deduction can be disputed');
    }
    if (adjustment.disputeStatus && adjustment.disputeStatus !== 'none') {
      throw new HttpError(400, 'A dispute has already been submitted for this adjustment');
    }
    adjustment.disputeStatus = 'pending';
    adjustment.disputeReason = req.body.reason;
    adjustment.disputedAt = new Date();
    await adjustment.save({ session });
    await recordAudit({
      actorId: new mongoose.Types.ObjectId(req.user!.id),
      entityType: 'PayrollAdjustment',
      entityId: adjustment._id,
      action: 'payroll_dispute_submitted',
      after: { disputeStatus: adjustment.disputeStatus, disputeReason: adjustment.disputeReason, disputedAt: adjustment.disputedAt },
      reason: adjustment.disputeReason,
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

export const reviewPayrollDispute: RequestHandler = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const adjustment = await PayrollAdjustment.findById(req.params.id).session(session);
    if (!adjustment) throw new HttpError(404, 'Payroll adjustment not found');
    if (adjustment.disputeStatus !== 'pending') throw new HttpError(400, 'This adjustment has no pending dispute');
    if (adjustment.employeeId.toString() === req.user!.id) {
      throw new HttpError(403, 'Employees cannot review their own payroll dispute');
    }

    const before = { disputeStatus: adjustment.disputeStatus, status: adjustment.status };
    adjustment.disputeStatus = req.body.decision;
    adjustment.disputeReviewedBy = new mongoose.Types.ObjectId(req.user!.id);
    adjustment.disputeReviewedAt = new Date();
    adjustment.disputeResolution = req.body.resolution;
    if (req.body.decision === 'accepted') {
      adjustment.status = 'rejected';
      adjustment.reviewedBy = adjustment.disputeReviewedBy;
      adjustment.reviewedAt = adjustment.disputeReviewedAt;
      adjustment.reviewReason = req.body.resolution;
      const approvedAdjustments = await PayrollAdjustment.find({
        employeeId: adjustment.employeeId,
        periodStart: adjustment.periodStart,
        status: 'approved',
        _id: { $ne: adjustment._id },
      }).session(session).select('adjustmentType proposedAmount').lean();
      adjustment.nextMonthSalary = calculateNextMonthSalary(adjustment.baseSalary, approvedAdjustments);
    }
    await adjustment.save({ session });
    await recordAudit({
      actorId: adjustment.disputeReviewedBy,
      entityType: 'PayrollAdjustment',
      entityId: adjustment._id,
      action: `payroll_dispute_${adjustment.disputeStatus}`,
      before,
      after: {
        disputeStatus: adjustment.disputeStatus,
        status: adjustment.status,
        disputeReviewedAt: adjustment.disputeReviewedAt,
        disputeResolution: adjustment.disputeResolution,
      },
      reason: adjustment.disputeResolution,
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

export const reviewPayroll: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Payroll adjustment id is required');
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const adjustment = await PayrollAdjustment.findById(req.params.id).session(session);
    if (!adjustment) throw new HttpError(404, 'Payroll adjustment not found');
    if (adjustment.status !== 'pending_review') throw new HttpError(400, `Payroll adjustment cannot be reviewed from ${adjustment.status} status`);
    if (adjustment.employeeId.toString() === req.user!.id) throw new HttpError(403, 'Employees cannot approve their own payroll adjustment');
    if (adjustment.disputeStatus === 'pending') throw new HttpError(409, 'Resolve the employee dispute before reviewing this payroll adjustment');
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
  if (adjustment.disputeStatus === 'pending') throw new HttpError(409, 'Resolve the employee dispute before voiding this adjustment');
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
