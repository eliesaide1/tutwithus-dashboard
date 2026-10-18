import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../api/endpoints.js';
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
import LeadForm from '../components/LeadForm.jsx';
import { IconPlus, IconDownload, IconPipeline, IconEdit } from '../components/Icons.jsx';
import { currency, formatDate, relativeDay } from '../lib/format.js';
import {
  STAGE_STYLES, PRIORITY_STYLES, FOLLOWUP_STATUS_STYLES, PAYMENT_STYLES,
} from '../lib/constants.js';

const VIEWS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'due-today', label: 'Due today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'missing-date', label: 'Missing date' },
  { value: 'trials-today', label: 'Trials today' },
  { value: 'pending-payment', label: 'Payment pending' },
];

/** Column O of the sheet, computed client-side so the badge is always current. */
function followUpStatus(lead) {
  if (!lead.nextFollowUp) return 'Missing Date';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(lead.nextFollowUp); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Due Today';
  if (diff <= 3) return 'Due Soon';
  return 'Scheduled';
}

export default function Pipeline() {
  const navigate = useNavigate();
  const lists = useLists();
  const toast = useToast();
  const { canWrite } = useAuth();
  const queryClient = useQueryClient();
  const { params, setParam, clearFilters } = useListParams({ page: '1', limit: '25' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkStage, setBulkStage] = useState('');

  const search = useDebounce(params.search || '', 350);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', { ...params, search }],
    queryFn: () => leadsApi.list({ ...params, search }),
    keepPreviousData: true,
  });

  const bulk = useMutation({
    mutationFn: (payload) => leadsApi.bulk(payload),
    onSuccess: (res) => {
      toast.success(res.message);
      setSelected([]); setBulkStage('');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  const rows = data?.data || [];

  const columns = [
    { key: 'leadId', label: 'Lead ID', mobile: 'subtitle',
      render: (r) => <span className="font-mono text-xs font-semibold text-navy-600">{r.leadId}</span> },
    { key: 'dateReceived', label: 'Received', render: (r) => formatDate(r.dateReceived, { withYear: false }) },
    { key: 'studentName', label: 'Student / Parent', mobile: 'title',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold">{r.studentName}</span>
          {r.parentName && <span className="text-xs text-slate-500">{r.parentName}</span>}
        </div>
      ) },
    { key: 'phone', label: 'Phone / Contact',
      render: (r) => r.phone
        ? <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="tap-link text-navy-600 hover:underline">{r.phone}</a>
        : <span className="text-slate-400">—</span> },
    { key: 'leadSource', label: 'Source' },
    { key: 'gradeLevel', label: 'Grade / Level', render: (r) => r.gradeLevel || '—' },
    { key: 'subject', label: 'Subject / Need', render: (r) => r.subject || '—' },
    { key: 'leadOwner', label: 'Owner' },
    { key: 'priority', label: 'Priority', mobile: 'badge', render: (r) => <Badge value={r.priority} map={PRIORITY_STYLES} /> },
    { key: 'pipelineStage', label: 'Stage', mobile: 'badge', render: (r) => <Badge value={r.pipelineStage} map={STAGE_STYLES} /> },
    { key: 'lastContactDate', label: 'Last Contact', render: (r) => formatDate(r.lastContactDate, { withYear: false }) },
    { key: 'daysSinceContact', label: 'Days Since',
      render: (r) => (r.daysSinceContact === null || r.daysSinceContact === undefined
        ? <span className="text-slate-400">—</span>
        : <span className={r.daysSinceContact > 7 ? 'font-semibold text-rose-600' : ''}>{r.daysSinceContact}</span>) },
    { key: 'nextAction', label: 'Next Action',
      render: (r) => <span className="block max-w-[220px] truncate">{r.nextAction || <span className="text-slate-400">—</span>}</span> },
    { key: 'nextFollowUp', label: 'Next Follow-up', render: (r) => relativeDay(r.nextFollowUp) },
    { key: 'followUpStatus', label: 'Follow-up Status', mobile: 'badge',
      render: (r) => <Badge value={followUpStatus(r)} map={FOLLOWUP_STATUS_STYLES} /> },
    { key: 'trialStatus', label: 'Trial Status' },
    { key: 'trialDateTime', label: 'Trial Date', render: (r) => formatDate(r.trialDateTime, { withYear: false }) },
    { key: 'assignedTutor', label: 'Tutor', render: (r) => r.assignedTutor || '—' },
    { key: 'conversionStatus', label: 'Conversion' },
    { key: 'expectedRevenue', label: 'Expected Revenue',
      render: (r) => <span className="font-semibold tabular-nums">{currency(r.expectedRevenue)}</span> },
    { key: 'paymentStatus', label: 'Payment', mobile: 'badge', render: (r) => <Badge value={r.paymentStatus} map={PAYMENT_STYLES} /> },
    { key: 'notes', label: 'Notes', mobile: 'hide',
      render: (r) => <span className="block max-w-[220px] truncate text-slate-500">{r.notes || '—'}</span> },
  ];

  const filters = [
    { key: 'pipelineStage', label: 'Stage', options: lists.pipelineStage || [], value: params.pipelineStage, onChange: (v) => setParam('pipelineStage', v) },
    { key: 'leadOwner', label: 'Owner', options: lists.leadOwner || [], value: params.leadOwner, onChange: (v) => setParam('leadOwner', v) },
    { key: 'priority', label: 'Priority', options: lists.priority || [], value: params.priority, onChange: (v) => setParam('priority', v) },
    { key: 'leadSource', label: 'Source', options: lists.leadSource || [], value: params.leadSource, onChange: (v) => setParam('leadSource', v) },
    { key: 'trialStatus', label: 'Trial', options: lists.trialStatus || [], value: params.trialStatus, onChange: (v) => setParam('trialStatus', v) },
    { key: 'conversionStatus', label: 'Conversion', options: lists.conversionStatus || [], value: params.conversionStatus, onChange: (v) => setParam('conversionStatus', v) },
    { key: 'paymentStatus', label: 'Payment', options: lists.paymentStatus || [], value: params.paymentStatus, onChange: (v) => setParam('paymentStatus', v) },
  ];

  const toggleSelect = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <PageHeader
        title="Master Pipeline"
        subtitle="Daily team workspace — one row per prospective student/client. Update every interaction."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => downloadFile('/leads/export', 'tutwithus-master-pipeline.csv', params)}>
              <IconDownload className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </button>
            {canWrite && (
              <button type="button" className="btn bg-white text-navy-700 hover:bg-navy-50"
                      onClick={() => { setEditing(null); setFormOpen(true); }}>
                <IconPlus className="h-4 w-4" /> New lead
              </button>
            )}
          </>
        }
      />

      <div className="card overflow-hidden">
        <FilterBar
          search={params.search || ''}
          onSearch={(v) => setParam('search', v)}
          searchPlaceholder="Search name, phone, email, lead ID…"
          views={VIEWS}
          activeView={params.view || ''}
          onView={(v) => setParam('view', v)}
          filters={filters}
          onClear={clearFilters}
        />

        {canWrite && selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-navy-50 px-4 py-2.5">
            <span className="text-sm font-semibold text-navy-700">{selected.length} selected</span>
            <select className="input w-auto py-1.5 text-xs" value={bulkStage} onChange={(e) => setBulkStage(e.target.value)}>
              <option value="">Move to stage…</option>
              {(lists.pipelineStage || []).filter((s) => s !== 'Lost').map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" className="btn-primary btn-sm" disabled={!bulkStage || bulk.isPending}
                    onClick={() => bulk.mutate({ ids: selected, patch: { pipelineStage: bulkStage } })}>
              Apply
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}

        <DataView
          columns={columns}
          rows={rows}
          loading={isLoading}
          onRowClick={(row) => navigate(`/pipeline/${row._id}`)}
          selected={selected}
          onToggleSelect={canWrite ? toggleSelect : undefined}
          emptyTitle="No leads match this view"
          emptyMessage="Adjust the filters, or add the first inquiry of the day."
          emptyAction={canWrite && (
            <button type="button" className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <IconPlus className="h-4 w-4" /> New lead
            </button>
          )}
          renderMobileActions={(row) => (
            <>
              <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => navigate(`/pipeline/${row._id}`)}>
                <IconPipeline className="h-3.5 w-3.5" /> Open
              </button>
              {canWrite && (
                <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => { setEditing(row); setFormOpen(true); }}>
                  <IconEdit className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              {row.phone && (
                <a href={`tel:${row.phone}`} className="btn-primary btn-sm flex-1">Call</a>
              )}
            </>
          )}
          footer={<Pagination meta={data?.meta} onPage={(p) => setParam('page', p)} onLimit={(l) => setParam('limit', l)} />}
        />
      </div>

      <LeadForm open={formOpen} onClose={() => setFormOpen(false)} lead={editing} />
    </>
  );
}
