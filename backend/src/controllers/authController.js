import { z } from 'zod';
import { User } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { signToken } from '../middleware/auth.js';
import { USER_ROLES, LEAD_OWNERS } from '../config/constants.js';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(USER_ROLES).optional(),
  ownerAlias: z.enum(LEAD_OWNERS).optional(),
  phone: z.string().optional(),
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Incorrect email or password');
  }
  if (!user.active) throw ApiError.forbidden('This account has been deactivated');

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, token: signToken(user), data: user.toJSON() });
});

export const register = asyncHandler(async (req, res) => {
  const exists = await User.findOne({ email: req.body.email.toLowerCase() });
  if (exists) throw ApiError.conflict('That email is already registered');
  const user = await User.create(req.body);
  res.status(201).json({ success: true, data: user.toJSON() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user.toJSON() });
});

export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'ownerAlias'];
  for (const key of allowed) if (req.body[key] !== undefined) req.user[key] = req.body[key];
  await req.user.save();
  res.json({ success: true, data: req.user.toJSON() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) throw ApiError.badRequest('New password must be at least 8 characters');
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword || ''))) throw ApiError.unauthorized('Current password is incorrect');
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated' });
});

/* ---------- user administration ---------- */

export const listUsers = asyncHandler(async (_req, res) => {
  const users = await User.find().sort('name');
  res.json({ success: true, data: users });
});

export const updateUser = asyncHandler(async (req, res) => {
  const allowed = ['name', 'role', 'ownerAlias', 'phone', 'active'];
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  for (const key of allowed) if (req.body[key] !== undefined) user[key] = req.body[key];
  if (req.body.password) user.password = req.body.password;
  await user.save();
  res.json({ success: true, data: user.toJSON() });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest('You cannot delete your own account');
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, message: 'User removed' });
});
