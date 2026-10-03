import mongoose from 'mongoose';
import {
  PAYMENT_STATUSES,
  RENEWAL_STATUSES,
  STUDENT_STATUSES,
  GRADE_LEVELS,
} from '../config/constants.js';
import { daysBetween } from '../utils/dates.js';

/** Active Students & Retention — post-conversion operations. */
const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, unique: true, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    leadId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    parentName: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gradeLevel: { type: String, enum: [...GRADE_LEVELS, ''], default: '' },
    subject: { type: String, trim: true },
    tutor: { type: String, trim: true },
    startDate: { type: Date, default: Date.now },
    packagePlan: { type: String, trim: true },
    sessionsPurchased: { type: Number, default: 0, min: 0 },
    sessionsUsed: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Paid' },
    nextSession: Date,
    renewalDate: Date,
    renewalStatus: { type: String, enum: RENEWAL_STATUSES, default: 'Not Due', index: true },
    status: { type: String, enum: STUDENT_STATUSES, default: 'Active', index: true },
    clientNotes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

studentSchema.index({ name: 'text', parentName: 'text', tutor: 'text', subject: 'text' });

studentSchema.virtual('sessionsRemaining').get(function () {
  return Math.max(0, (this.sessionsPurchased || 0) - (this.sessionsUsed || 0));
});

studentSchema.virtual('usagePercent').get(function () {
  if (!this.sessionsPurchased) return 0;
  return Math.min(100, Math.round(((this.sessionsUsed || 0) / this.sessionsPurchased) * 100));
});

/** Renewal is "soon" when ≤ 2 sessions remain or the renewal date is within 14 days. */
studentSchema.virtual('renewalDueSoon').get(function () {
  if (this.status !== 'Active') return false;
  if (this.sessionsPurchased && this.sessionsRemaining <= 2) return true;
  if (!this.renewalDate) return false;
  const diff = daysBetween(new Date(), this.renewalDate);
  return diff !== null && diff <= 14;
});

export const Student = mongoose.model('Student', studentSchema);
