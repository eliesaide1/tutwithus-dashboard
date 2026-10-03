import mongoose from 'mongoose';
import {
  PIPELINE_STAGES,
  LEAD_SOURCES,
  PRIORITIES,
  LEAD_OWNERS,
  TRIAL_STATUSES,
  CONVERSION_STATUSES,
  PAYMENT_STATUSES,
  LOSS_REASONS,
  GRADE_LEVELS,
} from '../config/constants.js';
import { computeFollowUpStatus, daysBetween } from '../utils/dates.js';

/**
 * Master Pipeline — one row per prospective student/client.
 * Column order mirrors tab 2 of the workbook (A → V).
 */
const leadSchema = new mongoose.Schema(
  {
    leadId: { type: String, unique: true, index: true },            // A
    dateReceived: { type: Date, default: Date.now, index: true },   // B
    studentName: { type: String, required: true, trim: true },      // C
    parentName: { type: String, trim: true },
    phone: { type: String, trim: true },                            // D
    email: { type: String, trim: true, lowercase: true },
    leadSource: { type: String, enum: LEAD_SOURCES, default: 'Other' },   // E
    gradeLevel: { type: String, enum: [...GRADE_LEVELS, ''], default: '' }, // F
    subject: { type: String, trim: true },                          // G
    needSummary: { type: String, trim: true },
    leadOwner: { type: String, enum: LEAD_OWNERS, default: 'Other' },// H
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },// I
    pipelineStage: { type: String, enum: PIPELINE_STAGES, default: 'New Lead', index: true }, // J
    lastContactDate: Date,                                          // K
    // L (Days Since Contact) is a virtual — never stored.
    nextAction: { type: String, trim: true },                       // M
    nextFollowUp: { type: Date, index: true },                      // N
    // O (Follow-up Status) is a virtual — never stored.
    trialStatus: { type: String, enum: TRIAL_STATUSES, default: 'To Schedule' }, // P
    trialDateTime: Date,                                            // Q
    assignedTutor: { type: String, trim: true },                    // R
    conversionStatus: { type: String, enum: CONVERSION_STATUSES, default: 'Not Started' }, // S
    expectedRevenue: { type: Number, default: 0, min: 0 },          // T
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Not Applicable' },     // U
    notes: { type: String, trim: true },                            // V

    lossReason: { type: String, enum: [...LOSS_REASONS, ''], default: '' },
    convertedAt: Date,
    lostAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

leadSchema.index({ studentName: 'text', parentName: 'text', phone: 'text', email: 'text', notes: 'text' });
leadSchema.index({ pipelineStage: 1, nextFollowUp: 1 });

/** Column L — Days Since Contact. */
leadSchema.virtual('daysSinceContact').get(function () {
  return this.lastContactDate ? daysBetween(this.lastContactDate, new Date()) : null;
});

/** Column O — Follow-up Status (the "Missing Date" column in the screenshots). */
leadSchema.virtual('followUpStatus').get(function () {
  return computeFollowUpStatus(this.nextFollowUp);
});

leadSchema.virtual('isOpen').get(function () {
  return !['Converted / Paid', 'Active', 'Lost'].includes(this.pipelineStage);
});

/** Operating rule 6: a Lost opportunity must carry a Loss Reason. */
leadSchema.pre('validate', function enforceLossReason(next) {
  if (this.pipelineStage === 'Lost' && !this.lossReason) {
    // invalidate() (not throw) so this surfaces as a 400 field error, not a 500.
    this.invalidate('lossReason', 'A Loss Reason is required when the stage is "Lost".');
  }
  next();
});

leadSchema.pre('save', function stampOutcomes(next) {
  if (this.isModified('pipelineStage')) {
    if (this.pipelineStage === 'Converted / Paid' && !this.convertedAt) this.convertedAt = new Date();
    if (this.pipelineStage === 'Lost' && !this.lostAt) this.lostAt = new Date();
  }
  next();
});

export const Lead = mongoose.model('Lead', leadSchema);
