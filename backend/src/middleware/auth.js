import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { WRITE_ROLES } from '../config/constants.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw ApiError.unauthorized('Session expired, please sign in again');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active) throw ApiError.unauthorized('Account is inactive');

  req.user = user;
  next();
});

/** Route guard: restrict(['admin','manager']) */
export const restrict = (roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden('Your role cannot perform this action'));
  next();
};

/** Anyone who may create/edit commercial records. */
export const canWrite = restrict(WRITE_ROLES);

export const signToken = (user) =>
  jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
