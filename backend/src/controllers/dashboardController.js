import { Lead, Trial, Followup, Student, ActivityLog } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  startOfDay, endOfDay, addDays, startOfWeek, endOfWeek,
} from '../utils/dates.js';
import { PIPELINE_STAGES, OPEN_STAGES, LEAD_SOURCES, LEAD_OWNERS } from '../config/constants.js';

const CLOSED = ['Converted / Paid', 'Active', 'Lost'];
const OPEN_ACTION = { $in: ['Open', 'In Progress', 'No Answer', 'Rescheduled'] };

/**
 * GET /api/dashboard
 * Reproduces the workbook's Dashboard tab: Live Pipeline KPIs,
 * Pipeline by Stage and Management Attention — all computed live.
 */
export const getDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const next7 = endOfDay(addDays(now, 7));

  // Period for the "this period" comparisons — defaults to the last 30 days.
  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
  const periodStart = startOfDay(addDays(now, -days + 1));
  const prevStart = startOfDay(addDays(periodStart, -days));
  const prevEnd = endOfDay(addDays(periodStart, -1));

  const [
    newLeads, qualified, trialsScheduled, trialsCompleted, convertedPaid, activeStudents,
    overdueFollowups, pipelineValueAgg,
    stageCounts,
    dueToday, overdue, missingDate, trialsToday, trialsNext7, pendingPayments, renewalsSoon,
    leadsThisPeriod, leadsPrevPeriod, convertedThisPeriod, convertedPrevPeriod,
    sourceBreakdown, ownerBreakdown, lossReasons, revenueAgg, weeklyTrend,
    recentActivity,
  ] = await Promise.all([
    Lead.countDocuments({ pipelineStage: 'New Lead' }),
    Lead.countDocuments({ pipelineStage: 'Qualified' }),
    Lead.countDocuments({ trialStatus: 'Scheduled' }),
    Lead.countDocuments({ trialStatus: 'Completed' }),
    Lead.countDocuments({ pipelineStage: { $in: ['Converted / Paid', 'Active'] } }),
    Student.countDocuments({ status: 'Active' }),
    Followup.countDocuments({ dueDate: { $lt: todayStart }, status: OPEN_ACTION }),
    Lead.aggregate([
      { $match: { pipelineStage: { $nin: CLOSED } } },
      { $group: { _id: null, total: { $sum: '$expectedRevenue' } } },
    ]),

    Lead.aggregate([{ $group: { _id: '$pipelineStage', count: { $sum: 1 }, value: { $sum: '$expectedRevenue' } } }]),

    Followup.countDocuments({ dueDate: { $gte: todayStart, $lte: todayEnd }, status: OPEN_ACTION }),
    Followup.countDocuments({ dueDate: { $lt: todayStart }, status: OPEN_ACTION }),
    Lead.countDocuments({ pipelineStage: { $nin: CLOSED }, $or: [{ nextFollowUp: null }, { nextFollowUp: { $exists: false } }] }),
    Trial.countDocuments({ scheduledDate: { $gte: todayStart, $lte: todayEnd }, sessionStatus: { $ne: 'Cancelled' } }),
    Trial.countDocuments({ scheduledDate: { $gte: todayStart, $lte: next7 }, sessionStatus: 'Scheduled' }),
    Lead.countDocuments({ paymentStatus: { $in: ['Pending', 'Invoice Sent', 'Partially Paid', 'Overdue'] } }),
    Student.countDocuments({ status: 'Active', $or: [{ renewalStatus: { $in: ['Due Soon', 'In Discussion'] } }, { renewalDate: { $lte: endOfDay(addDays(now, 14)) } }] }),

    Lead.countDocuments({ dateReceived: { $gte: periodStart, $lte: todayEnd } }),
    Lead.countDocuments({ dateReceived: { $gte: prevStart, $lte: prevEnd } }),
    Lead.countDocuments({ convertedAt: { $gte: periodStart, $lte: todayEnd } }),
    Lead.countDocuments({ convertedAt: { $gte: prevStart, $lte: prevEnd } }),

    Lead.aggregate([
      { $match: { dateReceived: { $gte: periodStart } } },
      { $group: { _id: '$leadSource', count: { $sum: 1 }, converted: { $sum: { $cond: [{ $in: ['$pipelineStage', ['Converted / Paid', 'Active']] }, 1, 0] } } } },
      { $sort: { count: -1 } },
    ]),
    Lead.aggregate([
      { $match: { pipelineStage: { $nin: CLOSED } } },
      { $group: { _id: '$leadOwner', open: { $sum: 1 }, value: { $sum: '$expectedRevenue' } } },
      { $sort: { open: -1 } },
    ]),
    Lead.aggregate([
      { $match: { pipelineStage: 'Lost', lossReason: { $nin: ['', null] } } },
      { $group: { _id: '$lossReason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Student.aggregate([{ $group: { _id: null, collected: { $sum: '$amountPaid' } } }]),

    // 8-week trend of leads vs conversions.
    Lead.aggregate([
      { $match: { dateReceived: { $gte: startOfDay(addDays(now, -55)) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%G-W%V', date: '$dateReceived' } },
          leads: { $sum: 1 },
          converted: { $sum: { $cond: [{ $in: ['$pipelineStage', ['Converted / Paid', 'Active']] }, 1, 0] } },
          value: { $sum: '$expectedRevenue' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    ActivityLog.find().sort('-createdAt').limit(12),
  ]);

  const stageMap = Object.fromEntries(stageCounts.map((s) => [s._id, s]));
  const pipelineByStage = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: stageMap[stage]?.count || 0,
    value: Math.round(stageMap[stage]?.value || 0),
    open: OPEN_STAGES.includes(stage),
  }));

  const totalLeads = pipelineByStage.reduce((sum, s) => sum + s.count, 0);
  const totalConverted = (stageMap['Converted / Paid']?.count || 0) + (stageMap.Active?.count || 0);

  const pct = (curr, prev) => (prev ? Math.round(((curr - prev) / prev) * 100) : curr ? 100 : 0);

  res.json({
    success: true,
    data: {
      generatedAt: now,
      period: { days, from: periodStart, to: todayEnd },
      kpis: {
        newLeads,
        qualified,
        trialsScheduled,
        trialsCompleted,
        convertedPaid,
        activeStudents,
        overdueFollowups,
        openPipelineValue: Math.round(pipelineValueAgg[0]?.total || 0),
      },
      attention: {
        followupsDueToday: dueToday,
        overdueFollowups: overdue,
        trialsToday,
        trialsNext7Days: trialsNext7,
        pendingPayments,
        renewalsSoon,
        leadsMissingFollowUpDate: missingDate,
      },
      pipelineByStage,
      totals: {
        totalLeads,
        totalConverted,
        conversionRate: totalLeads ? Math.round((totalConverted / totalLeads) * 100) : 0,
        revenueCollected: Math.round(revenueAgg[0]?.collected || 0),
      },
      trends: {
        leads: { current: leadsThisPeriod, previous: leadsPrevPeriod, changePct: pct(leadsThisPeriod, leadsPrevPeriod) },
        conversions: { current: convertedThisPeriod, previous: convertedPrevPeriod, changePct: pct(convertedThisPeriod, convertedPrevPeriod) },
        weekly: weeklyTrend.map((w) => ({ week: w._id, leads: w.leads, converted: w.converted, value: Math.round(w.value) })),
      },
      breakdowns: {
        bySource: LEAD_SOURCES.map((source) => {
          const row = sourceBreakdown.find((s) => s._id === source);
          return { source, count: row?.count || 0, converted: row?.converted || 0 };
        }).filter((r) => r.count > 0),
        byOwner: LEAD_OWNERS.map((owner) => {
          const row = ownerBreakdown.find((o) => o._id === owner);
          return { owner, open: row?.open || 0, value: Math.round(row?.value || 0) };
        }).filter((r) => r.open > 0),
        lossReasons: lossReasons.map((l) => ({ reason: l._id, count: l.count })),
      },
      thisWeek: { start: weekStart, end: weekEnd },
      recentActivity,
    },
  });
});

/**
 * GET /api/dashboard/today
 * The mobile "what do I do now" screen: everything owed attention today.
 */
export const getToday = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const scope = req.query.owner && req.query.owner !== 'all' ? { owner: req.query.owner } : {};

  const [calls, overdueCalls, trials, sessions, staleLeads] = await Promise.all([
    Followup.find({ ...scope, dueDate: { $gte: todayStart, $lte: todayEnd }, status: OPEN_ACTION }).sort('priority dueDate').limit(50),
    Followup.find({ ...scope, dueDate: { $lt: todayStart }, status: OPEN_ACTION }).sort('dueDate').limit(50),
    Trial.find({ scheduledDate: { $gte: todayStart, $lte: todayEnd } }).sort('startTime').limit(50),
    Student.find({ nextSession: { $gte: todayStart, $lte: todayEnd }, status: 'Active' }).sort('nextSession').limit(50),
    Lead.find({
      pipelineStage: { $nin: CLOSED },
      $or: [{ lastContactDate: { $lt: addDays(todayStart, -7) } }, { lastContactDate: null }],
    }).sort('lastContactDate').limit(25),
  ]);

  res.json({ success: true, data: { calls, overdueCalls, trials, sessions, staleLeads } });
});
