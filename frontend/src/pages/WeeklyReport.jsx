import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '../api/endpoints.js';
import { downloadFile } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SectionCard from '../components/SectionCard.jsx';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { PageLoader, Spinner } from '../components/Loader.jsx';
import { Textarea } from '../components/Field.jsx';
import { currency, formatDate } from '../lib/format.js';
import { STAGE_STYLES } from '../lib/constants.js';
import {
  IconDownload, IconCheck, IconPipeline, IconTrial, IconMoney, IconReport, IconChevronLeft, IconChevronRight,
} from '../components/Icons.jsx';

const COMMENTARY_FIELDS = [
  { key: 'strongestOpportunities', label: 'What we are cooking / strongest opportunities' },
  { key: 'trialsNextWeek', label: 'Trials scheduled for the coming week' },
  { key: 'conversionsExpected', label: 'Conversions expected / payment pending' },
  { key: 'mainSalesActions', label: 'Main sales actions next week' },
  { key: 'risksBlockers', label: 'Risks / blockers requiring attention' },
];

function shiftWeek(weekKey, delta) {
  const [year, week] = weekKey.split('-W').map(Number);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1 + delta) * 7);
  const d = new Date(monday);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const newWeek = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return `${d.getFullYear()}-W${String(newWeek).padStart(2, '0')}`;
}

export default function WeeklyReport() {
  const { isManager } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [week, setWeek] = useState(null);
  const [commentary, setCommentary] = useState({});
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['report', 'weekly', week],
    queryFn: () => reportsApi.weekly(week ? { week } : {}),
  });

  useEffect(() => {
    if (data?.data) {
      setCommentary(data.data.commentary || {});
      setWeek((w) => w || data.data.weekKey);
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (status) => reportsApi.save(data.data.weekKey, { commentary, status }),
    onSuccess: (_res, status) => {
      queryClient.invalidateQueries({ queryKey: ['report'] });
      setDirty(false);
      toast.success(status === 'Sent' ? 'Report marked as sent' : 'Commentary saved');
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  if (isLoading || !data) return <PageLoader label="Building the investor snapshot…" />;

  const d = data.data;
  const s = d.snapshot;

  const setField = (key) => (e) => {
    setCommentary((c) => ({ ...c, [key]: e.target.value }));
    setDirty(true);
  };

  return (
    <>
      <PageHeader
        title="Weekly Investor Pipeline Report"
        subtitle="Friday snapshot generated from the live operating pipeline. Add brief management commentary."
        actions={
          <>
            <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1">
              <button type="button" className="icon-btn text-white hover:bg-white/10"
                      onClick={() => setWeek(shiftWeek(d.weekKey, -1))} aria-label="Previous week">
                <IconChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1 text-xs font-bold text-white">{d.weekKey}</span>
              <button type="button" className="icon-btn text-white hover:bg-white/10"
                      onClick={() => setWeek(shiftWeek(d.weekKey, 1))} aria-label="Next week">
                <IconChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button type="button" className="btn-secondary"
                    onClick={() => downloadFile(`/reports/weekly/${d.weekKey}/export`, `tutwithus-investor-report-${d.weekKey}.txt`)}>
              <IconDownload className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-sm text-navy-100">
          <Badge value={d.status} fallback={d.status === 'Sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-white/20 text-white'} />
          <span>{formatDate(d.weekStart)} – {formatDate(d.weekEnd)}</span>
          {d.preparedBy?.name && <span>· prepared by {d.preparedBy.name}</span>}
        </div>
      </PageHeader>

      <SectionCard title="Weekly snapshot" subtitle="Recomputed live — never maintained by hand (rule 7)" bodyClassName="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="New leads this week" value={s.newLeads} icon={IconPipeline} tone="navy" />
          <StatCard label="Trials scheduled" value={s.trialsScheduled} icon={IconTrial} tone="violet" />
          <StatCard label="Trials completed" value={s.trialsCompleted} icon={IconCheck} tone="emerald" />
          <StatCard label="Converted / Paid" value={s.convertedPaid} icon={IconMoney} tone="emerald" hint={`${s.conversionRate}% of new leads`} />
          <StatCard label="Open opportunities" value={s.openOpportunities} icon={IconPipeline} tone="sky" />
          <StatCard label="Pipeline value" value={currency(s.pipelineValue)} icon={IconMoney} tone="navy" />
          <StatCard label="Revenue collected" value={currency(s.revenueCollected)} icon={IconMoney} tone="emerald" />
          <StatCard label="Conversion rate" value={`${s.conversionRate}%`} icon={IconReport} tone="amber" />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Investor commentary — complete before sharing"
          className="lg:col-span-2"
          actions={isManager && (
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-sm bg-white/15 text-xs font-semibold text-white hover:bg-white/25"
                      disabled={save.isPending || !dirty} onClick={() => save.mutate('Draft')}>
                {save.isPending && <Spinner className="h-3 w-3" />} Save
              </button>
              <button type="button" className="btn btn-sm bg-white text-xs font-semibold text-navy-700 hover:bg-navy-50"
                      disabled={save.isPending} onClick={() => save.mutate('Sent')}>
                Mark sent
              </button>
            </div>
          )}
        >
          <div className="flex flex-col gap-4">
            {COMMENTARY_FIELDS.map((field) => (
              <Textarea
                key={field.key}
                label={field.label}
                rows={3}
                value={commentary[field.key] || ''}
                onChange={setField(field.key)}
                disabled={!isManager}
                placeholder={isManager ? 'Two or three sentences for the investor update…' : 'Managers complete this section'}
              />
            ))}
            {dirty && <p className="text-xs font-medium text-amber-600">Unsaved changes</p>}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard title="Trials next week" subtitle={`${d.helpers.trialsNextWeek.length} scheduled`} bodyClassName="p-0">
            {d.helpers.trialsNextWeek.length === 0 ? (
              <EmptyState title="Nothing booked yet" message="Trials scheduled for next week will appear here." />
            ) : (
              <ul className="flex max-h-64 flex-col divide-y divide-slate-100 overflow-y-auto">
                {d.helpers.trialsNextWeek.map((t) => (
                  <li key={t._id} className="flex flex-col px-4 py-2.5">
                    <span className="text-sm font-semibold text-navy-800">{t.studentName}</span>
                    <span className="text-xs text-slate-500">
                      {formatDate(t.scheduledDate, { withYear: false })} {t.startTime} · {t.tutor || 'Unassigned'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Top open opportunities" bodyClassName="p-0">
            {d.helpers.topOpportunities.length === 0 ? (
              <EmptyState title="No open opportunities" />
            ) : (
              <ul className="flex max-h-72 flex-col divide-y divide-slate-100 overflow-y-auto">
                {d.helpers.topOpportunities.map((lead) => (
                  <li key={lead._id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-navy-800">{lead.studentName}</span>
                      <span className="truncate text-xs text-slate-500">{lead.leadId} · {lead.leadOwner}</span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold tabular-nums text-navy-700">{currency(lead.expectedRevenue)}</span>
                      <Badge value={lead.pipelineStage} map={STAGE_STYLES} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <p className="rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
        Recommended sending cadence: {d.sendingCadence}
      </p>
    </>
  );
}
