import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { Defect } from '../models/Defect.js';
import { Task } from '../models/Task.js';
import { HttpError } from '../middleware/errors.js';
import { canReportDefect, shouldReopenTask } from '../services/defectRules.js';

export const listDefects: RequestHandler = async (req, res) => {
  const filter = typeof req.query.projectId === 'string' ? { projectId: req.query.projectId } : {};
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
  if (!['reported', 'approved', 'under_review'].includes(defect.status)) throw new HttpError(400, 'This defect is not awaiting an employee fix');
  defect.resolutionDescription = req.body.resolutionDescription;
  defect.resolutionEvidence = req.body.resolutionEvidence;
  defect.resolutionSubmittedAt = new Date();
  defect.resolutionSubmittedBy = new mongoose.Types.ObjectId(req.user!.id);
  defect.status = 'under_review';
  await defect.save();
  res.json({ data: defect });
};

export const acceptDefectResolution: RequestHandler = async (req, res) => {
  const defect = await Defect.findById(req.params.id);
  if (!defect) throw new HttpError(404, 'Defect not found');
  if (defect.status !== 'under_review' || !defect.resolutionDescription) throw new HttpError(400, 'Employee resolution must be submitted before acceptance');
  defect.status = 'resolved';
  defect.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
  defect.reviewReason = req.body.reviewReason;
  await defect.save();
  res.json({ data: defect });
};
