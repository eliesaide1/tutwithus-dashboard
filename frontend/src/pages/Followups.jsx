import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followupsApi } from '../api/endpoints.js';
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
import FollowupForm from '../components/FollowupForm.jsx';
import { Input, Select, Textarea } from '../components/Field.jsx';
import { Spinner } from '../components/Loader.jsx';
import { IconPlus, IconDownload, IconEdit, IconCheck, IconPhone } from '../components/Icons.jsx';
import { formatDate, relativeDay, toDateInput } from '../lib/format.js';
import { ACTION_STATUS_STYLES, PRIORITY_STYLES, FOLLOWUP_STATUS_STYLES } from '../lib/constants.js';

const VIEWS = [
  { value: 'open', label: 'Open' },
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'week', label: 'Next 7 days' },
  { value: '', label: 'All' },
];

/** One-tap outcome capture straight after a call. */
function AttemptModal({ followup, open, onClose }) {
  const toast = useToast();
  const lists = useLists();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ status: 'No Answer', result: '', nextDueDate: toDateInput(new Date()), nextAction: '' });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload) => followupsApi.attempt(followup._id, payload),
    onSuccess: () => {
      ['followups', 'leads', 'lead', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success('Attempt logged');
      onClose();
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  if (!followup) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log attempt"
      subtitle={`${followup.contactName} · ${followup.actionType}`}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="attempt-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />} Save
          </button>
        </>
      }
    >
      <form id="attempt-form" className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}>
        <Select label="Outcome" options={lists.actionStatus || []} value={form.status} onChange={set('status')} />
        <Textarea label="What happened" value={form.result} onChange={set('result')} placeholder="Parent asked to call back after 7pm" />
        <Input label="Next attempt on" type="date" value={form.nextDueDate} onChange={set('nextDueDate')} />
        <Input label="Next action" value={form.nextAction} onChange={set('nextAction')} placeholder="Call again after 7pm" />
      </form>
    </Modal>
  );
}

export default function Followups() {
  const navigate = useNavigate();
  const lists = useLists();
  const toast = useToast();
  const { canWrite } = useAuth();
  const queryClient = useQueryClient();
  const { params, setParam, clearFilters } = useListParams({ page: '1', limit: '25', view: 'open' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [attempting, setAttempting] = useState(null);

  const search = useDebounce(params.search || '', 350);

  const { data, isLoading } = useQuery({
    queryKey: ['followups', { ...params, search }],
    queryFn: () => followupsApi.list({ ...params, search }),
    keepPreviousData: true,
  });

  const complete = useMutation({
    mutationFn: (id) => followupsApi.complete(id, {}),
    onSuccess: () => {
      ['followups', 'leads', 'lead', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success('Action completed');
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  const columns = [
    { key: 'actionId', label: 'Action ID', mobile: 'subtitle',
      render: (r) => <span className="font-mono text-xs font-semibold text-navy-600">{r.actionId}</span> },
    { key: 'leadId', label: 'Lead ID', mobile: 'hide',
      render: (r) => <span className="font-mono text-xs text-slate-500">{r.leadId}</span> },
    { key: 'contactName', label: 'Student / Parent', mobile: 'title' },
    { key: 'owner', label: 'Owner' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'dueDate', label: 'Due Date',
      render: (r) => <span className={r.dueStatus === 'Overdue' ? 'font-semibold text-rose-600' : ''}>{relativeDay(r.dueDate)}</span> },
    { key: 'dueStatus', label: 'Due Status', mobile: 'badge', render: (r) => <Badge value={r.dueStatus} map={FOLLOWUP_STATUS_STYLES} /> },
    { key: 'priority', label: 'Priority', mobile: 'badge', render: (r) => <Badge value={r.priority} map={PRIORITY_STYLES} /> },
    { key: 'status', label: 'Status', mobile: 'badge', render: (r) => <Badge value={r.status} map={ACTION_STATUS_STYLES} /> },
    { key: 'lastAttempt', label: 'Last Attempt', render: (r) => formatDate(r.lastAttempt, { withYear: false }) },
    { key: 'attempts', label: 'Attempts', render: (r) => <span className="tabular-nums">{r.attempts}</span> },
    { key: 'result', label: 'Result / Notes', mobile: 'hide',
      render: (r) => <span className="block max-w-[240px] truncate text-slate-600">{r.result || '—'}</span> },
    { key: 'nextAction', label: 'Next Action',
      render: (r) => <span className="block max-w-[220px] truncate">{r.nextAction || '—'}</span> },
  ];

  const filters = [
    { key: 'status', label: 'Status', options: lists.actionStatus || [], value: params.status, onChange: (v) => setParam('status', v) },
    { key: 'owner', label: 'Owner', options: lists.leadOwner || [], value: params.owner, onChange: (v) => setParam('owner', v) },
    { key: 'priority', label: 'Priority', options: lists.priority || [], value: params.priority, onChange: (v) => setParam('priority', v) },
    { key: 'actionType', label: 'Type', options: lists.actionType || [], value: params.actionType, onChange: (v) => setParam('actionType', v) },
  ];

  return (
    <>
      <PageHeader
        title="Follow-up Action Board"
        subtitle="Detailed call/message actions. Every open sales opportunity should have a next step."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => downloadFile('/followups/export', 'tutwithus-followups.csv', params)}>
              <IconDownload className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </button>
            {canWrite && (
              <button type="button" className="btn bg-white text-navy-700 hover:bg-navy-50" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <IconPlus className="h-4 w-4" /> New action
              </button>
            )}
          </>
        }
      />

      <div className="card overflow-hidden">
        <FilterBar
          search={params.search || ''}
          onSearch={(v) => setParam('search', v)}
          searchPlaceholder="Search contact, notes, action ID…"
          views={VIEWS}
          activeView={params.view ?? ''}
          onView={(v) => setParam('view', v)}
          filters={filters}
          onClear={clearFilters}
        />

        <DataView
          columns={columns}
          rows={data?.data || []}
          loading={isLoading}
          emptyTitle="No actions in this view"
          emptyMessage="Nothing waiting — or adjust the filters above."
          onRowClick={canWrite ? (row) => { setEditing(row); setFormOpen(true); } : undefined}
          renderMobileActions={(row) => (
            <>
              <button type="button" className="btn-primary btn-sm flex-1" onClick={() => setAttempting(row)}>
                <IconPhone className="h-3.5 w-3.5" /> Log attempt
              </button>
              {row.status !== 'Completed' && (
                <button type="button" className="btn-secondary btn-sm flex-1" disabled={complete.isPending}
                        onClick={() => complete.mutate(row._id)}>
                  <IconCheck className="h-3.5 w-3.5" /> Done
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

      <FollowupForm open={formOpen} onClose={() => setFormOpen(false)} followup={editing} />
      <AttemptModal followup={attempting} open={Boolean(attempting)} onClose={() => setAttempting(null)} />
    </>
  );
}
