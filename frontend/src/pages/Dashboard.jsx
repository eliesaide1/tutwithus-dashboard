import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/endpoints.js';
import PageHeader from '../components/PageHeader.jsx';
import SectionCard from '../components/SectionCard.jsx';
import StatCard from '../components/StatCard.jsx';
import BarList from '../components/BarList.jsx';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { PageLoader } from '../components/Loader.jsx';
import { currency, formatDate, formatDateTime, relativeDay } from '../lib/format.js';
import { STAGE_STYLES } from '../lib/constants.js';
import {
  IconPipeline, IconTrial, IconPhone, IconStudents, IconMoney, IconCheck,
  IconAlert, IconClock, IconChevronRight,
} from '../components/Icons.jsx';

const PERIODS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', days],
    queryFn: () => dashboardApi.summary({ days }),
    refetchInterval: 60_000,
  });

  const { data: todayData } = useQuery({
    queryKey: ['dashboard', 'today'],
    queryFn: () => dashboardApi.today(),
    refetchInterval: 60_000,
  });

  if (isLoading) return <PageLoader label="Loading live pipeline…" />;
  if (error) {
    return (
      <EmptyState
        icon={IconAlert}
        title="Could not load the dashboard"
        message={error.friendlyMessage}
      />
    );
  }

  const d = data.data;
  const k = d.kpis;
  const a = d.attention;
  const today = todayData?.data;

  const attentionItems = [
    { label: 'Follow-ups due today', value: a.followupsDueToday, to: '/followups?view=today', tone: 'amber' },
    { label: 'Overdue follow-ups', value: a.overdueFollowups, to: '/followups?view=overdue', tone: 'rose', alert: a.overdueFollowups > 0 },
    { label: 'Trials today', value: a.trialsToday, to: '/trials?view=today', tone: 'violet' },
    { label: 'Trials in next 7 days', value: a.trialsNext7Days, to: '/trials?view=upcoming', tone: 'sky' },
    { label: 'Pending payments', value: a.pendingPayments, to: '/pipeline?view=pending-payment', tone: 'amber' },
    { label: 'Renewals soon', value: a.renewalsSoon, to: '/students?view=renewals', tone: 'emerald' },
    { label: 'Leads without a follow-up date', value: a.leadsMissingFollowUpDate, to: '/pipeline?view=missing-date', tone: 'rose', alert: a.leadsMissingFollowUpDate > 0 },
  ];

  return (
    <>
      <PageHeader
        title="Sales & Trial Operations Dashboard"
        subtitle={`Live management view · updated ${formatDateTime(d.generatedAt)}`}
        actions={
          <div className="flex rounded-xl bg-white/10 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setDays(p.value)}
                className={`chip justify-center rounded-lg ${
                  days === p.value ? 'bg-white text-navy-700' : 'text-navy-100 hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {/* ---------- LIVE PIPELINE KPIs ---------- */}
      <SectionCard title="Live Pipeline KPIs" subtitle="Metrics update from the Master Pipeline and operational tabs" bodyClassName="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="New Leads" value={k.newLeads} icon={IconPipeline} tone="navy"
                    change={d.trends.leads.changePct} hint={`last ${days}d`}
                    onClick={() => navigate('/pipeline?pipelineStage=New Lead')} />
          <StatCard label="Qualified" value={k.qualified} icon={IconCheck} tone="sky"
                    onClick={() => navigate('/pipeline?pipelineStage=Qualified')} />
          <StatCard label="Trials Scheduled" value={k.trialsScheduled} icon={IconTrial} tone="violet"
                    onClick={() => navigate('/trials?view=upcoming')} />
          <StatCard label="Trials Completed" value={k.trialsCompleted} icon={IconCheck} tone="emerald"
                    onClick={() => navigate('/trials?sessionStatus=Completed')} />
          <StatCard label="Converted / Paid" value={k.convertedPaid} icon={IconMoney} tone="emerald"
                    change={d.trends.conversions.changePct}
                    onClick={() => navigate('/pipeline?pipelineStage=Converted / Paid')} />
          <StatCard label="Active Students" value={k.activeStudents} icon={IconStudents} tone="sky"
                    onClick={() => navigate('/students?view=active')} />
          <StatCard label="Overdue Follow-ups" value={k.overdueFollowups} icon={IconAlert} tone="rose"
                    alert={k.overdueFollowups > 0}
                    onClick={() => navigate('/followups?view=overdue')} />
          <StatCard label="Open Pipeline Value" value={currency(k.openPipelineValue)} icon={IconMoney} tone="navy"
                    hint={`${d.totals.conversionRate}% conversion`} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ---------- Pipeline by Stage ---------- */}
        <SectionCard title="Pipeline by Stage" subtitle="Tap a stage to open it" className="lg:col-span-2">
          <BarList
            items={d.pipelineByStage.map((s) => ({
              ...s,
              label: s.stage,
              accent: s.open ? 'bg-navy-500' : 'bg-emerald-500',
            }))}
            valueKey="count"
            formatValue={(i) => (i.value ? `${i.count} · ${currency(i.value)}` : i.count)}
            onSelect={(i) => navigate(`/pipeline?pipelineStage=${encodeURIComponent(i.stage)}`)}
          />
        </SectionCard>

        {/* ---------- Management Attention ---------- */}
        <SectionCard title="Management Attention">
          <ul className="flex flex-col divide-y divide-slate-100">
            {attentionItems.map((item) => (
              <li key={item.label}>
                <Link to={item.to} className="flex items-center gap-3 py-2.5 transition hover:bg-slate-50">
                  <span className={`flex h-2.5 w-2.5 shrink-0 rounded-full ${
                    item.alert ? 'bg-rose-500' : item.value > 0 ? 'bg-amber-400' : 'bg-slate-300'
                  }`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy-800">{item.label}</span>
                  <span className={`shrink-0 text-lg font-extrabold tabular-nums ${
                    item.alert ? 'text-rose-600' : 'text-navy-800'
                  }`}>{item.value}</span>
                  <IconChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* ---------- Today ---------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Today's calls"
          subtitle={`${(today?.calls?.length || 0) + (today?.overdueCalls?.length || 0)} action(s)`}
          actions={<Link to="/followups?view=today" className="tap-link text-xs font-semibold text-white/80 hover:text-white">Open board →</Link>}
          bodyClassName="p-0"
        >
          {!today?.calls?.length && !today?.overdueCalls?.length ? (
            <EmptyState icon={IconCheck} title="Nothing due today" message="Every follow-up for today is handled." />
          ) : (
            <ul className="flex max-h-80 flex-col divide-y divide-slate-100 overflow-y-auto">
              {[...(today.overdueCalls || []), ...(today.calls || [])].slice(0, 12).map((f) => (
                <li key={f._id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-600">
                    <IconPhone className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-navy-800">{f.contactName}</span>
                    <span className="truncate text-xs text-slate-500">{f.actionType} · {f.owner} · {f.leadId}</span>
                  </div>
                  <Badge
                    value={relativeDay(f.dueDate)}
                    fallback={new Date(f.dueDate) < new Date().setHours(0, 0, 0, 0) ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Today's trials"
          subtitle={`${today?.trials?.length || 0} session(s)`}
          actions={<Link to="/trials?view=today" className="tap-link text-xs font-semibold text-white/80 hover:text-white">Open trials →</Link>}
          bodyClassName="p-0"
        >
          {!today?.trials?.length ? (
            <EmptyState icon={IconTrial} title="No trials today" message="Nothing scheduled for the next few hours." />
          ) : (
            <ul className="flex max-h-80 flex-col divide-y divide-slate-100 overflow-y-auto">
              {today.trials.map((t) => (
                <li key={t._id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-50 text-[11px] font-bold text-violet-700">
                    {t.startTime || '—'}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-navy-800">{t.studentName}</span>
                    <span className="truncate text-xs text-slate-500">{t.subject || '—'} · {t.tutor || 'Unassigned'}</span>
                  </div>
                  <Badge value={t.sessionStatus} fallback="bg-sky-100 text-sky-800" />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* ---------- breakdowns ---------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Leads by source" subtitle={`last ${days} days`}>
          {d.breakdowns.bySource.length ? (
            <BarList items={d.breakdowns.bySource.map((s) => ({ ...s, label: s.source }))}
                     valueKey="count" accent="bg-sky-500"
                     formatValue={(i) => `${i.count}${i.converted ? ` · ${i.converted} won` : ''}`} />
          ) : <EmptyState title="No leads in this period" />}
        </SectionCard>

        <SectionCard title="Open work by owner">
          {d.breakdowns.byOwner.length ? (
            <BarList items={d.breakdowns.byOwner.map((o) => ({ ...o, label: o.owner }))}
                     valueKey="open" accent="bg-navy-500"
                     formatValue={(i) => `${i.open} · ${currency(i.value)}`} />
          ) : <EmptyState title="No open leads" />}
        </SectionCard>

        <SectionCard title="Why we lose deals">
          {d.breakdowns.lossReasons.length ? (
            <BarList items={d.breakdowns.lossReasons.map((l) => ({ ...l, label: l.reason }))}
                     valueKey="count" accent="bg-rose-400" />
          ) : <EmptyState title="No losses recorded" message="Loss reasons appear here once deals are marked Lost." />}
        </SectionCard>
      </div>

      {/* ---------- recent activity ---------- */}
      <SectionCard title="Recent activity" bodyClassName="p-0">
        {d.recentActivity?.length ? (
          <ul className="flex flex-col divide-y divide-slate-100">
            {d.recentActivity.map((log) => (
              <li key={log._id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <IconClock className="h-3.5 w-3.5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-navy-800">
                    <span className="font-semibold">{log.reference}</span> — {log.summary}
                  </span>
                  <span className="text-xs text-slate-400">{log.userName || 'System'} · {formatDateTime(log.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No activity yet" message="Changes to leads, trials and students appear here." />
        )}
      </SectionCard>

      <p className="pb-2 text-center text-xs text-slate-400">
        Live management view · {d.totals.totalLeads} leads tracked · {currency(d.totals.revenueCollected)} collected
        · week of {formatDate(d.thisWeek.start)}
      </p>
    </>
  );
}
