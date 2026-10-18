import mongoose from 'mongoose';
import {
  PAYMENT_STATUSES,
  RENEWAL_STATUSES,
  STUDENT_STATUSES,
  GRADE_LEVELS,
} from '../config/constants.js';
import { daysBetween } from '../utils/dates.js';

/**
 * One subject a student is enrolled in. A student can hold several of these
 * at once — Maths with one tutor, Chemistry with another — each carrying its
 * own package, session count, payment and renewal.
 */
const enrollmentSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    tutor: { type: String, trim: true },
    startDate: { type: Date, default: Date.now },
    packagePlan: { type: String, trim: true },
    sessionsPurchased: { type: Number, default: 0, min: 0 },
    sessionsUsed: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Paid' },
    nextSession: Date,
    renewalDate: Date,
    renewalStatus: { type: String, enum: RENEWAL_STATUSES, default: 'Not Due' },
    status: { type: String, enum: STUDENT_STATUSES, default: 'Active' },
    notes: { type: String, trim: true },
    /** The lead this particular subject came from, when it came from one. */
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    leadId: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

enrollmentSchema.virtual('sessionsRemaining').get(function () {
  return Math.max(0, (this.sessionsPurchased || 0) - (this.sessionsUsed || 0));
});

enrollmentSchema.virtual('usagePercent').get(function () {
  if (!this.sessionsPurchased) return 0;
  return Math.min(100, Math.round(((this.sessionsUsed || 0) / this.sessionsPurchased) * 100));
});

enrollmentSchema.virtual('renewalDueSoon').get(function () {
  if (this.status !== 'Active') return false;
  if (this.sessionsPurchased && this.sessionsRemaining <= 2) return true;
  if (!this.renewalDate) return false;
  const diff = daysBetween(new Date(), this.renewalDate);
  return diff !== null && diff <= 14;
});

/**
 * Active Students & Retention — one document per *person*.
 * The subjects they study live in `enrollments`.
 */
const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, unique: true, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    leadId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    parentName: { type: String, trim: true },
    phone: { type: String, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    gradeLevel: { type: String, enum: [...GRADE_LEVELS, ''], default: '' },

    enrollments: { type: [enrollmentSchema], default: [] },

    /** Denormalised from the enrollments so list queries stay simple. */
    status: { type: String, enum: STUDENT_STATUSES, default: 'Active', index: true },
    clientNotes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

studentSchema.index({ name: 'text', parentName: 'text', 'enrollments.tutor': 'text', 'enrollments.subject': 'text' });

/* ---- totals across every subject, so the table can show one line per person ---- */

const sum = (list, key) => list.reduce((total, e) => total + (e[key] || 0), 0);

studentSchema.virtual('sessionsPurchased').get(function () { return sum(this.enrollments || [], 'sessionsPurchased'); });
studentSchema.virtual('sessionsUsed').get(function () { return sum(this.enrollments || [], 'sessionsUsed'); });
studentSchema.virtual('amountPaid').get(function () { return sum(this.enrollments || [], 'amountPaid'); });
studentSchema.virtual('sessionsRemaining').get(function () {
  return Math.max(0, this.sessionsPurchased - this.sessionsUsed);
});
studentSchema.virtual('subjectCount').get(function () { return (this.enrollments || []).length; });
studentSchema.virtual('subjects').get(function () {
  return [...new Set((this.enrollments || []).map((e) => e.subject).filter(Boolean))];
});
studentSchema.virtual('tutors').get(function () {
  return [...new Set((this.enrollments || []).map((e) => e.tutor).filter(Boolean))];
});

/** Soonest upcoming session across all subjects. */
studentSchema.virtual('nextSession').get(function () {
  const dates = (this.enrollments || []).map((e) => e.nextSession).filter(Boolean).sort((a, b) => a - b);
  return dates[0] || null;
});

studentSchema.virtual('renewalDueSoon').get(function () {
  return (this.enrollments || []).some((e) => e.renewalDueSoon);
});

/** Worst payment state wins, so nothing outstanding hides behind a paid subject. */
studentSchema.virtual('paymentStatus').get(function () {
  const order = ['Overdue', 'Partially Paid', 'Invoice Sent', 'Pending', 'Paid', 'Not Applicable'];
  const found = (this.enrollments || []).map((e) => e.paymentStatus);
  return order.find((s) => found.includes(s)) || 'Not Applicable';
});

studentSchema.virtual('renewalStatus').get(function () {
  const order = ['Churned', 'Due Soon', 'In Discussion', 'Paused', 'Renewed', 'Not Due'];
  const found = (this.enrollments || []).map((e) => e.renewalStatus);
  return order.find((s) => found.includes(s)) || 'Not Due';
});

/** A person is active while any of their subjects is. */
studentSchema.pre('save', function syncStatus(next) {
  const list = this.enrollments || [];
  if (list.length) {
    if (list.some((e) => e.status === 'Active')) this.status = 'Active';
    else if (list.some((e) => e.status === 'On Hold')) this.status = 'On Hold';
    else if (list.every((e) => e.status === 'Churned')) this.status = 'Churned';
    else this.status = 'Completed';
  }
  next();
});

export const Student = mongoose.model('Student', studentSchema);
