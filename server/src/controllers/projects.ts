import type { RequestHandler } from 'express';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';
import { HttpError } from '../middleware/errors.js';

export const listProjects: RequestHandler = async (req, res) => {
  const filter = req.user?.role === 'employee' ? { assignedEmployeeId: req.user.id } : {};
  const projects = await Project.find(filter).sort({ updatedAt: -1 }).lean();
  const assignedProjects = projects.filter((project) => project.assignedEmployeeId);
  for (const project of assignedProjects) {
    const hasDelivery = await Task.exists({ projectId: project._id, assigneeId: project.assignedEmployeeId });
    if (!hasDelivery) {
      const employee = await User.findById(project.assignedEmployeeId).select('name').lean();
      await Task.create({
        projectId: project._id,
        title: `${project.name} delivery`,
        description: project.description,
        assigneeId: project.assignedEmployeeId,
        assigneeName: employee?.name ?? 'Assigned employee',
        createdBy: project.managerId,
      });
    }
  }
  res.json({ data: projects });
};

export const createProject: RequestHandler = async (req, res) => {
  if (req.body.assignedEmployeeId) {
    const employee = await User.exists({ _id: req.body.assignedEmployeeId, role: 'employee', active: true });
    if (!employee) throw new HttpError(400, 'Assigned user must be an active employee');
  }
  const project = await Project.create({ ...req.body, managerId: req.user!.id });
  if (req.body.assignedEmployeeId) {
    await Task.create({
      projectId: project._id,
      title: `${project.name} delivery`,
      description: project.description,
      assigneeId: req.body.assignedEmployeeId,
      assigneeName: (await User.findById(req.body.assignedEmployeeId).select('name').lean())?.name ?? 'Assigned employee',
      createdBy: req.user!.id,
    });
  }
  res.status(201).json({ data: project });
};

export const getProject: RequestHandler = async (req, res) => {
  if (!req.params.id) throw new HttpError(400, 'Project id is required');
  const project = await Project.findById(req.params.id).lean();
  if (!project) throw new HttpError(404, 'Project not found');
  res.json({ data: project });
};

export const listEmployees: RequestHandler = async (_req, res) => {
  const employees = await User.find({ role: 'employee', active: true }).select('_id name email').sort({ name: 1 }).lean();
  res.json({ data: employees.map((employee) => ({ id: String(employee._id), name: employee.name, email: employee.email })) });
};
