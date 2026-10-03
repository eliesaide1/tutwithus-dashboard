import mongoose from 'mongoose';

/** Audit trail: who changed what, so stage movements can be reviewed later. */
const activityLogSchema = new mongoose.Schema(
  {
    entity: { type: String, enum: ['Lead', 'Trial', 'Followup', 'Student', 'WeeklyReport', 'User'], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    reference: String,           // LEAD-0012
    action: { type: String, enum: ['create', 'update', 'delete', 'stage-change', 'convert'], required: true },
    summary: String,
    changes: [{ field: String, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed }],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activityLogSchema.index({ createdAt: -1 });

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

/** Diffs a document against an update payload and records only real changes. */
export async function logActivity({ entity, doc, action, user, before, fields = [], summary }) {
  const changes = [];
  if (before) {
    for (const field of fields) {
      const from = before[field];
      const to = doc[field];
      const same = from instanceof Date && to instanceof Date
        ? from.getTime() === to.getTime()
        : String(from ?? '') === String(to ?? '');
      if (!same) changes.push({ field, from, to });
    }
    if (!changes.length && action === 'update') return null;
  }
  return ActivityLog.create({
    entity,
    entityId: doc._id,
    reference: doc.leadId || doc.trialId || doc.actionId || doc.studentId || doc.weekKey,
    action,
    summary,
    changes,
    user: user?._id,
    userName: user?.name,
  });
}
