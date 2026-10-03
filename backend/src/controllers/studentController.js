import { z } from 'zod';
import { Student, Lead, logActivity } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { nextId } from '../utils/sequence.js';
import { buildListQuery, paginated } from '../utils/query.js';
import { toCSV } from '../utils/csv.js';
import { addDays, startOfDay, endOfDay } from '../utils/dates.js';
import {
  PAYMENT_STATUSES, RENEWAL_STATUSES, STUDENT_STATUSES, GRADE_LEVELS,
} from '../config/constants.js';

const optionalDate = z.union([z.coerce.date(), z.literal(''), z.null()]).optional()
  .transform((v) => (v === '' || v === null ? undefined : v));

export const studentSchema = z.object({
  lead: z.string().optional(),
  name: z.string().min(2, 'Student name is required'),
  parentName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  gradeLevel: z.enum([...GRADE_LEVELS, '']).optional(),
  subject: z.string().optional(),
  tutor: z.string().optional(),
  startDate: optionalDate,
  packagePlan: z.string().optional(),
  sessionsPurchased: z.coerce.number().min(0).optional(),
  sessionsUsed: z.coerce.number().min(0).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  nextSession: optionalDate,
  renewalDate: optionalDate,
  renewalStatus: z.enum(RENEWAL_STATUSES).optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  clientNotes: z.string().optional(),
});

export const studentUpdateSchema = studentSchema.partial();

const LIST_OPTS = {
  filterable: ['status', 'renewalStatus', 'paymentStatus', 'tutor', 'subject', 'gradeLevel'],
  searchFields: ['name', 'parentName', 'tutor', 'subject', 'studentId', 'leadId'],
  dateField: 'startDate',
  defaultSort: '-startDate',
};

function applyViewFilter(filter, view) {
  const now = new Date();
  switch (view) {
    case 'active':
      filter.status = 'Active';
      break;
    case 'renewals':
      filter.status = 'Active';
      filter.$or = [
        { renewalStatus: { $in: ['Due Soon', 'In Discussion'] } },
        { renewalDate: { $lte: endOfDay(addDays(now, 14)) } },
      ];
      break;
    case 'payment-due':
      filter.paymentStatus = { $in: ['Pending', 'Invoice Sent', 'Partially Paid', 'Overdue'] };
      break;
    case 'sessions-today':
      filter.nextSession = { $gte: startOfDay(now), $lte: endOfDay(now) };
      break;
    default:
      break;
  }
  return filter;
}

export const listStudents = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildListQuery(req.query, LIST_OPTS);
  applyViewFilter(filter, req.query.view);
  const [items, total] = await Promise.all([
    Student.find(filter).sort(sort).skip(skip).limit(limit),
    Student.countDocuments(filter),
  ]);
  res.json(paginated(items, total, page, limit));
});

export const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('lead', 'leadId pipelineStage leadSource');
  if (!student) throw ApiError.notFound('Student not found');
  res.json({ success: true, data: student });
});

export const createStudent = asyncHandler(async (req, res) => {
  const student = new Student({ ...req.body, createdBy: req.user._id, updatedBy: req.user._id });
  if (req.body.lead) {
    const lead = await Lead.findById(req.body.lead);
    if (lead) student.leadId = lead.leadId;
  }
  student.studentId = await nextId('STU');
  await student.save();
  await logActivity({ entity: 'Student', doc: student, action: 'create', user: req.user, summary: `Student ${student.name} activated` });
  res.status(201).json({ success: true, data: student });
});

export const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');
  const before = student.toObject();
  Object.assign(student, req.body, { updatedBy: req.user._id });
  await student.save();

  if (student.status === 'Churned' && before.status !== 'Churned') {
    const lead = await Lead.findById(student.lead);
    if (lead) { lead.pipelineStage = 'Lost'; lead.lossReason = lead.lossReason || 'No Longer Needed'; await lead.save(); }
  }

  await logActivity({
    entity: 'Student', doc: student, action: 'update', user: req.user, before,
    fields: ['status', 'renewalStatus', 'paymentStatus', 'tutor', 'sessionsUsed', 'sessionsPurchased', 'amountPaid'],
    summary: 'Student record updated',
  });
  res.json({ success: true, data: student });
});

/** Marks one session as delivered and rolls the renewal flag when the package runs low. */
export const logSession = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');
  if (student.sessionsUsed >= student.sessionsPurchased && student.sessionsPurchased > 0) {
    throw ApiError.badRequest('No sessions remaining on this package');
  }
  student.sessionsUsed += 1;
  if (req.body.nextSession) student.nextSession = new Date(req.body.nextSession);
  if (student.sessionsPurchased && student.sessionsRemaining <= 2 && student.renewalStatus === 'Not Due') {
    student.renewalStatus = 'Due Soon';
  }
  student.updatedBy = req.user._id;
  await student.save();
  res.json({ success: true, data: student });
});

/** Adds a new package on renewal and resets usage. */
export const renewPackage = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');
  const { sessionsPurchased, amountPaid, packagePlan, renewalDate, paymentStatus = 'Paid' } = req.body;
  if (!sessionsPurchased) throw ApiError.badRequest('Number of sessions is required');

  student.sessionsPurchased = Number(sessionsPurchased);
  student.sessionsUsed = 0;
  student.amountPaid = (student.amountPaid || 0) + Number(amountPaid || 0);
  if (packagePlan) student.packagePlan = packagePlan;
  student.renewalDate = renewalDate ? new Date(renewalDate) : addDays(new Date(), 90);
  student.renewalStatus = 'Renewed';
  student.paymentStatus = paymentStatus;
  student.status = 'Active';
  student.updatedBy = req.user._id;
  await student.save();

  await logActivity({ entity: 'Student', doc: student, action: 'update', user: req.user, summary: `Package renewed (${sessionsPurchased} sessions)` });
  res.json({ success: true, data: student });
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');
  res.json({ success: true, message: 'Student removed' });
});

export const exportStudents = asyncHandler(async (req, res) => {
  const { filter, sort } = buildListQuery(req.query, LIST_OPTS);
  applyViewFilter(filter, req.query.view);
  const rows = await Student.find(filter).sort(sort).limit(5000);
  const csv = toCSV(rows, [
    { label: 'Student ID', key: 'studentId' },
    { label: 'Lead ID', key: 'leadId' },
    { label: 'Student', key: 'name' },
    { label: 'Grade / Level', key: 'gradeLevel' },
    { label: 'Subject', key: 'subject' },
    { label: 'Tutor', key: 'tutor' },
    { label: 'Start Date', key: 'startDate' },
    { label: 'Package / Plan', key: 'packagePlan' },
    { label: 'Sessions Purchased', key: 'sessionsPurchased' },
    { label: 'Sessions Used', key: 'sessionsUsed' },
    { label: 'Sessions Remaining', value: (r) => r.sessionsRemaining },
    { label: 'Amount Paid (USD)', key: 'amountPaid' },
    { label: 'Payment Status', key: 'paymentStatus' },
    { label: 'Next Session', key: 'nextSession' },
    { label: 'Renewal Status', key: 'renewalStatus' },
    { label: 'Client Notes', key: 'clientNotes' },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tutwithus-active-students.csv"');
  res.send(csv);
});
