import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLists } from '../context/ListsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SectionCard from '../components/SectionCard.jsx';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import LeadForm from '../components/LeadForm.jsx';
import TrialForm from '../components/TrialForm.jsx';
import FollowupForm from '../components/FollowupForm.jsx';
import ConvertForm from '../components/ConvertForm.jsx';
import { PageLoader } from '../components/Loader.jsx';
import { currency, formatDate, formatDateTime, relativeDay } from '../lib/format.js';
import {
  STAGE_STYLES, PRIORITY_STYLES, PAYMENT_STYLES, FOLLOWUP_STATUS_STYLES,
  SESSION_STYLES, ACTION_STATUS_STYLES,
} from '../lib/constants.js';
import {
  IconEdit, IconTrash, IconPhone, IconTrial, IconMoney, IconChevronLeft,
  IconWhatsapp, IconClock, IconStudents,
} from '../components/Icons.jsx';

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-navy-800">{children ?? '—'}</dd>
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lists = useLists();
  const toast = useToast();
  const { canWrite, isManager } = useAuth();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.get(id),
  });

  const stageMutation = useMutation({
    mutationFn: (payload) => leadsApi.changeStage(id, payload),
    onSuccess: () => {
      ['lead', 'leads', 'dashboard'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success('Stage updated');
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  const deleteMutation = useMutation({
    mutationFn: () => leadsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead removed');
      navigate('/pipeline');
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  if (isLoading) return <PageLoader label="Loading lead…" />;
  if (error) return <EmptyState title="Lead not found" message={error.friendlyMessage} />;

  const { lead, trials, followups, student, activity } = data.data;
  const whatsappNumber = (lead.phone || '').replace(/[^\d]/g, '');

  return (
    <>
      <PageHeader
        title={lead.studentName}
        subtitle={`${lead.leadId} · received ${formatDate(lead.dateReceived)} · owner ${lead.leadOwner}`}
        actions={
          <>
            <Link to="/pipeline" className="btn-secondary">
              <IconChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Pipeline</span>
            </Link>
            {canWrite && (
              <button type="button" className="btn bg-white text-navy-700 hover:bg-navy-50" onClick={() => setEditOpen(true)}>
                <IconEdit className="h-4 w-4" /> Edit
              </button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge value={lead.pipelineStage} map={STAGE_STYLES} />
          <Badge value={lead.priority} map={PRIORITY_STYLES} />
          <Badge value={lead.followUpStatus} map={FOLLOWUP_STATUS_STYLES} />
          <Badge value={lead.paymentStatus} map={PAYMENT_STYLES} />
          {lead.lossReason && <Badge value={`Lost: ${lead.lossReason}`} fallback="bg-rose-100 text-rose-700" />}
        </div>
      </PageHeader>

      {/* quick actions — sticky and thumb-sized on mobile */}
      <div className="flex flex-wrap gap-2">
        {lead.phone && (
          <>
            <a href={`tel:${lead.phone}`} className="btn-primary flex-1 sm:flex-none"><IconPhone className="h-4 w-4" /> Call</a>
            <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="btn-secondary flex-1 sm:flex-none">
              <IconWhatsapp className="h-4 w-4" /> WhatsApp
            </a>
          </>
        )}
        {canWrite && (
          <>
            <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => setFollowupOpen(true)}>
              <IconClock className="h-4 w-4" /> Add action
            </button>
            <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => setTrialOpen(true)}>
              <IconTrial className="h-4 w-4" /> Book trial
            </button>
            {!student && (
              <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => setConvertOpen(true)}>
                <IconMoney className="h-4 w-4" /> Convert
              </button>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {canWrite && (
            <SectionCard title="Move stage" subtitle="Rule 6: marking a lead Lost requires a reason">
              <div className="flex flex-wrap gap-2">
                {(lists.pipelineStage || []).map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    disabled={stageMutation.isPending || stage === lead.pipelineStage}
                    onClick={() => {
                      if (stage === 'Lost' && !lead.lossReason) {
                        toast.error('Open Edit and set a Loss Reason before marking this lead Lost');
                        return;
                      }
                      stageMutation.mutate({ pipelineStage: stage });
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      stage === lead.pipelineStage
                        ? 'bg-navy-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-navy-100 hover:text-navy-700'
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Trial sessions" subtitle={`${trials.length} session(s)`} bodyClassName="p-0">
            {trials.length === 0 ? (
              <EmptyState icon={IconTrial} title="No trials yet"
                          message="Book the first trial once the lead is qualified."
                          action={canWrite && <button type="button" className="btn-primary" onClick={() => setTrialOpen(true)}>Book trial</button>} />
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100">
                {trials.map((t) => (
                  <li key={t._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold text-navy-800">
                        {t.trialId} · {formatDate(t.scheduledDate)} {t.startTime && `· ${t.startTime}`}
                      </span>
                      <span className="truncate text-xs text-slate-500">
                        {t.subject || '—'} · {t.tutor || 'Unassigned'} · {t.durationMinutes} min
                      </span>
                      {t.tutorFeedback && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{t.tutorFeedback}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Badge value={t.sessionStatus} map={SESSION_STYLES} />
                      <Badge value={t.outcome} fallback="bg-slate-100 text-slate-600" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Follow-up actions" subtitle={`${followups.length} action(s)`} bodyClassName="p-0">
            {followups.length === 0 ? (
              <EmptyState icon={IconPhone} title="No actions logged"
                          message="Every open lead should carry a next step."
                          action={canWrite && <button type="button" className="btn-primary" onClick={() => setFollowupOpen(true)}>Add action</button>} />
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100">
                {followups.map((f) => (
                  <li key={f._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold text-navy-800">{f.actionType} · {relativeDay(f.dueDate)}</span>
                      <span className="truncate text-xs text-slate-500">
                        {f.owner} · {f.attempts} attempt(s){f.lastAttempt ? ` · last ${formatDate(f.lastAttempt)}` : ''}
                      </span>
                      {f.result && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{f.result}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge value={f.status} map={ACTION_STATUS_STYLES} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Activity" bodyClassName="p-0">
            {activity.length === 0 ? (
              <EmptyState title="No changes recorded yet" />
            ) : (
              <ul className="flex max-h-96 flex-col divide-y divide-slate-100 overflow-y-auto">
                {activity.map((log) => (
                  <li key={log._id} className="flex flex-col gap-1 px-4 py-3">
                    <span className="text-sm text-navy-800">{log.summary}</span>
                    <span className="text-xs text-slate-400">{log.userName || 'System'} · {formatDateTime(log.createdAt)}</span>
                    {log.changes?.length > 0 && (
                      <ul className="mt-1 flex flex-wrap gap-1">
                        {log.changes.map((c, i) => (
                          <li key={i} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                            {c.field}: {String(c.from ?? '—').slice(0, 24)} → {String(c.to ?? '—').slice(0, 24)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard title="Lead details">
            <dl className="flex flex-col">
              <Row label="Parent">{lead.parentName}</Row>
              <Row label="Phone">{lead.phone}</Row>
              <Row label="Email">{lead.email}</Row>
              <Row label="Source">{lead.leadSource}</Row>
              <Row label="Grade">{lead.gradeLevel}</Row>
              <Row label="Subject">{lead.subject}</Row>
              <Row label="Need"><span className="block max-w-[220px] text-right">{lead.needSummary}</span></Row>
            </dl>
          </SectionCard>

          <SectionCard title="Follow-up">
            <dl className="flex flex-col">
              <Row label="Last contact">{formatDate(lead.lastContactDate)}</Row>
              <Row label="Days since">{lead.daysSinceContact ?? '—'}</Row>
              <Row label="Next action">{lead.nextAction}</Row>
              <Row label="Next follow-up">{relativeDay(lead.nextFollowUp)}</Row>
              <Row label="Status"><Badge value={lead.followUpStatus} map={FOLLOWUP_STATUS_STYLES} /></Row>
            </dl>
          </SectionCard>

          <SectionCard title="Commercials">
            <dl className="flex flex-col">
              <Row label="Expected revenue"><span className="tabular-nums">{currency(lead.expectedRevenue)}</span></Row>
              <Row label="Conversion">{lead.conversionStatus}</Row>
              <Row label="Payment"><Badge value={lead.paymentStatus} map={PAYMENT_STYLES} /></Row>
              <Row label="Trial status">{lead.trialStatus}</Row>
              <Row label="Trial date">{formatDate(lead.trialDateTime)}</Row>
              <Row label="Tutor">{lead.assignedTutor}</Row>
            </dl>
          </SectionCard>

          {student && (
            <SectionCard title="Active student record">
              <Link to="/students" className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 hover:bg-emerald-100">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <IconStudents className="h-5 w-5" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-emerald-800">{student.studentId}</span>
                  <span className="truncate text-xs text-emerald-700">
                    {student.packagePlan || 'Package'} · {student.sessionsRemaining} session(s) left
                  </span>
                </div>
              </Link>
            </SectionCard>
          )}

          {lead.notes && (
            <SectionCard title="Notes">
              <p className="whitespace-pre-wrap text-sm text-slate-600">{lead.notes}</p>
            </SectionCard>
          )}

          {isManager && (
            <button type="button" className="btn-danger" onClick={() => setDeleteOpen(true)}>
              <IconTrash className="h-4 w-4" /> Delete lead
            </button>
          )}
        </div>
      </div>

      <LeadForm open={editOpen} onClose={() => setEditOpen(false)} lead={lead} />
      <TrialForm open={trialOpen} onClose={() => setTrialOpen(false)} presetLead={lead._id} />
      <FollowupForm open={followupOpen} onClose={() => setFollowupOpen(false)} presetLead={lead._id} />
      <ConvertForm open={convertOpen} onClose={() => setConvertOpen(false)} lead={lead} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title={`Delete ${lead.leadId}?`}
        message="This removes the lead together with its trials and follow-up actions. This cannot be undone."
        confirmLabel="Delete lead"
      />
    </>
  );
}
