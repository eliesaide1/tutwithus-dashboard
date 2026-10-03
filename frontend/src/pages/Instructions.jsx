import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../api/endpoints.js';
import { useLists } from '../context/ListsContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SectionCard from '../components/SectionCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDateTime } from '../lib/format.js';

const LIST_GROUPS = [
  { key: 'pipelineStage', label: 'Pipeline Stage' },
  { key: 'leadSource', label: 'Lead Source' },
  { key: 'priority', label: 'Priority' },
  { key: 'leadOwner', label: 'Lead Owner' },
  { key: 'trialStatus', label: 'Trial Status' },
  { key: 'conversionStatus', label: 'Conversion Status' },
  { key: 'paymentStatus', label: 'Payment Status' },
  { key: 'lossReason', label: 'Loss Reason' },
  { key: 'sessionStatus', label: 'Session Status' },
  { key: 'trialOutcome', label: 'Trial Outcome' },
  { key: 'actionType', label: 'Action Type' },
  { key: 'actionStatus', label: 'Action Status' },
  { key: 'renewalStatus', label: 'Renewal Status' },
  { key: 'studentStatus', label: 'Student Status' },
  { key: 'gradeLevel', label: 'Grade / Level' },
  { key: 'subject', label: 'Subject' },
];

export default function Instructions() {
  const lists = useLists();

  const { data: activity } = useQuery({
    queryKey: ['activity', { limit: 30 }],
    queryFn: () => activityApi.list({ limit: 30 }),
  });

  return (
    <>
      <PageHeader
        title="Pipeline Controls & Instructions"
        subtitle="Dropdown values and operating rules used across the whole workspace."
      />

      <SectionCard title="Daily operating rules">
        <ol className="flex flex-col gap-3">
          {(lists.operatingRules || []).map((rule, i) => (
            <li key={rule} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-navy-700 text-xs font-bold text-white">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-navy-800">{rule}</p>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title="Dropdown values" subtitle="Enforced by the API — the same list everywhere">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LIST_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-navy-700">{group.label}</h3>
              <ul className="flex flex-wrap gap-1.5">
                {(lists[group.key] || []).map((value) => (
                  <li key={value} className="rounded-md bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                    {value}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Tutors in use" subtitle="Collected from trials and student records">
          {lists.tutorsInUse?.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {lists.tutorsInUse.map((t) => (
                <li key={t} className="rounded-lg bg-navy-50 px-2.5 py-1 text-sm font-medium text-navy-700">{t}</li>
              ))}
            </ul>
          ) : <EmptyState title="No tutors recorded yet" message="Tutor names appear once trials or students are assigned." />}
        </SectionCard>

        <SectionCard title="Subjects in use">
          {lists.subjectsInUse?.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {lists.subjectsInUse.map((s) => (
                <li key={s} className="rounded-lg bg-sky-50 px-2.5 py-1 text-sm font-medium text-sky-800">{s}</li>
              ))}
            </ul>
          ) : <EmptyState title="No subjects recorded yet" />}
        </SectionCard>
      </div>

      <SectionCard title="Audit trail" subtitle="Last 30 changes across the workspace" bodyClassName="p-0">
        {activity?.data?.length ? (
          <ul className="flex max-h-[28rem] flex-col divide-y divide-slate-100 overflow-y-auto">
            {activity.data.map((log) => (
              <li key={log._id} className="flex flex-col gap-0.5 px-4 py-3">
                <span className="text-sm text-navy-800">
                  <span className="font-mono text-xs font-semibold text-navy-600">{log.reference}</span> — {log.summary}
                </span>
                <span className="text-xs text-slate-400">
                  {log.entity} · {log.action} · {log.userName || 'System'} · {formatDateTime(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No activity recorded yet" />}
      </SectionCard>
    </>
  );
}
