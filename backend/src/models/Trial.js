import mongoose from 'mongoose';
import { SESSION_STATUSES, TRIAL_OUTCOMES, LEAD_OWNERS } from '../config/constants.js';

/** Trial Sessions tab — scheduling, delivery, quality review and post-trial conversion. */
const trialSchema = new mongoose.Schema(
  {
    trialId: { type: String, unique: true, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    leadId: { type: String, index: true },
    studentName: { type: String, required: true, trim: true },
    subject: { type: String, trim: true },
    tutor: { type: String, trim: true },
    scheduledDate: { type: Date, required: true, index: true },
    startTime: { type: String, trim: true },        // "17:30"
    durationMinutes: { type: Number, default: 45, min: 5, max: 300 },
    sessionStatus: { type: String, enum: SESSION_STATUSES, default: 'Scheduled', index: true },
    adminReviewer: { type: String, trim: true },
    tutorFeedback: { type: String, trim: true },
    clientFeedback: { type: String, trim: true },
    strongPoints: { type: String, trim: true },
    areasToImprove: { type: String, trim: true },
    commercialFollowUpOwner: { type: String, enum: [...LEAD_OWNERS, ''], default: '' },
    followUpDeadline: Date,
    outcome: { type: String, enum: TRIAL_OUTCOMES, default: 'Pending Review' },
    nextStep: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

trialSchema.index({ studentName: 'text', tutor: 'text', subject: 'text' });

/**
 * Operating rule 4: once a trial is Completed, feedback must exist and a commercial
 * follow-up must be scheduled within 24 hours.
 */
trialSchema.virtual('feedbackOverdue').get(function () {
  if (this.sessionStatus !== 'Completed') return false;
  const hasFeedback = Boolean(this.tutorFeedback && this.commercialFollowUpOwner);
  if (hasFeedback) return false;
  const completedAt = this.scheduledDate || this.updatedAt;
  return Date.now() - new Date(completedAt).getTime() > 24 * 3600 * 1000;
});

export const Trial = mongoose.model('Trial', trialSchema);
