import { Lead, Trial, Student, WeeklyReport } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { startOfWeek, endOfWeek, isoWeekKey, addDays } from '../utils/dates.js';

const CLOSED = ['Converted / Paid', 'Active', 'Lost'];

/** Operating rule 7 — investor numbers are always recomputed from the live pipeline. */
async function computeSnapshot(weekStart, weekEnd) {
  const range = { $gte: weekStart, $lte: weekEnd };
  const [newLeads, trialsScheduled, trialsCompleted, convertedPaid, openOpportunities, pipelineValueAgg, revenueAgg] =
    await Promise.all([
      Lead.countDocuments({ dateReceived: range }),
      Trial.countDocuments({ createdAt: range }),
      Trial.countDocuments({ scheduledDate: range, sessionStatus: 'Completed' }),
      Lead.countDocuments({ convertedAt: range }),
      Lead.countDocuments({ pipelineStage: { $nin: CLOSED } }),
      Lead.aggregate([
        { $match: { pipelineStage: { $nin: CLOSED } } },
        { $group: { _id: null, total: { $sum: '$expectedRevenue' } } },
      ]),
      Student.aggregate([
        { $match: { createdAt: range } },
        { $unwind: { path: '$enrollments', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, total: { $sum: '$enrollments.amountPaid' } } },
      ]),
    ]);

  return {
    newLeads,
    trialsScheduled,
    trialsCompleted,
    convertedPaid,
    openOpportunities,
    pipelineValue: Math.round(pipelineValueAgg[0]?.total || 0),
    revenueCollected: Math.round(revenueAgg[0]?.total || 0),
    conversionRate: newLeads ? Math.round((convertedPaid / newLeads) * 100) : 0,
  };
}

/** GET /api/reports/weekly?week=2026-W40 — live snapshot + saved commentary. */
export const getWeeklyReport = asyncHandler(async (req, res) => {
  const reference = req.query.week ? weekKeyToDate(req.query.week) : new Date();
  const weekStart = startOfWeek(reference);
  const weekEnd = endOfWeek(reference);
  const weekKey = isoWeekKey(reference);

  const [snapshot, saved] = await Promise.all([
    computeSnapshot(weekStart, weekEnd),
    WeeklyReport.findOne({ weekKey }).populate('preparedBy', 'name'),
  ]);

  const [trialsNextWeek, topOpportunities] = await Promise.all([
    Trial.find({
      scheduledDate: { $gte: addDays(weekEnd, 1), $lte: addDays(weekEnd, 7) },
      sessionStatus: 'Scheduled',
    }).sort('scheduledDate').limit(20),
    Lead.find({ pipelineStage: { $nin: CLOSED } }).sort('-expectedRevenue').limit(10),
  ]);

  res.json({
    success: true,
    data: {
      weekKey,
      weekStart,
      weekEnd,
      snapshot,
      commentary: saved?.commentary || {
        strongestOpportunities: '', trialsNextWeek: '', conversionsExpected: '', mainSalesActions: '', risksBlockers: '',
      },
      status: saved?.status || 'Draft',
      preparedBy: saved?.preparedBy || null,
      updatedAt: saved?.updatedAt || null,
      helpers: { trialsNextWeek, topOpportunities },
      sendingCadence: 'Friday, after the final daily pipeline update.',
    },
  });
});

/** PUT /api/reports/weekly/:weekKey — save management commentary (numbers stay live). */
export const saveWeeklyReport = asyncHandler(async (req, res) => {
  const { weekKey } = req.params;
  const reference = weekKeyToDate(weekKey);
  const weekStart = startOfWeek(reference);
  const weekEnd = endOfWeek(reference);
  const snapshot = await computeSnapshot(weekStart, weekEnd);

  const report = await WeeklyReport.findOneAndUpdate(
    { weekKey },
    {
      $set: {
        weekStart,
        weekEnd,
        snapshot,
        commentary: req.body.commentary || {},
        status: req.body.status || 'Draft',
        preparedBy: req.user._id,
        ...(req.body.status === 'Finalised' ? { finalisedAt: new Date() } : {}),
        ...(req.body.status === 'Sent' ? { sentAt: new Date() } : {}),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  res.json({ success: true, data: report });
});

export const listWeeklyReports = asyncHandler(async (_req, res) => {
  const reports = await WeeklyReport.find().sort('-weekStart').limit(52).populate('preparedBy', 'name');
  res.json({ success: true, data: reports });
});

/** GET /api/reports/weekly/:weekKey/export — plain-text block ready to paste into email. */
export const exportWeeklyReport = asyncHandler(async (req, res) => {
  const { weekKey } = req.params;
  const reference = weekKeyToDate(weekKey);
  const weekStart = startOfWeek(reference);
  const weekEnd = endOfWeek(reference);
  const [snapshot, saved] = await Promise.all([
    computeSnapshot(weekStart, weekEnd),
    WeeklyReport.findOne({ weekKey }),
  ]);
  const c = saved?.commentary || {};
  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const text = `TutWithUs | Weekly Investor Pipeline Report
Week ${weekKey}  (${fmt(weekStart)} – ${fmt(weekEnd)})

WEEKLY SNAPSHOT
  New leads this week .......... ${snapshot.newLeads}
  Trials scheduled ............. ${snapshot.trialsScheduled}
  Trials completed ............. ${snapshot.trialsCompleted}
  Converted / Paid ............. ${snapshot.convertedPaid}
  Open opportunities ........... ${snapshot.openOpportunities}
  Pipeline value ............... $${snapshot.pipelineValue.toLocaleString()}
  Revenue collected ............ $${snapshot.revenueCollected.toLocaleString()}
  Conversion rate .............. ${snapshot.conversionRate}%

INVESTOR COMMENTARY
  What we are cooking / strongest opportunities:
    ${c.strongestOpportunities || '—'}
  Trials scheduled for the coming week:
    ${c.trialsNextWeek || '—'}
  Conversions expected / payment pending:
    ${c.conversionsExpected || '—'}
  Main sales actions next week:
    ${c.mainSalesActions || '—'}
  Risks / blockers requiring attention:
    ${c.risksBlockers || '—'}

Generated from the live pipeline on ${fmt(new Date())}.
Recommended sending cadence: Friday after the final daily pipeline update.`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tutwithus-investor-report-${weekKey}.txt"`);
  res.send(text);
});

function weekKeyToDate(key) {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(String(key));
  if (!match) throw ApiError.badRequest('Week must look like 2026-W40');
  const [, year, week] = match;
  const jan4 = new Date(Number(year), 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (Number(week) - 1) * 7);
  return monday;
}
