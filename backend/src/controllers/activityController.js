import { ActivityLog } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildListQuery, paginated } from '../utils/query.js';

export const listActivity = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildListQuery(req.query, {
    filterable: ['entity', 'action', 'reference'],
    searchFields: ['summary', 'reference', 'userName'],
    defaultSort: '-createdAt',
  });
  const [items, total] = await Promise.all([
    ActivityLog.find(filter).sort(sort).skip(skip).limit(limit),
    ActivityLog.countDocuments(filter),
  ]);
  res.json(paginated(items, total, page, limit));
});
