import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../api/endpoints.js';
import { useLists } from '../context/ListsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Modal from './Modal.jsx';
import { Input, Select, Textarea, FormGrid, FormSection } from './Field.jsx';
import { Spinner } from './Loader.jsx';
import { toDateInput } from '../lib/format.js';

const EMPTY = {
  studentName: '', parentName: '', phone: '', email: '',
  dateReceived: toDateInput(new Date()), leadSource: 'Website', gradeLevel: '', subject: '', needSummary: '',
  leadOwner: 'Other', priority: 'Medium', pipelineStage: 'New Lead',
  lastContactDate: '', nextAction: '', nextFollowUp: '',
  trialStatus: 'To Schedule', trialDateTime: '', assignedTutor: '',
  conversionStatus: 'Not Started', expectedRevenue: '', paymentStatus: 'Not Applicable',
  lossReason: '', notes: '',
};

/** Create / edit a Master Pipeline row — every column of the sheet is here. */
export default function LeadForm({ open, onClose, lead }) {
  const lists = useLists();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const isEdit = Boolean(lead?._id);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(lead
      ? {
          ...EMPTY,
          ...lead,
          dateReceived: toDateInput(lead.dateReceived),
          lastContactDate: toDateInput(lead.lastContactDate),
          nextFollowUp: toDateInput(lead.nextFollowUp),
          trialDateTime: toDateInput(lead.trialDateTime),
          expectedRevenue: lead.expectedRevenue ?? '',
        }
      : EMPTY);
  }, [open, lead]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? leadsApi.update(lead._id, payload) : leadsApi.create(payload)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead?._id] });
      toast.success(isEdit ? `${res.data.leadId} updated` : `${res.data.leadId} added to the pipeline`);
      onClose();
    },
    onError: (err) => {
      const fieldErrors = {};
      for (const detail of err.fieldErrors || []) fieldErrors[detail.field] = detail.message;
      setErrors(fieldErrors);
      toast.error(err.friendlyMessage);
    },
  });

  function onSubmit(e) {
    e.preventDefault();
    // Operating rule 6 — a Lost lead needs a reason before it can be saved.
    if (form.pipelineStage === 'Lost' && !form.lossReason) {
      setErrors({ lossReason: 'Required when the stage is Lost' });
      return;
    }
    const payload = { ...form };
    delete payload._id; delete payload.leadId; delete payload.id;
    delete payload.createdAt; delete payload.updatedAt; delete payload.__v;
    delete payload.daysSinceContact; delete payload.followUpStatus; delete payload.isOpen;
    delete payload.createdBy; delete payload.updatedBy; delete payload.convertedAt; delete payload.lostAt;
    if (payload.expectedRevenue === '') payload.expectedRevenue = 0;
    mutation.mutate(payload);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${lead.leadId}` : 'New lead'}
      subtitle={isEdit ? lead.studentName : 'Log the inquiry on the day it arrives (rule 1)'}
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="lead-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />}
            {isEdit ? 'Save changes' : 'Add lead'}
          </button>
        </>
      }
    >
      <form id="lead-form" onSubmit={onSubmit} className="flex flex-col gap-6">
        <FormSection title="Contact">
          <FormGrid>
            <Input label="Student" required value={form.studentName} onChange={set('studentName')} error={errors.studentName} placeholder="Full name" />
            <Input label="Parent / Guardian" value={form.parentName} onChange={set('parentName')} placeholder="Who we speak to" />
            <Input label="Phone / WhatsApp" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="+971…" />
            <Input label="Email" type="email" inputMode="email" value={form.email} onChange={set('email')} error={errors.email} />
          </FormGrid>
        </FormSection>

        <FormSection title="Request">
          <FormGrid>
            <Input label="Date received" type="date" value={form.dateReceived} onChange={set('dateReceived')} />
            <Select label="Lead source" options={lists.leadSource || []} value={form.leadSource} onChange={set('leadSource')} />
            <Select label="Grade / level" options={lists.gradeLevel || []} placeholder="Not set" value={form.gradeLevel} onChange={set('gradeLevel')} />
            <Input label="Subject" list="subject-options" value={form.subject} onChange={set('subject')} placeholder="Mathematics" />
            <datalist id="subject-options">
              {(lists.subject || []).map((s) => <option key={s} value={s} />)}
            </datalist>
            <Textarea className="sm:col-span-2" label="What they need" rows={2} value={form.needSummary} onChange={set('needSummary')}
                      placeholder="Exam prep, weekly support, specific topics…" />
          </FormGrid>
        </FormSection>

        <FormSection title="Ownership & stage" description="Rule 2: every open lead needs an owner, a next action and a follow-up date.">
          <FormGrid>
            <Select label="Lead owner" options={lists.leadOwner || []} value={form.leadOwner} onChange={set('leadOwner')} />
            <Select label="Priority" options={lists.priority || []} value={form.priority} onChange={set('priority')} />
            <Select label="Pipeline stage" options={lists.pipelineStage || []} value={form.pipelineStage} onChange={set('pipelineStage')} />
            <Select label="Conversion status" options={lists.conversionStatus || []} value={form.conversionStatus} onChange={set('conversionStatus')} />
            <Input label="Last contact date" type="date" value={form.lastContactDate} onChange={set('lastContactDate')} />
            <Input label="Next follow-up" type="date" value={form.nextFollowUp} onChange={set('nextFollowUp')}
                   hint={!form.nextFollowUp ? 'Leave empty and this lead shows as "Missing Date"' : undefined} />
            <Input className="sm:col-span-2" label="Next action" value={form.nextAction} onChange={set('nextAction')}
                   placeholder="Call parent to confirm the trial slot" />
            {form.pipelineStage === 'Lost' && (
              <Select className="sm:col-span-2" label="Loss reason" required options={lists.lossReason || []} placeholder="Select a reason"
                      value={form.lossReason} onChange={set('lossReason')} error={errors.lossReason} />
            )}
          </FormGrid>
        </FormSection>

        <FormSection title="Trial">
          <FormGrid>
            <Select label="Trial status" options={lists.trialStatus || []} value={form.trialStatus} onChange={set('trialStatus')} />
            <Input label="Trial date" type="date" value={form.trialDateTime} onChange={set('trialDateTime')} />
            <Input className="sm:col-span-2" label="Assigned tutor" list="tutor-options" value={form.assignedTutor} onChange={set('assignedTutor')} />
            <datalist id="tutor-options">
              {(lists.tutorsInUse || []).map((t) => <option key={t} value={t} />)}
            </datalist>
          </FormGrid>
        </FormSection>

        <FormSection title="Commercials">
          <FormGrid>
            <Input label="Expected revenue (USD)" type="number" inputMode="decimal" min="0" step="10"
                   value={form.expectedRevenue} onChange={set('expectedRevenue')} />
            <Select label="Payment status" options={lists.paymentStatus || []} value={form.paymentStatus} onChange={set('paymentStatus')} />
            <Textarea className="sm:col-span-2" label="Notes" value={form.notes} onChange={set('notes')} rows={3} />
          </FormGrid>
        </FormSection>
      </form>
    </Modal>
  );
}
