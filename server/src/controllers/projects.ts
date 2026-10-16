import type { RequestHandler } from 'express';
import { Project } from '../models/Project.js';
import { HttpError } from '../middleware/errors.js';

export const listProjects: RequestHandler = async (_req, res) => {
  const projects = await Project.find().sort({ updatedAt: -1 }).lean();
  res.json({ data: projects });
};

export const createProject: RequestHandler = async (req, res) => {
  const project = await Project.create({ ...req.body, managerId: req.user!.id });
  res.status(201).json({ data: project });
};

export const getProject: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Project id is required');
  const project = await Project.findById(req.params.id).lean();
  if (!project) throw new HttpError(404, 'Project not found');
  res.json({ data: project });
};
