import { useState } from 'react';
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
import Pagination from '../components/Pagination.jsx';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { SkeletonRows } from '../components/Loader.jsx';
import { StudentForm, EnrollmentForm, RenewForm } from '../components/StudentForms.jsx';
import {
  IconPlus, IconDownload, IconEdit, IconCheck, IconMoney, IconTrash,
  IconChevronRight, IconStudents,
} from '../components/Icons.jsx';
import { currency, formatDate, relativeDay, initials } from '../lib/format.js';
import { PAYMENT_STYLES, RENEWAL_STYLES, STUDENT_STATUS_STYLES } from '../lib/constants.js';

const VIEWS = [
  { value: 'active', label: 'Active' },
  { value: 'renewals', label: 'Renewals due' },
  { value: 'payment-due', label: 'Payment due' },
  { value: 'sessions-today', label: 'Sessions today' },
  { value: '', label: 'All' },
];

/** The per-subject detail shown when a student row is expanded. */
function EnrollmentRow({ student, enrollment, canWrite, onEdit, onRenew, onRemove, onLogSession, busy }) {
  const remaining = Math.max(0, (enrollment.sessionsPurchased || 0) - (enrollment.sessionsUsed || 0));
  const low = enrollment.sessionsPurchased > 0 && remaining <= 2;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3
                    lg:flex-row lg:items-center lg:gap-4 lg:pl-16">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-navy-800">{enrollment.subject}</span>
          {enrollment.status !== 'Active' && <Badge value={enrollment.status} map={STUDENT_STATUS_STYLES} />}
        </div>
        <span className="truncate text-xs text-slate-500">
          {enrollment.tutor || 'No tutor assigned'}
          {enrollment.packagePlan ? ` · ${enrollment.packagePlan}` : ''}
          {enrollment.startDate ? ` · from ${formatDate(enrollment.startDate, { withYear: false })}` : ''}
        </span>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-1 lg:w-44">
        <ProgressBar
          value={enrollment.sessionsUsed || 0}
          max={enrollment.sessionsPurchased || 0}
          tone={low ? 'bg-amber-500' : 'bg-navy-500'}
          label="Sessions"
        />
        <span className={`text-[11px] ${low ? 'font-semibold text-amber-600' : 'text-slate-500'}`}>
          {remaining} remaining
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 lg:w-64">
        <Badge value={enrollment.paymentStatus} map={PAYMENT_STYLES} />
        <Badge value={enrollment.renewalStatus} map={RENEWAL_STYLES} />
        {enrollment.amountPaid > 0 && (
          <span className="text-xs font-semibold tabular-nums text-navy-700">{currency(enrollment.amountPaid)}</span>
        )}
      </div>

      <div className="shrink-0 text-xs text-slate-500 lg:w-28">
        {enrollment.nextSession ? relativeDay(enrollment.nextSession) : 'No session set'}
      </div>

      {canWrite && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn-secondary btn-sm" disabled={busy || remaining === 0}
                  onClick={() => onLogSession(enrollment)} title="Log a delivered session">
            <IconCheck className="h-3.5 w-3.5" /> Session
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => onRenew(enrollment)}>
            <IconMoney className="h-3.5 w-3.5" /> Renew
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => onEdit(enrollment)} aria-label="Edit subject">
            <IconEdit className="h-3.5 w-3.5" />
          </button>
          {student.enrollments.length > 1 && (
            <button type="button" className="btn-ghost btn-sm text-rose-600" onClick={() => onRemove(enrollment)} aria-label="Remove subject">
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Students() {
  const lists = useLists();
  const toast = useToast();
  const { canWrite, isManager } = useAuth();
  const qc = useQueryClient();
  const { params, setParam, clearFilters } = useListParams({ page: '1', limit: '25', view: 'active' });

  const [expanded, setExpanded] = useState(() => new Set());
  const [personForm, setPersonForm] = useState({ open: false, student: null });
  const [subjectForm, setSubjectForm] = useState({ open: false, student: null, enrollment: null });
  const [renewForm, setRenewForm] = useState({ open: false, student: null, enrollment: null });
  const [removing, setRemoving] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const search = useDebounce(params.search || '', 350);

  const { data, isLoading } = useQuery({
    queryKey: ['students', { ...params, search }],
    queryFn: () => studentsApi.list({ ...params, search }),
    keepPreviousData: true,
  });

  const invalidate = () => ['students', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const logSession = useMutation({
    mutationFn: ({ student, enrollment }) => studentsApi.logSession(student._id, enrollment._id),
    onSuccess: (_r, v) => { invalidate(); toast.success(`Session logged for ${v.enrollment.subject}`); },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  const removeEnrollment = useMutation({
    mutationFn: ({ student, enrollment }) => studentsApi.removeEnrollment(student._id, enrollment._id),
    onSuccess: () => { invalidate(); setRemoving(null); toast.success('Subject removed'); },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  const deleteStudent = useMutation({
    mutationFn: (student) => studentsApi.remove(student._id),
    onSuccess: () => { invalidate(); setDeleting(null); toast.success('Student removed'); },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const rows = data?.data || [];

  const filters = [
    { key: 'status', label: 'Status', options: lists.studentStatus || [], value: params.status, onChange: (v) => setParam('status', v) },
    { key: 'renewalStatus', label: 'Renewal', options: lists.renewalStatus || [], value: params.renewalStatus, onChange: (v) => setParam('renewalStatus', v) },
    { key: 'paymentStatus', label: 'Payment', options: lists.paymentStatus || [], value: params.paymentStatus, onChange: (v) => setParam('paymentStatus', v) },
    { key: 'tutor', label: 'Tutor', options: lists.tutorsInUse || [], value: params.tutor, onChange: (v) => setParam('tutor', v) },
    { key: 'subject', label: 'Subject', options: lists.subjectsInUse || [], value: params.subject, onChange: (v) => setParam('subject', v) },
  ];

  return (
    <>
      <PageHeader
        title="Active Students & Retention"
        subtitle="One record per student. Each subject carries its own tutor, package, payment and renewal."
        actions={
          <>
            <button type="button" className="btn-secondary"
                    onClick={() => downloadFile('/students/export', 'tutwithus-active-students.csv', params)}>
              <IconDownload className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </button>
            {canWrite && (
              <button type="button" className="btn bg-white text-navy-700 hover:bg-navy-50"
                      onClick={() => setPersonForm({ open: true, student: null })}>
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
          searchPlaceholder="Search student, tutor, subject, ID…"
          views={VIEWS}
          activeView={params.view ?? ''}
          onView={(v) => setParam('view', v)}
          filters={filters}
          onClear={clearFilters}
        />

        {isLoading ? (
          <SkeletonRows rows={5} />
        ) : !rows.length ? (
          <EmptyState
            icon={IconStudents}
            title="No students in this view"
            message="Students appear here once a lead is converted with payment confirmed."
          />
        ) : (
          <div className="flex flex-col">
            {/* column headings — desktop only */}
            <div className="hidden bg-navy-600 px-4 py-2.5 lg:flex lg:items-center lg:gap-4">
              <span className="w-6" />
              <span className="w-24 text-[11px] font-bold uppercase tracking-wide text-white">Student ID</span>
              <span className="flex-1 text-[11px] font-bold uppercase tracking-wide text-white">Student</span>
              <span className="hidden w-32 text-[11px] font-bold uppercase tracking-wide text-white xl:block">Grade / Level</span>
              <span className="w-24 text-[11px] font-bold uppercase tracking-wide text-white">Subjects</span>
              <span className="w-20 text-[11px] font-bold uppercase tracking-wide text-white">Sessions</span>
              <span className="w-52 text-[11px] font-bold uppercase tracking-wide text-white">Payment / Renewal</span>
              <span className="w-20 text-[11px] font-bold uppercase tracking-wide text-white">Status</span>
              <span className="w-20" />
            </div>

            {rows.map((student) => {
              const isOpen = expanded.has(student._id);
              const enrollments = student.enrollments || [];
              return (
                <section key={student._id} className="border-b border-slate-200 last:border-0">
                  {/* ---------- the person ---------- */}
                  <button
                    type="button"
                    onClick={() => toggle(student._id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-sky-50 lg:items-center lg:gap-4"
                  >
                    <IconChevronRight
                      className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform lg:mt-0 ${isOpen ? 'rotate-90' : ''}`}
                    />

                    <span className="hidden w-24 shrink-0 font-mono text-xs font-semibold text-navy-600 lg:block">
                      {student.studentId}
                    </span>

                    <span className="flex min-w-0 flex-1 items-center gap-3 lg:min-w-[200px]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy-600 lg:hidden">
                        {initials(student.name)}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold text-navy-800">{student.name}</span>
                        <span className="truncate text-xs text-slate-500">
                          <span className="lg:hidden">{student.studentId} · </span>
                          {student.parentName || student.phone || '—'}
                        </span>
                      </span>
                    </span>

                    <span className="hidden w-32 shrink-0 truncate text-sm text-navy-800 xl:block">{student.gradeLevel || '—'}</span>

                    <span className="hidden w-24 shrink-0 lg:block">
                      <span className="badge bg-navy-50 text-navy-700">
                        {enrollments.length} {enrollments.length === 1 ? 'subject' : 'subjects'}
                      </span>
                    </span>

                    <span className="hidden w-20 shrink-0 text-sm font-semibold tabular-nums text-navy-800 lg:block">
                      {student.sessionsUsed}/{student.sessionsPurchased}
                    </span>

                    <span className="hidden w-52 shrink-0 flex-wrap items-center gap-1.5 lg:flex">
                      <Badge value={student.paymentStatus} map={PAYMENT_STYLES} />
                      <Badge value={student.renewalStatus} map={RENEWAL_STYLES} />
                    </span>

                    <span className="hidden w-20 shrink-0 lg:block">
                      <Badge value={student.status} map={STUDENT_STATUS_STYLES} />
                    </span>

                    {/* compact summary for phones */}
                    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 lg:hidden">
                      <span className="badge bg-navy-50 text-navy-700">{enrollments.length}</span>
                      <Badge value={student.status} map={STUDENT_STATUS_STYLES} />
                    </span>

                    {canWrite && (
                      <span className="hidden w-20 shrink-0 justify-end gap-1 lg:flex">
                        <span
                          role="button"
                          tabIndex={0}
                          className="btn-ghost btn-sm"
                          onClick={(e) => { e.stopPropagation(); setPersonForm({ open: true, student }); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setPersonForm({ open: true, student }); } }}
                          aria-label="Edit student"
                        >
                          <IconEdit className="h-3.5 w-3.5" />
                        </span>
                        {isManager && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="btn-ghost btn-sm text-rose-600"
                            onClick={(e) => { e.stopPropagation(); setDeleting(student); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDeleting(student); } }}
                            aria-label="Delete student"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </span>
                    )}
                  </button>

                  {/* ---------- their subjects ---------- */}
                  {isOpen && (
                    <div className="animate-fade-in">
                      {enrollments.length === 0 && (
                        <p className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500 lg:pl-16">
                          No subjects recorded for this student yet.
                        </p>
                      )}
                      {enrollments.map((enrollment) => (
                        <EnrollmentRow
                          key={enrollment._id}
                          student={student}
                          enrollment={enrollment}
                          canWrite={canWrite}
                          busy={logSession.isPending}
                          onLogSession={(e) => logSession.mutate({ student, enrollment: e })}
                          onRenew={(e) => setRenewForm({ open: true, student, enrollment: e })}
                          onEdit={(e) => setSubjectForm({ open: true, student, enrollment: e })}
                          onRemove={(e) => setRemoving({ student, enrollment: e })}
                        />
                      ))}

                      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 lg:pl-16">
                        {canWrite && (
                          <button type="button" className="btn-secondary btn-sm"
                                  onClick={() => setSubjectForm({ open: true, student, enrollment: null })}>
                            <IconPlus className="h-3.5 w-3.5" /> Add subject
                          </button>
                        )}
                        <button type="button" className="btn-ghost btn-sm lg:hidden"
                                onClick={() => setPersonForm({ open: true, student })}>
                          <IconEdit className="h-3.5 w-3.5" /> Edit student
                        </button>
                        {student.clientNotes && (
                          <p className="w-full pt-1 text-xs text-slate-500">{student.clientNotes}</p>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}

            <Pagination meta={data?.meta} onPage={(p) => setParam('page', p)} onLimit={(l) => setParam('limit', l)} />
          </div>
        )}
      </div>

      <StudentForm open={personForm.open} student={personForm.student}
                   onClose={() => setPersonForm({ open: false, student: null })} />
      <EnrollmentForm open={subjectForm.open} student={subjectForm.student} enrollment={subjectForm.enrollment}
                      onClose={() => setSubjectForm({ open: false, student: null, enrollment: null })} />
      <RenewForm open={renewForm.open} student={renewForm.student} enrollment={renewForm.enrollment}
                 onClose={() => setRenewForm({ open: false, student: null, enrollment: null })} />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removeEnrollment.mutate(removing)}
        loading={removeEnrollment.isPending}
        title={`Remove ${removing?.enrollment?.subject}?`}
        message={`This removes the ${removing?.enrollment?.subject} enrollment from ${removing?.student?.name}, including its package and session history. Their other subjects are untouched.`}
        confirmLabel="Remove subject"
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteStudent.mutate(deleting)}
        loading={deleteStudent.isPending}
        title={`Delete ${deleting?.studentId}?`}
        message={`This removes ${deleting?.name} and all ${deleting?.enrollments?.length || 0} of their subjects. This cannot be undone.`}
        confirmLabel="Delete student"
      />
    </>
  );
}
