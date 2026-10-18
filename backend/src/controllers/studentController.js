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

export const enrollmentSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
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
  notes: z.string().optional(),
});

export const studentSchema = z.object({
  lead: z.string().optional(),
  name: z.string().min(2, 'Student name is required'),
  parentName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  gradeLevel: z.enum([...GRADE_LEVELS, '']).optional(),
  clientNotes: z.string().optional(),
  enrollments: z.array(enrollmentSchema).optional(),
}).passthrough();

export const studentUpdateSchema = studentSchema.partial();

/** Same person? Phone is the reliable signal; fall back to an exact name match. */
function duplicateQuery({ phone, name }) {
  const clauses = [];
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 7) clauses.push({ phone: new RegExp(`${digits.slice(-9)}$`) });
  if (name) clauses.push({ name: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  return clauses.length ? { $or: clauses } : null;
}

const SEARCH_FIELDS = ['name', 'parentName', 'studentId', 'leadId', 'enrollments.tutor', 'enrollments.subject'];

/** Subject/tutor/payment/renewal now live inside enrollments, so map them there. */
const ENROLLMENT_FILTERS = {
  subject: 'enrollments.subject',
  tutor: 'enrollments.tutor',
  paymentStatus: 'enrollments.paymentStatus',
  renewalStatus: 'enrollments.renewalStatus',
};

function applyFilters(filter, query) {
  for (const [param, path] of Object.entries(ENROLLMENT_FILTERS)) {
    const value = query[param];
    if (value && value !== 'all') filter[path] = value;
  }
  if (query.gradeLevel && query.gradeLevel !== 'all') filter.gradeLevel = query.gradeLevel;
  if (query.status && query.status !== 'all') filter.status = query.status;
  return filter;
}

function applyViewFilter(filter, view) {
  const now = new Date();
  switch (view) {
    case 'active':
      filter.status = 'Active';
      break;
    case 'renewals':
      filter.enrollments = {
        $elemMatch: {
          status: 'Active',
          $or: [
            { renewalStatus: { $in: ['Due Soon', 'In Discussion'] } },
            { renewalDate: { $lte: endOfDay(addDays(now, 14)) } },
          ],
        },
      };
      break;
    case 'payment-due':
      filter.enrollments = {
        $elemMatch: { paymentStatus: { $in: ['Pending', 'Invoice Sent', 'Partially Paid', 'Overdue'] } },
      };
      break;
    case 'sessions-today':
      filter.enrollments = {
        $elemMatch: { nextSession: { $gte: startOfDay(now), $lte: endOfDay(now) } },
      };
      break;
    default:
      break;
  }
  return filter;
}

export const listStudents = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildListQuery(req.query, {
    filterable: [],
    searchFields: SEARCH_FIELDS,
    dateField: 'createdAt',
    defaultSort: '-createdAt',
  });
  applyFilters(filter, req.query);
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
  const { enrollments = [], ...person } = req.body;

  // Guard against the duplicate-person problem: same human, new subject.
  const dupeQuery = duplicateQuery(person);
  if (dupeQuery && !req.query.force) {
    const existing = await Student.findOne(dupeQuery);
    if (existing) {
      throw ApiError.conflict(
        `${existing.name} already exists as ${existing.studentId}. Add the subject to that student instead, or retry with ?force=1 to create a separate record.`,
      );
    }
  }

  const student = new Student({ ...person, enrollments, createdBy: req.user._id, updatedBy: req.user._id });
  if (person.lead) {
    const lead = await Lead.findById(person.lead);
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
  // Enrollments are edited through their own endpoints, never wholesale here.
  const { enrollments, ...person } = req.body;
  Object.assign(student, person, { updatedBy: req.user._id });
  await student.save();

  await logActivity({
    entity: 'Student', doc: student, action: 'update', user: req.user, before,
    fields: ['name', 'parentName', 'phone', 'email', 'gradeLevel', 'status'],
    summary: 'Student record updated',
  });
  res.json({ success: true, data: student });
});

/* ------------------------------- enrollments ------------------------------ */

export const addEnrollment = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');

  const exists = student.enrollments.find(
    (e) => e.subject.toLowerCase() === String(req.body.subject || '').toLowerCase() && e.status === 'Active',
  );
  if (exists) throw ApiError.conflict(`${student.name} already has an active ${exists.subject} enrollment`);

  student.enrollments.push(req.body);
  student.updatedBy = req.user._id;
  await student.save();

  await logActivity({
    entity: 'Student', doc: student, action: 'update', user: req.user,
    summary: `Added ${req.body.subject} enrollment`,
  });
  res.status(201).json({ success: true, data: student });
});

export const updateEnrollment = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');
  const enrollment = student.enrollments.id(req.params.enrollmentId);
  if (!enrollment) throw ApiError.notFound('Enrollment not found');

  Object.assign(enrollment, req.body);
  student.updatedBy = req.user._id;
  await student.save();
  res.json({ success: true, data: student });
});

export const removeEnrollment = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');
  const enrollment = student.enrollments.id(req.params.enrollmentId);
  if (!enrollment) throw ApiError.notFound('Enrollment not found');
  if (student.enrollments.length === 1) {
    throw ApiError.badRequest('A student needs at least one subject. Delete the student instead.');
  }
  const { subject } = enrollment;
  enrollment.deleteOne();
  student.updatedBy = req.user._id;
  await student.save();
  await logActivity({ entity: 'Student', doc: student, action: 'update', user: req.user, summary: `Removed ${subject} enrollment` });
  res.json({ success: true, data: student });
});

/** Marks one delivered session on a specific subject. */
export const logSession = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');

  const enrollment = req.params.enrollmentId
    ? student.enrollments.id(req.params.enrollmentId)
    : student.enrollments.find((e) => e.status === 'Active');
  if (!enrollment) throw ApiError.badRequest('Choose which subject the session was for');

  if (enrollment.sessionsPurchased > 0 && enrollment.sessionsUsed >= enrollment.sessionsPurchased) {
    throw ApiError.badRequest(`No sessions remaining on the ${enrollment.subject} package`);
  }
  enrollment.sessionsUsed += 1;
  if (req.body.nextSession) enrollment.nextSession = new Date(req.body.nextSession);
  if (enrollment.sessionsPurchased && enrollment.sessionsRemaining <= 2 && enrollment.renewalStatus === 'Not Due') {
    enrollment.renewalStatus = 'Due Soon';
  }
  student.updatedBy = req.user._id;
  await student.save();
  res.json({ success: true, data: student });
});

/** Adds a new package to one subject and resets its usage. */
export const renewPackage = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');

  const enrollment = req.params.enrollmentId
    ? student.enrollments.id(req.params.enrollmentId)
    : student.enrollments.find((e) => e.status === 'Active');
  if (!enrollment) throw ApiError.badRequest('Choose which subject to renew');

  const { sessionsPurchased, amountPaid, packagePlan, renewalDate, paymentStatus = 'Paid' } = req.body;
  if (!sessionsPurchased) throw ApiError.badRequest('Number of sessions is required');

  enrollment.sessionsPurchased = Number(sessionsPurchased);
  enrollment.sessionsUsed = 0;
  enrollment.amountPaid = (enrollment.amountPaid || 0) + Number(amountPaid || 0);
  if (packagePlan) enrollment.packagePlan = packagePlan;
  enrollment.renewalDate = renewalDate ? new Date(renewalDate) : addDays(new Date(), 90);
  enrollment.renewalStatus = 'Renewed';
  enrollment.paymentStatus = paymentStatus;
  enrollment.status = 'Active';
  student.updatedBy = req.user._id;
  await student.save();

  await logActivity({
    entity: 'Student', doc: student, action: 'update', user: req.user,
    summary: `Renewed ${enrollment.subject} (${sessionsPurchased} sessions)`,
  });
  res.json({ success: true, data: student });
});

/** Folds one student record into another — the fix for duplicates already created. */
export const mergeStudents = asyncHandler(async (req, res) => {
  const target = await Student.findById(req.params.id);
  if (!target) throw ApiError.notFound('Student not found');
  const source = await Student.findById(req.body.sourceId);
  if (!source) throw ApiError.notFound('The student to merge from was not found');
  if (String(source._id) === String(target._id)) throw ApiError.badRequest('Cannot merge a student into themselves');

  target.enrollments.push(...source.enrollments.map((e) => e.toObject()));
  target.parentName = target.parentName || source.parentName;
  target.phone = target.phone || source.phone;
  target.email = target.email || source.email;
  target.gradeLevel = target.gradeLevel || source.gradeLevel;
  target.clientNotes = [target.clientNotes, source.clientNotes].filter(Boolean).join('\n');
  target.updatedBy = req.user._id;
  await target.save();
  await Student.deleteOne({ _id: source._id });

  await logActivity({
    entity: 'Student', doc: target, action: 'update', user: req.user,
    summary: `Merged ${source.studentId} into ${target.studentId}`,
  });
  res.json({ success: true, data: target });
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');
  res.json({ success: true, message: 'Student removed' });
});

/** CSV keeps one row per subject, matching how the workbook listed them. */
export const exportStudents = asyncHandler(async (req, res) => {
  const { filter, sort } = buildListQuery(req.query, { filterable: [], searchFields: SEARCH_FIELDS, defaultSort: '-createdAt' });
  applyFilters(filter, req.query);
  applyViewFilter(filter, req.query.view);
  const students = await Student.find(filter).sort(sort).limit(5000);

  const rows = [];
  for (const s of students) {
    const list = s.enrollments.length ? s.enrollments : [{}];
    for (const e of list) rows.push({ s, e });
  }

  const csv = toCSV(rows, [
    { label: 'Student ID', value: (r) => r.s.studentId },
    { label: 'Lead ID', value: (r) => r.e.leadId || r.s.leadId },
    { label: 'Student', value: (r) => r.s.name },
    { label: 'Parent', value: (r) => r.s.parentName },
    { label: 'Phone', value: (r) => r.s.phone },
    { label: 'Grade / Level', value: (r) => r.s.gradeLevel },
    { label: 'Subject', value: (r) => r.e.subject },
    { label: 'Tutor', value: (r) => r.e.tutor },
    { label: 'Start Date', value: (r) => r.e.startDate },
    { label: 'Package / Plan', value: (r) => r.e.packagePlan },
    { label: 'Sessions Purchased', value: (r) => r.e.sessionsPurchased },
    { label: 'Sessions Used', value: (r) => r.e.sessionsUsed },
    { label: 'Sessions Remaining', value: (r) => (r.e.sessionsPurchased || 0) - (r.e.sessionsUsed || 0) },
    { label: 'Amount Paid (USD)', value: (r) => r.e.amountPaid },
    { label: 'Payment Status', value: (r) => r.e.paymentStatus },
    { label: 'Next Session', value: (r) => r.e.nextSession },
    { label: 'Renewal Status', value: (r) => r.e.renewalStatus },
    { label: 'Status', value: (r) => r.e.status },
    { label: 'Client Notes', value: (r) => r.s.clientNotes },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tutwithus-active-students.csv"');
  res.send(csv);
});
