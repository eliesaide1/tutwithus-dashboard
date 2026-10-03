import mongoose from 'mongoose';
import {
  FOLLOWUP_ACTION_TYPES,
  FOLLOWUP_ACTION_STATUSES,
  PRIORITIES,
  LEAD_OWNERS,
} from '../config/constants.js';
import { computeFollowUpStatus } from '../utils/dates.js';

/** Follow-up Action Board — every open opportunity must have a next step. */
const followupSchema = new mongoose.Schema(
  {
    actionId: { type: String, unique: true, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    leadId: { type: String, index: true },
    contactName: { type: String, required: true, trim: true },  // Student / Parent
    owner: { type: String, enum: LEAD_OWNERS, default: 'Other', index: true },
    actionType: { type: String, enum: FOLLOWUP_ACTION_TYPES, default: 'Call' },
    dueDate: { type: Date, required: true, index: true },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    status: { type: String, enum: FOLLOWUP_ACTION_STATUSES, default: 'Open', index: true },
    lastAttempt: Date,
    attempts: { type: Number, default: 0, min: 0 },
    result: { type: String, trim: true },
    nextAction: { type: String, trim: true },
    completedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

followupSchema.index({ contactName: 'text', result: 'text', nextAction: 'text' });

followupSchema.virtual('dueStatus').get(function () {
  if (['Completed', 'Cancelled'].includes(this.status)) return 'Scheduled';
  return computeFollowUpStatus(this.dueDate);
});

followupSchema.virtual('isOverdue').get(function () {
  return this.dueStatus === 'Overdue';
});

followupSchema.pre('save', function stampCompletion(next) {
  if (this.isModified('status')) {
    if (this.status === 'Completed' && !this.completedAt) this.completedAt = new Date();
    if (this.status !== 'Completed') this.completedAt = undefined;
  }
  next();
});

export const Followup = mongoose.model('Followup', followupSchema);
