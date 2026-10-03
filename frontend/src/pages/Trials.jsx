import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trialsApi } from '../api/endpoints.js';
import { downloadFile } from '../api/client.js';
import { useLists } from '../context/ListsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useListParams } from '../hooks/useListParams.js';
import { useDebounce } from '../hooks/useDebounce.js';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar from '../components/FilterBar.jsx';
import DataView from '../components/DataView.jsx';
import Pagination from '../components/Pagination.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import TrialForm from '../components/TrialForm.jsx';
import { Select, Textarea, FormGrid } from '../components/Field.jsx';
import { Spinner } from '../components/Loader.jsx';
import { IconPlus, IconDownload, IconEdit, IconCheck, IconAlert } from '../components/Icons.jsx';
import { formatDate, relativeDay } from '../lib/format.js';
import { SESSION_STYLES } from '../lib/constants.js';

const VIEWS = [
  { value: '', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Next 7 days' },
  { value: 'awaiting-feedback', label: 'Awaiting feedback' },
];

/** Post-trial review: feedback + the 24-hour commercial follow-up in one step (rule 4). */
function ReviewModal({ trial, open, onClose }) {
  const lists = useLists();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    tutorFeedback: '', clientFeedback: '', strongPoints: '', areasToImprove: '',
    rating: '5', outcome: 'Convert - Send Offer', nextStep: '', followUpOwner: '', createFollowup: true,
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload) => trialsApi.review(trial._id, payload),
    onSuccess: (res) => {
      ['trials', 'leads', 'lead', 'followups', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(res.data.followup ? 'Review saved and follow-up created' : 'Review saved');
      onClose();
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  if (!trial) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Review ${trial.trialId}`}
      subtitle={`${trial.studentName} · ${formatDate(trial.scheduledDate)}`}
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="review-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />} Save review
          </button>
        </>
      }
    >
      <form id="review-form" className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}>
        <FormGrid>
          <Textarea className="sm:col-span-2" label="Tutor feedback" required value={form.tutorFeedback} onChange={set('tutorFeedback')} />
          <Textarea className="sm:col-span-2" label="Client feedback" value={form.clientFeedback} onChange={set('clientFeedback')} />
          <Textarea label="Strong points" value={form.strongPoints} onChange={set('strongPoints')} />
          <Textarea label="Areas to improve" value={form.areasToImprove} onChange={set('areasToImprove')} />
          <Select label="Rating" options={['1', '2', '3', '4', '5']} value={form.rating} onChange={set('rating')} />
          <Select label="Outcome" options={lists.trialOutcome || []} value={form.outcome} onChange={set('outcome')} />
          <Textarea className="sm:col-span-2" label="Next step" rows={2} value={form.nextStep} onChange={set('nextStep')} />
          <Select label="Commercial follow-up owner" placeholder="Inherit from lead" options={lists.leadOwner || []}
                  value={form.followUpOwner} onChange={set('followUpOwner')} />
        </FormGrid>

        <label className="flex items-center gap-3 rounded-xl bg-navy-50 px-3.5 py-3">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
            checked={form.createFollowup}
            onChange={(e) => setForm((f) => ({ ...f, createFollowup: e.target.checked }))}
          />
          <span className="text-sm text-navy-800">
            Create the commercial follow-up action due within 24 hours <span className="text-slate-500">(rule 4)</span>
          </span>
        </label>
      </form>
    </Modal>
  );
}

export default function Trials() {
  const navigate = useNavigate();
  const lists = useLists();
  const { canWrite } = useAuth();
  const { params, setParam, clearFilters } = useListParams({ page: '1', limit: '25' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  const search = useDebounce(params.search || '', 350);

  const { data, isLoading } = useQuery({
    queryKey: ['trials', { ...params, search }],
    queryFn: () => trialsApi.list({ ...params, search }),
    keepPreviousData: true,
  });

  const columns = [
    { key: 'trialId', label: 'Trial ID', mobile: 'subtitle',
      render: (r) => <span className="font-mono text-xs font-semibold text-navy-600">{r.trialId}</span> },
    { key: 'leadId', label: 'Lead ID', mobile: 'hide',
      render: (r) => <span className="font-mono text-xs text-slate-500">{r.leadId}</span> },
    { key: 'studentName', label: 'Student', mobile: 'title' },
    { key: 'subject', label: 'Subject', render: (r) => r.subject || '—' },
    { key: 'tutor', label: 'Tutor', render: (r) => r.tutor || <span className="text-slate-400">Unassigned</span> },
    { key: 'scheduledDate', label: 'Scheduled', render: (r) => `${formatDate(r.scheduledDate)}` },
    { key: 'startTime', label: 'Start', render: (r) => r.startTime || '—' },
    { key: 'durationMinutes', label: 'Duration', render: (r) => `${r.durationMinutes} min` },
    { key: 'sessionStatus', label: 'Status', mobile: 'badge', render: (r) => <Badge value={r.sessionStatus} map={SESSION_STYLES} /> },
    { key: 'adminReviewer', label: 'Reviewer', render: (r) => r.adminReviewer || '—' },
    { key: 'rating', label: 'Rating', render: (r) => (r.rating ? '★'.repeat(r.rating) : '—') },
    { key: 'commercialFollowUpOwner', label: 'Follow-up Owner', render: (r) => r.commercialFollowUpOwner || '—' },
    { key: 'followUpDeadline', label: 'Deadline',
      render: (r) => (r.followUpDeadline
        ? <span className={r.feedbackOverdue ? 'font-semibold text-rose-600' : ''}>{relativeDay(r.followUpDeadline)}</span>
        : '—') },
    { key: 'outcome', label: 'Outcome', mobile: 'badge', render: (r) => <Badge value={r.outcome} fallback="bg-slate-100 text-slate-600" /> },
    { key: 'nextStep', label: 'Next Step', mobile: 'hide',
      render: (r) => <span className="block max-w-[220px] truncate">{r.nextStep || '—'}</span> },
  ];

  const filters = [
    { key: 'sessionStatus', label: 'Status', options: lists.sessionStatus || [], value: params.sessionStatus, onChange: (v) => setParam('sessionStatus', v) },
    { key: 'outcome', label: 'Outcome', options: lists.trialOutcome || [], value: params.outcome, onChange: (v) => setParam('outcome', v) },
    { key: 'tutor', label: 'Tutor', options: lists.tutorsInUse || [], value: params.tutor, onChange: (v) => setParam('tutor', v) },
    { key: 'commercialFollowUpOwner', label: 'Follow-up owner', options: lists.leadOwner || [], value: params.commercialFollowUpOwner, onChange: (v) => setParam('commercialFollowUpOwner', v) },
  ];

  return (
    <>
      <PageHeader
        title="Trial Session Operations"
        subtitle="Scheduling, delivery, quality review, feedback and post-trial conversion follow-up."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => downloadFile('/trials/export', 'tutwithus-trial-sessions.csv', params)}>
              <IconDownload className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </button>
            {canWrite && (
              <button type="button" className="btn bg-white text-navy-700 hover:bg-navy-50" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <IconPlus className="h-4 w-4" /> Schedule trial
              </button>
            )}
          </>
        }
      />

      <div className="card overflow-hidden">
        <FilterBar
          search={params.search || ''}
          onSearch={(v) => setParam('search', v)}
          searchPlaceholder="Search student, tutor, trial ID…"
          views={VIEWS}
          activeView={params.view || ''}
          onView={(v) => setParam('view', v)}
          filters={filters}
          onClear={clearFilters}
        />

        <DataView
          columns={columns}
          rows={data?.data || []}
          loading={isLoading}
          emptyTitle="No trial sessions here"
          emptyMessage="Schedule a trial from a qualified lead to see it listed."
          onRowClick={canWrite ? (row) => { setEditing(row); setFormOpen(true); } : undefined}
          renderMobileActions={(row) => (
            <>
              {canWrite && row.sessionStatus !== 'Completed' && (
                <button type="button" className="btn-primary btn-sm flex-1" onClick={() => setReviewing(row)}>
                  <IconCheck className="h-3.5 w-3.5" /> Review
                </button>
              )}
              {canWrite && (
                <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => { setEditing(row); setFormOpen(true); }}>
                  <IconEdit className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => navigate(`/pipeline?search=${row.leadId}`)}>
                Lead
              </button>
            </>
          )}
          footer={<Pagination meta={data?.meta} onPage={(p) => setParam('page', p)} onLimit={(l) => setParam('limit', l)} />}
        />
      </div>

      {/* Desktop quick-review strip for anything still awaiting feedback. */}
      {canWrite && (data?.data || []).some((t) => t.feedbackOverdue) && (
        <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <IconAlert className="h-5 w-5 shrink-0" />
          <span className="flex-1">
            Some completed trials are past the 24-hour feedback window (rule 4). Open them and record the review.
          </span>
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => setParam('view', 'awaiting-feedback')}>
            Show them
          </button>
        </div>
      )}

      <TrialForm open={formOpen} onClose={() => setFormOpen(false)} trial={editing} />
      <ReviewModal trial={reviewing} open={Boolean(reviewing)} onClose={() => setReviewing(null)} />
    </>
  );
}
