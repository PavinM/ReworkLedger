import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/errors.js';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

function publicUser(user: { _id: unknown; name: string; email: string; role: string }) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

export const login: RequestHandler = async (req, res) => {
  const user = await User.findOne({ email: req.body.email, active: true }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  const safeUser = publicUser(user);
  const token = jwt.sign({ sub: safeUser.id, role: safeUser.role }, jwtSecret(), { expiresIn: '8h' });
  res.json({ data: { token, user: safeUser } });
};

export const registerEmployee: RequestHandler = async (req, res) => {
  const existing = await User.exists({ email: req.body.email });
  if (existing) throw new HttpError(409, 'An account with this email already exists');
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    role: 'employee',
  });
  res.status(201).json({ data: { user: publicUser(user) } });
};

export const listUsers: RequestHandler = async (_req, res) => {
  const users = await User.find().select('_id name email role active createdAt updatedAt').sort({ createdAt: -1 }).lean();
  res.json({ data: users.map((user) => ({ id: String(user._id), name: user.name, email: user.email, role: user.role, active: user.active, createdAt: user.createdAt, updatedAt: user.updatedAt })) });
};

export const createStaff: RequestHandler = async (req, res) => {
  const existing = await User.exists({ email: req.body.email });
  if (existing) throw new HttpError(409, 'An account with this email already exists');
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    role: req.body.role,
    active: true,
  });
  res.status(201).json({ data: { user: publicUser(user) } });
};

export const updateUserStatus: RequestHandler = async (req, res) => {
  if (req.params.id === req.user!.id) throw new HttpError(400, 'You cannot deactivate your own account');
  const user = await User.findByIdAndUpdate(req.params.id, { active: req.body.active }, { new: true }).lean();
  if (!user) throw new HttpError(404, 'User account not found');
  res.json({ data: { user: { ...publicUser(user), active: user.active } } });
};

export const me: RequestHandler = async (req, res) => {
  const user = await User.findById(req.user!.id).lean();
  if (!user || !user.active) throw new HttpError(401, 'User account is unavailable');
  res.json({ data: { user: publicUser(user) } });
};
