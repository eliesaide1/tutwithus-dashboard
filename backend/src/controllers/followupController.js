import { z } from 'zod';
import { Followup, Lead, logActivity } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { nextId } from '../utils/sequence.js';
import { buildListQuery, paginated } from '../utils/query.js';
import { toCSV } from '../utils/csv.js';
import { startOfDay, endOfDay, addDays } from '../utils/dates.js';
import {
  FOLLOWUP_ACTION_TYPES, FOLLOWUP_ACTION_STATUSES, PRIORITIES, LEAD_OWNERS,
} from '../config/constants.js';

const optionalDate = z.union([z.coerce.date(), z.literal(''), z.null()]).optional()
  .transform((v) => (v === '' || v === null ? undefined : v));

export const followupSchema = z.object({
  lead: z.string().min(1, 'Link this action to a lead'),
  owner: z.enum(LEAD_OWNERS).optional(),
  actionType: z.enum(FOLLOWUP_ACTION_TYPES).optional(),
  dueDate: z.coerce.date(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(FOLLOWUP_ACTION_STATUSES).optional(),
  lastAttempt: optionalDate,
  attempts: z.coerce.number().min(0).optional(),
  result: z.string().optional(),
  nextAction: z.string().optional(),
});

export const followupUpdateSchema = followupSchema.partial().omit({ lead: true });

const LIST_OPTS = {
  filterable: ['status', 'owner', 'priority', 'actionType', 'leadId'],
  searchFields: ['contactName', 'result', 'nextAction', 'actionId', 'leadId'],
  dateField: 'dueDate',
  defaultSort: 'dueDate',
};

function applyViewFilter(filter, view) {
  const now = new Date();
  const OPEN = { $in: ['Open', 'In Progress', 'No Answer', 'Rescheduled'] };
  switch (view) {
    case 'today':
      filter.dueDate = { $gte: startOfDay(now), $lte: endOfDay(now) };
      filter.status = OPEN;
      break;
    case 'overdue':
      filter.dueDate = { $lt: startOfDay(now) };
      filter.status = OPEN;
      break;
    case 'week':
      filter.dueDate = { $gte: startOfDay(now), $lte: endOfDay(addDays(now, 7)) };
      filter.status = OPEN;
      break;
    case 'open':
      filter.status = OPEN;
      break;
    default:
      break;
  }
  return filter;
}

export const listFollowups = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildListQuery(req.query, LIST_OPTS);
  applyViewFilter(filter, req.query.view);
  const [items, total] = await Promise.all([
    Followup.find(filter).sort(sort).skip(skip).limit(limit),
    Followup.countDocuments(filter),
  ]);
  res.json(paginated(items, total, page, limit));
});

export const createFollowup = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.body.lead);
  if (!lead) throw ApiError.badRequest('The linked lead no longer exists');

  const followup = new Followup({
    ...req.body,
    leadId: lead.leadId,
    contactName: lead.parentName || lead.studentName,
    owner: req.body.owner || lead.leadOwner,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  followup.actionId = await nextId('FU');
  await followup.save();

  // Operating rule 2: the pipeline row always shows the soonest next step.
  if (!lead.nextFollowUp || followup.dueDate < lead.nextFollowUp) {
    lead.nextFollowUp = followup.dueDate;
    lead.nextAction = followup.nextAction || `${followup.actionType} — ${followup.contactName}`;
    await lead.save();
  }

  await logActivity({ entity: 'Followup', doc: followup, action: 'create', user: req.user, summary: `Action booked for ${followup.contactName}` });
  res.status(201).json({ success: true, data: followup });
});

export const updateFollowup = asyncHandler(async (req, res) => {
  const followup = await Followup.findById(req.params.id);
  if (!followup) throw ApiError.notFound('Action not found');

  const before = followup.toObject();
  Object.assign(followup, req.body, { updatedBy: req.user._id });
  await followup.save();

  await logActivity({
    entity: 'Followup', doc: followup, action: 'update', user: req.user, before,
    fields: ['status', 'owner', 'dueDate', 'priority', 'attempts', 'result'],
    summary: 'Action updated',
  });
  res.json({ success: true, data: followup });
});

/** One-tap "I called them" from the mobile action board. */
export const logAttempt = asyncHandler(async (req, res) => {
  const followup = await Followup.findById(req.params.id);
  if (!followup) throw ApiError.notFound('Action not found');

  const { result, status = 'No Answer', nextDueDate, nextAction } = req.body;
  followup.attempts += 1;
  followup.lastAttempt = new Date();
  followup.status = status;
  if (result) followup.result = [followup.result, result].filter(Boolean).join('\n');
  if (nextAction) followup.nextAction = nextAction;
  if (nextDueDate) followup.dueDate = new Date(nextDueDate);
  followup.updatedBy = req.user._id;
  await followup.save();

  const lead = await Lead.findById(followup.lead);
  if (lead) {
    lead.lastContactDate = new Date();
    if (followup.status === 'Completed') {
      lead.nextFollowUp = nextDueDate ? new Date(nextDueDate) : lead.nextFollowUp;
    } else {
      lead.nextFollowUp = followup.dueDate;
      lead.nextAction = followup.nextAction || lead.nextAction;
    }
    await lead.save();
  }

  res.json({ success: true, data: followup });
});

export const completeFollowup = asyncHandler(async (req, res) => {
  const followup = await Followup.findById(req.params.id);
  if (!followup) throw ApiError.notFound('Action not found');
  followup.status = 'Completed';
  followup.completedAt = new Date();
  followup.lastAttempt = new Date();
  followup.attempts += 1;
  if (req.body.result) followup.result = [followup.result, req.body.result].filter(Boolean).join('\n');
  followup.updatedBy = req.user._id;
  await followup.save();

  const lead = await Lead.findById(followup.lead);
  if (lead) {
    lead.lastContactDate = new Date();
    const stillOpen = await Followup.findOne({
      lead: lead._id,
      status: { $in: ['Open', 'In Progress', 'No Answer', 'Rescheduled'] },
    }).sort('dueDate');
    lead.nextFollowUp = stillOpen ? stillOpen.dueDate : undefined;
    lead.nextAction = stillOpen ? stillOpen.nextAction : '';
    await lead.save();
  }
  res.json({ success: true, data: followup });
});

export const deleteFollowup = asyncHandler(async (req, res) => {
  const followup = await Followup.findByIdAndDelete(req.params.id);
  if (!followup) throw ApiError.notFound('Action not found');
  res.json({ success: true, message: 'Action removed' });
});

export const exportFollowups = asyncHandler(async (req, res) => {
  const { filter, sort } = buildListQuery(req.query, LIST_OPTS);
  applyViewFilter(filter, req.query.view);
  const rows = await Followup.find(filter).sort(sort).limit(5000);
  const csv = toCSV(rows, [
    { label: 'Action ID', key: 'actionId' },
    { label: 'Lead ID', key: 'leadId' },
    { label: 'Student / Parent', key: 'contactName' },
    { label: 'Owner', key: 'owner' },
    { label: 'Action Type', key: 'actionType' },
    { label: 'Due Date', key: 'dueDate' },
    { label: 'Priority', key: 'priority' },
    { label: 'Status', key: 'status' },
    { label: 'Last Attempt', key: 'lastAttempt' },
    { label: 'Attempts', key: 'attempts' },
    { label: 'Result / Notes', key: 'result' },
    { label: 'Next Action', key: 'nextAction' },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tutwithus-followups.csv"');
  res.send(csv);
});
