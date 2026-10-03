import { z } from 'zod';
import { Trial, Lead, Followup, logActivity } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { nextId } from '../utils/sequence.js';
import { buildListQuery, paginated } from '../utils/query.js';
import { toCSV } from '../utils/csv.js';
import { addDays, startOfDay, endOfDay } from '../utils/dates.js';
import { SESSION_STATUSES, TRIAL_OUTCOMES, LEAD_OWNERS } from '../config/constants.js';

const optionalDate = z.union([z.coerce.date(), z.literal(''), z.null()]).optional()
  .transform((v) => (v === '' || v === null ? undefined : v));

export const trialSchema = z.object({
  lead: z.string().min(1, 'Link this trial to a lead'),
  subject: z.string().optional(),
  tutor: z.string().optional(),
  scheduledDate: z.coerce.date(),
  startTime: z.string().optional(),
  durationMinutes: z.coerce.number().min(5).max(300).optional(),
  sessionStatus: z.enum(SESSION_STATUSES).optional(),
  adminReviewer: z.string().optional(),
  tutorFeedback: z.string().optional(),
  clientFeedback: z.string().optional(),
  strongPoints: z.string().optional(),
  areasToImprove: z.string().optional(),
  commercialFollowUpOwner: z.enum([...LEAD_OWNERS, '']).optional(),
  followUpDeadline: optionalDate,
  outcome: z.enum(TRIAL_OUTCOMES).optional(),
  nextStep: z.string().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
});

export const trialUpdateSchema = trialSchema.partial().omit({ lead: true });

const LIST_OPTS = {
  filterable: ['sessionStatus', 'outcome', 'tutor', 'subject', 'commercialFollowUpOwner', 'leadId'],
  searchFields: ['studentName', 'tutor', 'subject', 'trialId', 'leadId'],
  dateField: 'scheduledDate',
  defaultSort: '-scheduledDate',
};

function applyViewFilter(filter, view) {
  const now = new Date();
  switch (view) {
    case 'today':
      filter.scheduledDate = { $gte: startOfDay(now), $lte: endOfDay(now) };
      break;
    case 'upcoming':
      filter.scheduledDate = { $gte: startOfDay(now), $lte: endOfDay(addDays(now, 7)) };
      filter.sessionStatus = 'Scheduled';
      break;
    case 'awaiting-feedback':
      filter.sessionStatus = 'Completed';
      filter.$or = [{ tutorFeedback: { $in: [null, ''] } }, { commercialFollowUpOwner: { $in: [null, ''] } }];
      break;
    default:
      break;
  }
  return filter;
}

export const listTrials = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildListQuery(req.query, LIST_OPTS);
  applyViewFilter(filter, req.query.view);
  const [items, total] = await Promise.all([
    Trial.find(filter).sort(sort).skip(skip).limit(limit),
    Trial.countDocuments(filter),
  ]);
  res.json(paginated(items, total, page, limit));
});

export const getTrial = asyncHandler(async (req, res) => {
  const trial = await Trial.findById(req.params.id).populate('lead', 'leadId studentName phone pipelineStage');
  if (!trial) throw ApiError.notFound('Trial not found');
  res.json({ success: true, data: trial });
});

export const createTrial = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.body.lead);
  if (!lead) throw ApiError.badRequest('The linked lead no longer exists');

  const trial = new Trial({
    ...req.body,
    leadId: lead.leadId,
    studentName: lead.studentName,
    subject: req.body.subject || lead.subject,
    tutor: req.body.tutor || lead.assignedTutor,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  trial.trialId = await nextId('TRL');
  await trial.save();

  // Keep the Master Pipeline row in step with the trial (operating rule 3).
  lead.trialStatus = 'Scheduled';
  lead.trialDateTime = trial.scheduledDate;
  if (trial.tutor) lead.assignedTutor = trial.tutor;
  if (['New Lead', 'Contacted', 'Qualified', 'Trial to Schedule'].includes(lead.pipelineStage)) {
    lead.pipelineStage = 'Trial Scheduled';
  }
  await lead.save();

  await logActivity({ entity: 'Trial', doc: trial, action: 'create', user: req.user, summary: `Trial booked for ${trial.studentName}` });
  res.status(201).json({ success: true, data: trial });
});

export const updateTrial = asyncHandler(async (req, res) => {
  const trial = await Trial.findById(req.params.id);
  if (!trial) throw ApiError.notFound('Trial not found');

  const before = trial.toObject();
  Object.assign(trial, req.body, { updatedBy: req.user._id });

  // Operating rule 4: completing a trial requires feedback + a commercial follow-up.
  if (trial.sessionStatus === 'Completed' && before.sessionStatus !== 'Completed') {
    if (!trial.followUpDeadline) trial.followUpDeadline = addDays(new Date(), 1);
  }
  await trial.save();

  const lead = await Lead.findById(trial.lead);
  if (lead) {
    const map = { Completed: 'Completed', 'No-show': 'No-show', Cancelled: 'Cancelled', Rescheduled: 'Reschedule', Scheduled: 'Scheduled' };
    lead.trialStatus = map[trial.sessionStatus] || lead.trialStatus;
    lead.trialDateTime = trial.scheduledDate;
    if (trial.sessionStatus === 'Completed' && lead.pipelineStage === 'Trial Scheduled') {
      lead.pipelineStage = 'Trial Completed';
      lead.conversionStatus = 'Pending Decision';
    }
    await lead.save();
  }

  await logActivity({
    entity: 'Trial', doc: trial, action: 'update', user: req.user, before,
    fields: ['sessionStatus', 'outcome', 'tutor', 'scheduledDate', 'commercialFollowUpOwner', 'rating'],
    summary: 'Trial updated',
  });
  res.json({ success: true, data: trial });
});

/** Logs the post-trial review and (optionally) opens the 24-hour commercial follow-up. */
export const reviewTrial = asyncHandler(async (req, res) => {
  const trial = await Trial.findById(req.params.id);
  if (!trial) throw ApiError.notFound('Trial not found');

  const { tutorFeedback, clientFeedback, strongPoints, areasToImprove, rating, outcome, nextStep, createFollowup, followUpOwner } = req.body;
  Object.assign(trial, {
    tutorFeedback, clientFeedback, strongPoints, areasToImprove, rating, outcome, nextStep,
    sessionStatus: 'Completed',
    commercialFollowUpOwner: followUpOwner || trial.commercialFollowUpOwner,
    followUpDeadline: trial.followUpDeadline || addDays(new Date(), 1),
    updatedBy: req.user._id,
  });
  await trial.save();

  let followup = null;
  if (createFollowup) {
    const lead = await Lead.findById(trial.lead);
    followup = new Followup({
      lead: trial.lead,
      leadId: trial.leadId,
      contactName: lead?.parentName || trial.studentName,
      owner: trial.commercialFollowUpOwner || lead?.leadOwner || 'Other',
      actionType: 'Call',
      dueDate: trial.followUpDeadline,
      priority: 'High',
      nextAction: `Post-trial commercial follow-up for ${trial.studentName}`,
      createdBy: req.user._id,
    });
    followup.actionId = await nextId('FU');
    await followup.save();

    if (lead) {
      lead.pipelineStage = 'Follow-up';
      lead.conversionStatus = 'Pending Decision';
      lead.nextAction = followup.nextAction;
      lead.nextFollowUp = followup.dueDate;
      await lead.save();
    }
  }

  res.json({ success: true, data: { trial, followup } });
});

export const deleteTrial = asyncHandler(async (req, res) => {
  const trial = await Trial.findByIdAndDelete(req.params.id);
  if (!trial) throw ApiError.notFound('Trial not found');
  res.json({ success: true, message: 'Trial removed' });
});

export const exportTrials = asyncHandler(async (req, res) => {
  const { filter, sort } = buildListQuery(req.query, LIST_OPTS);
  applyViewFilter(filter, req.query.view);
  const rows = await Trial.find(filter).sort(sort).limit(5000);
  const csv = toCSV(rows, [
    { label: 'Trial ID', key: 'trialId' },
    { label: 'Lead ID', key: 'leadId' },
    { label: 'Student', key: 'studentName' },
    { label: 'Subject', key: 'subject' },
    { label: 'Tutor', key: 'tutor' },
    { label: 'Scheduled Date', key: 'scheduledDate' },
    { label: 'Start Time', key: 'startTime' },
    { label: 'Duration (min)', key: 'durationMinutes' },
    { label: 'Session Status', key: 'sessionStatus' },
    { label: 'Admin Reviewer', key: 'adminReviewer' },
    { label: 'Tutor Feedback', key: 'tutorFeedback' },
    { label: 'Client Feedback', key: 'clientFeedback' },
    { label: 'Strong Points', key: 'strongPoints' },
    { label: 'Areas to Improve', key: 'areasToImprove' },
    { label: 'Commercial Follow-up Owner', key: 'commercialFollowUpOwner' },
    { label: 'Follow-up Deadline', key: 'followUpDeadline' },
    { label: 'Outcome / Next Step', value: (r) => [r.outcome, r.nextStep].filter(Boolean).join(' — ') },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tutwithus-trial-sessions.csv"');
  res.send(csv);
});
