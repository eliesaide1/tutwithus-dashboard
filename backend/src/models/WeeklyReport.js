import mongoose from 'mongoose';

/**
 * Weekly Investor Pipeline Report — the numbers are recomputed live from the
 * pipeline (operating rule 7); only the management commentary is stored.
 */
const weeklyReportSchema = new mongoose.Schema(
  {
    weekKey: { type: String, required: true, unique: true, index: true }, // 2026-W40
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    snapshot: {
      newLeads: Number,
      trialsScheduled: Number,
      trialsCompleted: Number,
      convertedPaid: Number,
      openOpportunities: Number,
      pipelineValue: Number,
      revenueCollected: Number,
      conversionRate: Number,
    },
    commentary: {
      strongestOpportunities: { type: String, default: '' },
      trialsNextWeek: { type: String, default: '' },
      conversionsExpected: { type: String, default: '' },
      mainSalesActions: { type: String, default: '' },
      risksBlockers: { type: String, default: '' },
    },
    status: { type: String, enum: ['Draft', 'Finalised', 'Sent'], default: 'Draft' },
    finalisedAt: Date,
    sentAt: Date,
    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

export const WeeklyReport = mongoose.model('WeeklyReport', weeklyReportSchema);
