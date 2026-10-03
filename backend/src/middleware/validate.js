import { ApiError } from '../utils/ApiError.js';

/** Validates req[source] with a zod schema and replaces it with the parsed value. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return next(ApiError.badRequest('Please check the highlighted fields', details));
  }
  if (source === 'body') req.body = result.data;
  else req.validatedQuery = result.data;
  next();
};
