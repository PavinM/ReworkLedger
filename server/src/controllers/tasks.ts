import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/errors.js';
import type { TaskStatus } from '../types/domain.js';
import { canTransitionTask, getCompletionDates } from '../services/taskRules.js';
import { recordAudit } from '../services/audit.js';

export const listTasks: RequestHandler = async (req, res) => {
  const filter: Record<string, unknown> = typeof req.query.projectId === 'string' ? { projectId: req.query.projectId } : {};
  if (req.user?.role === 'employee') filter.assigneeId = req.user.id;
  const tasks = await Task.find(filter).sort({ updatedAt: -1 }).lean();
  const actorIds = [...new Set(tasks.flatMap((task) => (task.statusHistory ?? []).map((entry) => entry.changedBy.toString())))];
  const actors = await User.find({ _id: { $in: actorIds } }).select('_id name').lean();
  const actorNames = new Map(actors.map((actor) => [actor._id.toString(), actor.name]));
  res.json({
    data: tasks.map((task) => ({
      ...task,
      statusHistory: (task.statusHistory ?? []).map((entry) => ({
        ...entry,
        changedByName: actorNames.get(entry.changedBy.toString()) ?? 'Former user',
      })),
    })),
  });
};

export const createTask: RequestHandler = async (req, res) => {
  const project = await Project.exists({ _id: req.body.projectId });
  if (!project) throw new HttpError(404, 'Project not found');
  const task = await Task.create({
    ...req.body,
    createdBy: req.user!.id,
    statusHistory: [{
      toStatus: req.body.status ?? 'assigned',
      changedBy: req.user!.id,
      changedAt: new Date(),
      reason: 'Task created',
    }],
  });
  await recordAudit({
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    entityType: 'Task',
    entityId: task._id,
    action: 'task_created',
    after: { status: task.status, assigneeId: task.assigneeId, committedAt: task.committedAt },
  });
  res.status(201).json({ data: task });
};

export const getTask: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Task id is required');
  const task = await Task.findById(req.params.id).lean();
  if (!task) throw new HttpError(404, 'Task not found');
  res.json({ data: task });
};

export const updateTaskStatus: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Task id is required');
  const task = await Task.findById(req.params.id);
  if (!task) throw new HttpError(404, 'Task not found');
  if (req.user!.role === 'employee' && task.assigneeId.toString() !== req.user!.id) throw new HttpError(403, 'You can only update your assigned tasks');

  const nextStatus = req.body.status as TaskStatus;
  if (!canTransitionTask(task.status, nextStatus)) {
    throw new HttpError(400, `Invalid task status transition from ${task.status} to ${nextStatus}`);
  }

  const previousStatus = task.status;
  const changedAt = new Date();
  task.status = nextStatus;
  const completionDates = getCompletionDates(nextStatus, task.originalCompletedAt, changedAt);
  task.originalCompletedAt = completionDates.originalCompletedAt;
  task.currentCompletedAt = completionDates.currentCompletedAt;
  task.statusHistory.push({
    fromStatus: previousStatus,
    toStatus: nextStatus,
    changedBy: new mongoose.Types.ObjectId(req.user!.id),
    changedAt,
    reason: req.body.reason,
  });
  await task.save();
  await recordAudit({
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    entityType: 'Task',
    entityId: task._id,
    action: 'task_status_changed',
    before: { status: previousStatus },
    after: { status: nextStatus, changedAt },
    reason: req.body.reason,
  });
  res.json({ data: task });
};

export const updateTaskProgress: RequestHandler = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new HttpError(404, 'Task not found');
  if (req.user!.role === 'employee' && task.assigneeId.toString() !== req.user!.id) throw new HttpError(403, 'You can only update your assigned tasks');
  task.progressDescription = req.body.progressDescription;
  await task.save();
  res.json({ data: task });
};

export const submitTaskForReview: RequestHandler = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new HttpError(404, 'Task not found');
  if (task.assigneeId.toString() !== req.user!.id) throw new HttpError(403, 'You can only submit your assigned tasks');
  if (task.status !== 'completed') throw new HttpError(400, 'Complete the task before submitting it for review');
  task.reviewStatus = 'submitted';
  task.reviewReason = undefined;
  await task.save();
  res.json({ data: task });
};

export const reviewTask: RequestHandler = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new HttpError(404, 'Task not found');
  if (task.reviewStatus !== 'submitted') throw new HttpError(400, 'Only submitted tasks can be reviewed');
  task.reviewStatus = req.body.reviewStatus;
  task.reviewReason = req.body.reviewReason;
  task.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
  const previousStatus = task.status;
  if (req.body.reviewStatus === 'accepted') task.status = 'closed';
  if (req.body.reviewStatus === 'changes_requested') task.status = 'under_fix';
  if (task.status !== previousStatus) {
    task.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: task.status,
      changedBy: new mongoose.Types.ObjectId(req.user!.id),
      changedAt: new Date(),
      reason: req.body.reviewReason,
    });
  }
  await task.save();
  await Project.findByIdAndUpdate(task.projectId, {
    status: req.body.reviewStatus === 'accepted' ? 'completed' : 'active',
  });
  await recordAudit({
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    entityType: 'Task',
    entityId: task._id,
    action: `task_review_${req.body.reviewStatus}`,
    before: { status: previousStatus, reviewStatus: 'submitted' },
    after: { status: task.status, reviewStatus: task.reviewStatus },
    reason: req.body.reviewReason,
  });
  res.json({ data: task });
};
