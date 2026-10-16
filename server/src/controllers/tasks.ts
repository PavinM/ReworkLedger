import type { RequestHandler } from 'express';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { HttpError } from '../middleware/errors.js';
import type { TaskStatus } from '../types/domain.js';
import { canTransitionTask, getCompletionDates } from '../services/taskRules.js';

export const listTasks: RequestHandler = async (req, res) => {
  const filter = typeof req.query.projectId === 'string' ? { projectId: req.query.projectId } : {};
  const tasks = await Task.find(filter).sort({ updatedAt: -1 }).lean();
  res.json({ data: tasks });
};

export const createTask: RequestHandler = async (req, res) => {
  const project = await Project.exists({ _id: req.body.projectId });
  if (!project) throw new HttpError(404, 'Project not found');
  const task = await Task.create(req.body);
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

  const nextStatus = req.body.status as TaskStatus;
  if (!canTransitionTask(task.status, nextStatus)) {
    throw new HttpError(400, `Invalid task status transition from ${task.status} to ${nextStatus}`);
  }

  task.status = nextStatus;
  const completionDates = getCompletionDates(nextStatus, task.originalCompletedAt, new Date());
  task.originalCompletedAt = completionDates.originalCompletedAt;
  task.currentCompletedAt = completionDates.currentCompletedAt;
  await task.save();
  res.json({ data: task });
};
