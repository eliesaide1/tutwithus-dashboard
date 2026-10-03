import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '../api/endpoints.js';
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
import ProgressBar from '../components/ProgressBar.jsx';
import { Input, Select, Textarea, FormGrid, FormSection } from '../components/Field.jsx';
import { Spinner } from '../components/Loader.jsx';
import { IconPlus, IconDownload, IconEdit, IconCheck, IconMoney } from '../components/Icons.jsx';
import { currency, formatDate, relativeDay, toDateInput } from '../lib/format.js';
import { PAYMENT_STYLES, RENEWAL_STYLES, STUDENT_STATUS_STYLES } from '../lib/constants.js';

const VIEWS = [
  { value: 'active', label: 'Active' },
  { value: 'renewals', label: 'Renewals due' },
  { value: 'payment-due', label: 'Payment due' },
  { value: 'sessions-today', label: 'Sessions today' },
  { value: '', label: 'All' },
];

const EMPTY = {
  name: '', parentName: '', phone: '', email: '', gradeLevel: '', subject: '', tutor: '',
  startDate: toDateInput(new Date()), packagePlan: '', sessionsPurchased: 0, sessionsUsed: 0,
  amountPaid: 0, paymentStatus: 'Paid', nextSession: '', renewalDate: '',
  renewalStatus: 'Not Due', status: 'Active', clientNotes: '',
};

function StudentForm({ open, onClose, student }) {
  const lists = useLists();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const isEdit = Boolean(student?._id);

  useEffect(() => {
    if (!open) return;
    setForm(student
      ? { ...EMPTY, ...student,
          startDate: toDateInput(student.startDate),
          nextSession: toDateInput(student.nextSession),
          renewalDate: toDateInput(student.renewalDate) }
      : EMPTY);
  }, [open, student]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? studentsApi.update(student._id, payload) : studentsApi.create(payload)),
    onSuccess: () => {
      ['students', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(isEdit ? 'Student updated' : 'Student added');
      onClose();
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  function onSubmit(e) {
    e.preventDefault();
    const payload = { ...form };
    ['_id', 'id', 'studentId', 'leadId', 'lead', 'createdAt', 'updatedAt', '__v', 'createdBy', 'updatedBy',
     'sessionsRemaining', 'usagePercent', 'renewalDueSoon'].forEach((k) => delete payload[k]);
    mutation.mutate(payload);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${student.studentId}` : 'Add active student'}
      subtitle="Post-conversion operations: package, payment, tutor assignment, session usage and renewal."
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="student-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />} {isEdit ? 'Save changes' : 'Add student'}
          </button>
        </>
      }
    >
      <form id="student-form" onSubmit={onSubmit} className="flex flex-col gap-6">
        <FormSection title="Student">
          <FormGrid>
            <Input label="Name" required value={form.name} onChange={set('name')} />
            <Input label="Parent / Guardian" value={form.parentName} onChange={set('parentName')} />
            <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} />
            <Select label="Grade / level" placeholder="Not set" options={lists.gradeLevel || []} value={form.gradeLevel} onChange={set('gradeLevel')} />
            <Input label="Subject" value={form.subject} onChange={set('subject')} />
            <Input label="Tutor" list="student-tutors" value={form.tutor} onChange={set('tutor')} />
            <datalist id="student-tutors">{(lists.tutorsInUse || []).map((t) => <option key={t} value={t} />)}</datalist>
            <Input label="Start date" type="date" value={form.startDate} onChange={set('startDate')} />
          </FormGrid>
        </FormSection>

        <FormSection title="Package & payment">
          <FormGrid>
            <Input label="Package / plan" value={form.packagePlan} onChange={set('packagePlan')} />
            <Input label="Sessions purchased" type="number" min="0" value={form.sessionsPurchased} onChange={set('sessionsPurchased')} />
            <Input label="Sessions used" type="number" min="0" value={form.sessionsUsed} onChange={set('sessionsUsed')} />
            <Input label="Amount paid (USD)" type="number" min="0" step="10" value={form.amountPaid} onChange={set('amountPaid')} />
            <Select label="Payment status" options={lists.paymentStatus || []} value={form.paymentStatus} onChange={set('paymentStatus')} />
            <Input label="Next session" type="date" value={form.nextSession} onChange={set('nextSession')} />
          </FormGrid>
        </FormSection>

        <FormSection title="Retention">
          <FormGrid>
            <Input label="Renewal date" type="date" value={form.renewalDate} onChange={set('renewalDate')} />
            <Select label="Renewal status" options={lists.renewalStatus || []} value={form.renewalStatus} onChange={set('renewalStatus')} />
            <Select label="Student status" options={lists.studentStatus || []} value={form.status} onChange={set('status')} />
            <Textarea className="sm:col-span-2" label="Client notes" value={form.clientNotes} onChange={set('clientNotes')} />
          </FormGrid>
        </FormSection>
      </form>
    </Modal>
  );
}

function RenewModal({ student, open, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ sessionsPurchased: 12, amountPaid: '', packagePlan: '', renewalDate: '', paymentStatus: 'Paid' });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload) => studentsApi.renew(student._id, payload),
    onSuccess: () => {
      ['students', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success('Package renewed');
      onClose();
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  if (!student) return null;

  return (
    <Modal
      open={open} onClose={onClose} size="sm"
      title="Renew package" subtitle={`${student.studentId} · ${student.name}`}
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="renew-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />} Renew
          </button>
        </>
      }
    >
      <form id="renew-form" className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}>
        <Input label="Sessions purchased" type="number" min="1" required value={form.sessionsPurchased} onChange={set('sessionsPurchased')} />
        <Input label="Amount paid (USD)" type="number" min="0" step="10" value={form.amountPaid} onChange={set('amountPaid')} />
        <Input label="Package / plan" value={form.packagePlan} onChange={set('packagePlan')} placeholder="12-session package" />
        <Input label="Next renewal date" type="date" value={form.renewalDate} onChange={set('renewalDate')} />
        <Select label="Payment status" options={['Paid', 'Partially Paid', 'Invoice Sent']} value={form.paymentStatus} onChange={set('paymentStatus')} />
      </form>
    </Modal>
  );
}

export default function Students() {
  const lists = useLists();
  const toast = useToast();
  const { canWrite } = useAuth();
  const queryClient = useQueryClient();
  const { params, setParam, clearFilters } = useListParams({ page: '1', limit: '25', view: 'active' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [renewing, setRenewing] = useState(null);

  const search = useDebounce(params.search || '', 350);

  const { data, isLoading } = useQuery({
    queryKey: ['students', { ...params, search }],
    queryFn: () => studentsApi.list({ ...params, search }),
    keepPreviousData: true,
  });

  const logSession = useMutation({
    mutationFn: (id) => studentsApi.logSession(id, {}),
    onSuccess: () => {
      ['students', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success('Session logged');
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  const columns = [
    { key: 'studentId', label: 'Student ID', mobile: 'subtitle',
      render: (r) => <span className="font-mono text-xs font-semibold text-navy-600">{r.studentId}</span> },
    { key: 'leadId', label: 'Lead ID', mobile: 'hide',
      render: (r) => <span className="font-mono text-xs text-slate-500">{r.leadId || '—'}</span> },
    { key: 'name', label: 'Student', mobile: 'title' },
    { key: 'gradeLevel', label: 'Grade / Level', render: (r) => r.gradeLevel || '—' },
    { key: 'subject', label: 'Subject', render: (r) => r.subject || '—' },
    { key: 'tutor', label: 'Tutor', render: (r) => r.tutor || '—' },
    { key: 'startDate', label: 'Start Date', render: (r) => formatDate(r.startDate, { withYear: false }) },
    { key: 'packagePlan', label: 'Package / Plan', render: (r) => r.packagePlan || '—' },
    { key: 'sessions', label: 'Sessions', className: 'min-w-[140px]',
      render: (r) => (
        <ProgressBar
          value={r.sessionsUsed} max={r.sessionsPurchased || 0}
          tone={r.sessionsRemaining <= 2 ? 'bg-amber-500' : 'bg-navy-500'}
          className="min-w-[120px]"
          label=""
        />
      ) },
    { key: 'sessionsRemaining', label: 'Remaining',
      render: (r) => <span className={`font-semibold tabular-nums ${r.sessionsRemaining <= 2 ? 'text-amber-600' : ''}`}>{r.sessionsRemaining}</span> },
    { key: 'amountPaid', label: 'Amount Paid', render: (r) => <span className="tabular-nums">{currency(r.amountPaid)}</span> },
    { key: 'paymentStatus', label: 'Payment', mobile: 'badge', render: (r) => <Badge value={r.paymentStatus} map={PAYMENT_STYLES} /> },
    { key: 'nextSession', label: 'Next Session', render: (r) => relativeDay(r.nextSession) },
    { key: 'renewalStatus', label: 'Renewal', mobile: 'badge', render: (r) => <Badge value={r.renewalStatus} map={RENEWAL_STYLES} /> },
    { key: 'status', label: 'Status', mobile: 'badge', render: (r) => <Badge value={r.status} map={STUDENT_STATUS_STYLES} /> },
    { key: 'clientNotes', label: 'Client Notes', mobile: 'hide',
      render: (r) => <span className="block max-w-[220px] truncate text-slate-600">{r.clientNotes || '—'}</span> },
  ];

  const filters = [
    { key: 'status', label: 'Status', options: lists.studentStatus || [], value: params.status, onChange: (v) => setParam('status', v) },
    { key: 'renewalStatus', label: 'Renewal', options: lists.renewalStatus || [], value: params.renewalStatus, onChange: (v) => setParam('renewalStatus', v) },
    { key: 'paymentStatus', label: 'Payment', options: lists.paymentStatus || [], value: params.paymentStatus, onChange: (v) => setParam('paymentStatus', v) },
    { key: 'tutor', label: 'Tutor', options: lists.tutorsInUse || [], value: params.tutor, onChange: (v) => setParam('tutor', v) },
  ];

  return (
    <>
      <PageHeader
        title="Active Students & Retention"
        subtitle="Post-conversion operations: package, payment, tutor assignment, session usage and renewal."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => downloadFile('/students/export', 'tutwithus-active-students.csv', params)}>
              <IconDownload className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </button>
            {canWrite && (
              <button type="button" className="btn bg-white text-navy-700 hover:bg-navy-50" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <IconPlus className="h-4 w-4" /> Add student
              </button>
            )}
          </>
        }
      />

      <div className="card overflow-hidden">
        <FilterBar
          search={params.search || ''}
          onSearch={(v) => setParam('search', v)}
          searchPlaceholder="Search student, tutor, student ID…"
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
          emptyTitle="No students in this view"
          emptyMessage="Students appear here after a lead is converted with payment confirmed."
          onRowClick={canWrite ? (row) => { setEditing(row); setFormOpen(true); } : undefined}
          renderMobileActions={(row) => (
            <>
              <button type="button" className="btn-primary btn-sm flex-1" disabled={logSession.isPending || row.sessionsRemaining === 0}
                      onClick={() => logSession.mutate(row._id)}>
                <IconCheck className="h-3.5 w-3.5" /> Log session
              </button>
              <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => setRenewing(row)}>
                <IconMoney className="h-3.5 w-3.5" /> Renew
              </button>
              <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => { setEditing(row); setFormOpen(true); }}>
                <IconEdit className="h-3.5 w-3.5" /> Edit
              </button>
            </>
          )}
          footer={<Pagination meta={data?.meta} onPage={(p) => setParam('page', p)} onLimit={(l) => setParam('limit', l)} />}
        />
      </div>

      <StudentForm open={formOpen} onClose={() => setFormOpen(false)} student={editing} />
      <RenewModal student={renewing} open={Boolean(renewing)} onClose={() => setRenewing(null)} />
    </>
  );
}
