/**
 * Turns ?page=&limit=&sort=&search=&<field>=<value>&from=&to= into a
 * Mongo filter + options. Shared by every list endpoint.
 */
export function buildListQuery(rawQuery, { filterable = [], searchFields = [], dateField = 'createdAt', defaultSort = '-createdAt' } = {}) {
  const page = Math.max(1, parseInt(rawQuery.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(rawQuery.limit, 10) || 25));
  const sort = (rawQuery.sort || defaultSort).split(',').join(' ');

  const filter = {};

  for (const field of filterable) {
    const value = rawQuery[field];
    if (value === undefined || value === '' || value === 'all') continue;
    filter[field] = String(value).includes(',') ? { $in: String(value).split(',') } : value;
  }

  if (rawQuery.search && searchFields.length) {
    const rx = new RegExp(String(rawQuery.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = searchFields.map((f) => ({ [f]: rx }));
  }

  if (rawQuery.from || rawQuery.to) {
    const field = rawQuery.dateField || dateField;
    filter[field] = {};
    if (rawQuery.from) filter[field].$gte = new Date(rawQuery.from);
    if (rawQuery.to) {
      const to = new Date(rawQuery.to);
      to.setHours(23, 59, 59, 999);
      filter[field].$lte = to;
    }
  }

  return { filter, page, limit, skip: (page - 1) * limit, sort };
}

export function paginated(items, total, page, limit) {
  return {
    success: true,
    data: items,
    meta: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}
