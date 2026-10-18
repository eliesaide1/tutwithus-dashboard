import { z } from 'zod';
import { Lead, Trial, Followup, Student, ActivityLog, logActivity } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { nextId } from '../utils/sequence.js';
import { buildListQuery, paginated } from '../utils/query.js';
import { toCSV } from '../utils/csv.js';
import { computeFollowUpStatus } from '../utils/dates.js';
import {
  PIPELINE_STAGES, LEAD_SOURCES, PRIORITIES, LEAD_OWNERS, TRIAL_STATUSES,
  CONVERSION_STATUSES, PAYMENT_STATUSES, LOSS_REASONS, GRADE_LEVELS,
} from '../config/constants.js';

const optionalDate = z.union([z.coerce.date(), z.literal(''), z.null()]).optional()
  .transform((v) => (v === '' || v === null ? undefined : v));

export const leadSchema = z.object({
  dateReceived: optionalDate,
  studentName: z.string().min(2, 'Student name is required'),
  parentName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  leadSource: z.enum(LEAD_SOURCES).optional(),
  gradeLevel: z.enum([...GRADE_LEVELS, '']).optional(),
  subject: z.string().optional(),
  needSummary: z.string().optional(),
  leadOwner: z.enum(LEAD_OWNERS).optional(),
  priority: z.enum(PRIORITIES).optional(),
  pipelineStage: z.enum(PIPELINE_STAGES).optional(),
  lastContactDate: optionalDate,
  nextAction: z.string().optional(),
  nextFollowUp: optionalDate,
  trialStatus: z.enum(TRIAL_STATUSES).optional(),
  trialDateTime: optionalDate,
  assignedTutor: z.string().optional(),
  conversionStatus: z.enum(CONVERSION_STATUSES).optional(),
  expectedRevenue: z.coerce.number().min(0).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  notes: z.string().optional(),
  lossReason: z.enum([...LOSS_REASONS, '']).optional(),
});

export const leadUpdateSchema = leadSchema.partial();

const TRACKED = [
  'pipelineStage', 'leadOwner', 'priority', 'trialStatus', 'conversionStatus',
  'paymentStatus', 'nextFollowUp', 'nextAction', 'expectedRevenue', 'assignedTutor', 'lossReason',
];

const LIST_OPTS = {
  filterable: ['pipelineStage', 'leadOwner', 'priority', 'leadSource', 'trialStatus', 'conversionStatus', 'paymentStatus', 'assignedTutor'],
  searchFields: ['studentName', 'parentName', 'phone', 'email', 'subject', 'notes', 'leadId'],
  dateField: 'dateReceived',
  defaultSort: '-dateReceived',
};

/** Extra filters the sheet's Management Attention block relies on. */
function applyViewFilter(filter, view) {
  const now = new Date();
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  switch (view) {
    case 'open':
      filter.pipelineStage = { $nin: ['Converted / Paid', 'Active', 'Lost'] };
      break;
    case 'due-today':
      filter.nextFollowUp = { $gte: todayStart, $lte: todayEnd };
      filter.pipelineStage = { $nin: ['Converted / Paid', 'Active', 'Lost'] };
      break;
    case 'overdue':
      filter.nextFollowUp = { $lt: todayStart };
      filter.pipelineStage = { $nin: ['Converted / Paid', 'Active', 'Lost'] };
      break;
    case 'missing-date':
      filter.$and = [
        { pipelineStage: { $nin: ['Converted / Paid', 'Active', 'Lost'] } },
        { $or: [{ nextFollowUp: null }, { nextFollowUp: { $exists: false } }] },
      ];
      break;
    case 'trials-today':
      filter.trialDateTime = { $gte: todayStart, $lte: todayEnd };
      break;
    case 'pending-payment':
      filter.paymentStatus = { $in: ['Pending', 'Invoice Sent', 'Partially Paid', 'Overdue'] };
      break;
    default:
      break;
  }
  return filter;
}

export const listLeads = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildListQuery(req.query, LIST_OPTS);
  applyViewFilter(filter, req.query.view);

  const [items, total] = await Promise.all([
    Lead.find(filter).sort(sort).skip(skip).limit(limit),
    Lead.countDocuments(filter),
  ]);
  res.json(paginated(items, total, page, limit));
});

export const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Lead not found');

  const [trials, followups, student, activity] = await Promise.all([
    Trial.find({ lead: lead._id }).sort('-scheduledDate'),
    Followup.find({ lead: lead._id }).sort('-dueDate'),
    Student.findOne({ $or: [{ lead: lead._id }, { 'enrollments.lead': lead._id }] }),
    ActivityLog.find({ entityId: lead._id }).sort('-createdAt').limit(50),
  ]);

  res.json({ success: true, data: { lead, trials, followups, student, activity } });
});

export const createLead = asyncHandler(async (req, res) => {
  const lead = new Lead({ ...req.body, createdBy: req.user._id, updatedBy: req.user._id });
  lead.leadId = await nextId('LEAD');
  await lead.save();
  await logActivity({ entity: 'Lead', doc: lead, action: 'create', user: req.user, summary: `Lead created for ${lead.studentName}` });
  res.status(201).json({ success: true, data: lead });
});

export const updateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Lead not found');

  const before = lead.toObject();
  Object.assign(lead, req.body, { updatedBy: req.user._id });
  await lead.save();

  const stageMoved = before.pipelineStage !== lead.pipelineStage;
  await logActivity({
    entity: 'Lead',
    doc: lead,
    action: stageMoved ? 'stage-change' : 'update',
    user: req.user,
    before,
    fields: TRACKED,
    summary: stageMoved ? `Stage: ${before.pipelineStage} → ${lead.pipelineStage}` : 'Lead updated',
  });

  res.json({ success: true, data: lead });
});

export const deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Lead not found');
  await Promise.all([
    Trial.deleteMany({ lead: lead._id }),
    Followup.deleteMany({ lead: lead._id }),
    Lead.deleteOne({ _id: lead._id }),
  ]);
  await logActivity({ entity: 'Lead', doc: lead, action: 'delete', user: req.user, summary: `Deleted ${lead.leadId}` });
  res.json({ success: true, message: 'Lead and its linked records were removed' });
});

/** Quick inline stage move from the board/table. */
export const changeStage = asyncHandler(async (req, res) => {
  const { pipelineStage, lossReason } = req.body;
  if (!PIPELINE_STAGES.includes(pipelineStage)) throw ApiError.badRequest('Unknown pipeline stage');

  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Lead not found');

  const before = lead.toObject();
  lead.pipelineStage = pipelineStage;
  if (lossReason !== undefined) lead.lossReason = lossReason;
  lead.updatedBy = req.user._id;
  await lead.save();

  await logActivity({
    entity: 'Lead', doc: lead, action: 'stage-change', user: req.user, before, fields: TRACKED,
    summary: `Stage: ${before.pipelineStage} → ${pipelineStage}`,
  });
  res.json({ success: true, data: lead });
});

/** Operating rule 5 — a lead only becomes a student after payment is confirmed. */
export const convertLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Lead not found');

  const alreadyConverted = await Student.findOne({ 'enrollments.lead': lead._id });
  if (alreadyConverted) throw ApiError.conflict('This lead already has an Active Students record');

  const body = req.body || {};
  if (!['Paid', 'Partially Paid'].includes(body.paymentStatus || lead.paymentStatus)) {
    throw ApiError.badRequest('Payment must be confirmed (Paid or Partially Paid) before converting');
  }

  const enrollment = {
    subject: body.subject || lead.subject || 'General',
    tutor: body.tutor || lead.assignedTutor,
    startDate: body.startDate || new Date(),
    packagePlan: body.packagePlan || '',
    sessionsPurchased: body.sessionsPurchased ?? 0,
    sessionsUsed: 0,
    amountPaid: body.amountPaid ?? lead.expectedRevenue ?? 0,
    paymentStatus: body.paymentStatus || lead.paymentStatus,
    nextSession: body.nextSession,
    renewalDate: body.renewalDate,
    notes: body.clientNotes || '',
    lead: lead._id,
    leadId: lead.leadId,
  };

  // The same person coming back for another subject joins their existing
  // record rather than becoming a second student.
  const digits = (lead.phone || '').replace(/\D/g, '');
  const match = [];
  if (digits.length >= 7) match.push({ phone: new RegExp(`${digits.slice(-9)}$`) });
  if (lead.studentName) {
    match.push({ name: new RegExp(`^${lead.studentName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  }
  let student = match.length ? await Student.findOne({ $or: match }) : null;

  if (student) {
    const clash = student.enrollments.find(
      (e) => e.subject.toLowerCase() === enrollment.subject.toLowerCase() && e.status === 'Active',
    );
    if (clash) throw ApiError.conflict(`${student.name} (${student.studentId}) already studies ${clash.subject}`);
    student.enrollments.push(enrollment);
    student.parentName = student.parentName || lead.parentName;
    student.email = student.email || lead.email;
    student.updatedBy = req.user._id;
    await student.save();
  } else {
    student = new Student({
      lead: lead._id,
      leadId: lead.leadId,
      name: lead.studentName,
      parentName: lead.parentName,
      phone: lead.phone,
      email: lead.email,
      gradeLevel: lead.gradeLevel,
      clientNotes: body.clientNotes || '',
      enrollments: [enrollment],
      createdBy: req.user._id,
    });
    student.studentId = await nextId('STU');
    await student.save();
  }

  const before = lead.toObject();
  lead.pipelineStage = 'Active';
  lead.conversionStatus = 'Converted';
  lead.paymentStatus = student.paymentStatus;
  lead.convertedAt = new Date();
  lead.updatedBy = req.user._id;
  await lead.save();

  await logActivity({
    entity: 'Lead', doc: lead, action: 'convert', user: req.user, before, fields: TRACKED,
    summary: `Converted to student ${student.studentId} (${enrollment.subject})`,
  });

  res.status(201).json({ success: true, data: { lead, student } });
});

export const bulkUpdate = asyncHandler(async (req, res) => {
  const { ids = [], patch = {} } = req.body;
  if (!ids.length) throw ApiError.badRequest('Select at least one lead');
  const allowed = ['pipelineStage', 'leadOwner', 'priority', 'nextFollowUp', 'nextAction', 'trialStatus'];
  const update = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(update).length) throw ApiError.badRequest('Nothing to update');

  const result = await Lead.updateMany({ _id: { $in: ids } }, { $set: { ...update, updatedBy: req.user._id } });
  res.json({ success: true, message: `${result.modifiedCount} lead(s) updated` });
});

export const exportLeads = asyncHandler(async (req, res) => {
  const { filter, sort } = buildListQuery({ ...req.query, limit: 5000 }, LIST_OPTS);
  applyViewFilter(filter, req.query.view);
  const rows = await Lead.find(filter).sort(sort).limit(5000);

  const csv = toCSV(rows, [
    { label: 'Lead ID', key: 'leadId' },
    { label: 'Date Received', key: 'dateReceived' },
    { label: 'Student / Parent', value: (r) => [r.studentName, r.parentName].filter(Boolean).join(' / ') },
    { label: 'Phone / Contact', value: (r) => [r.phone, r.email].filter(Boolean).join(' | ') },
    { label: 'Lead Source', key: 'leadSource' },
    { label: 'Grade / Level', key: 'gradeLevel' },
    { label: 'Subject / Need', value: (r) => [r.subject, r.needSummary].filter(Boolean).join(' — ') },
    { label: 'Lead Owner', key: 'leadOwner' },
    { label: 'Priority', key: 'priority' },
    { label: 'Pipeline Stage', key: 'pipelineStage' },
    { label: 'Last Contact Date', key: 'lastContactDate' },
    { label: 'Days Since Contact', value: (r) => r.daysSinceContact },
    { label: 'Next Action', key: 'nextAction' },
    { label: 'Next Follow-up', key: 'nextFollowUp' },
    { label: 'Follow-up Status', value: (r) => computeFollowUpStatus(r.nextFollowUp) },
    { label: 'Trial Status', key: 'trialStatus' },
    { label: 'Trial Date & Time', key: 'trialDateTime' },
    { label: 'Assigned Tutor', key: 'assignedTutor' },
    { label: 'Conversion Status', key: 'conversionStatus' },
    { label: 'Expected Revenue (USD)', key: 'expectedRevenue' },
    { label: 'Payment Status', key: 'paymentStatus' },
    { label: 'Notes', key: 'notes' },
  ]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tutwithus-master-pipeline.csv"');
  res.send(csv);
});
