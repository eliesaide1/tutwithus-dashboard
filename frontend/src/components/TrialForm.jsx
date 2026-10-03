import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trialsApi } from '../api/endpoints.js';
import { useLists } from '../context/ListsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Modal from './Modal.jsx';
import LeadPicker from './LeadPicker.jsx';
import { Input, Select, Textarea, FormGrid, FormSection } from './Field.jsx';
import { Spinner } from './Loader.jsx';
import { toDateInput } from '../lib/format.js';

const EMPTY = {
  lead: '', subject: '', tutor: '', scheduledDate: toDateInput(new Date()), startTime: '17:00',
  durationMinutes: 45, sessionStatus: 'Scheduled', adminReviewer: '',
  tutorFeedback: '', clientFeedback: '', strongPoints: '', areasToImprove: '',
  commercialFollowUpOwner: '', followUpDeadline: '', outcome: 'Pending Review', nextStep: '', rating: '',
};

export default function TrialForm({ open, onClose, trial, presetLead }) {
  const lists = useLists();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const isEdit = Boolean(trial?._id);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(trial
      ? { ...EMPTY, ...trial, lead: trial.lead?._id || trial.lead,
          scheduledDate: toDateInput(trial.scheduledDate),
          followUpDeadline: toDateInput(trial.followUpDeadline),
          rating: trial.rating ?? '' }
      : { ...EMPTY, lead: presetLead || '' });
  }, [open, trial, presetLead]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? trialsApi.update(trial._id, payload) : trialsApi.create(payload)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['trials'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(isEdit ? `${res.data.trialId} updated` : `Trial ${res.data.trialId} scheduled`);
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
    if (!form.lead) { setErrors({ lead: 'Choose the lead this trial belongs to' }); return; }
    const payload = { ...form };
    ['_id', 'id', 'trialId', 'leadId', 'studentName', 'createdAt', 'updatedAt', '__v',
     'createdBy', 'updatedBy', 'feedbackOverdue'].forEach((k) => delete payload[k]);
    if (payload.rating === '') delete payload.rating;
    if (isEdit) delete payload.lead;
    mutation.mutate(payload);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${trial.trialId}` : 'Schedule a trial'}
      subtitle="Rule 3: log the session as soon as it is booked, update it right after delivery."
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="trial-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />}
            {isEdit ? 'Save changes' : 'Schedule trial'}
          </button>
        </>
      }
    >
      <form id="trial-form" onSubmit={onSubmit} className="flex flex-col gap-6">
        <FormSection title="Session">
          {!isEdit && (
            <LeadPicker value={form.lead} onChange={(v) => setForm((f) => ({ ...f, lead: v }))} error={errors.lead} />
          )}
          <FormGrid>
            <Input label="Scheduled date" type="date" required value={form.scheduledDate} onChange={set('scheduledDate')} />
            <Input label="Start time" type="time" value={form.startTime} onChange={set('startTime')} />
            <Input label="Duration (min)" type="number" min="5" max="300" step="5" value={form.durationMinutes} onChange={set('durationMinutes')} />
            <Select label="Session status" options={lists.sessionStatus || []} value={form.sessionStatus} onChange={set('sessionStatus')} />
            <Input label="Tutor" list="trial-tutor-options" value={form.tutor} onChange={set('tutor')} />
            <datalist id="trial-tutor-options">{(lists.tutorsInUse || []).map((t) => <option key={t} value={t} />)}</datalist>
            <Input label="Subject" value={form.subject} onChange={set('subject')} />
          </FormGrid>
        </FormSection>

        <FormSection title="Quality review" description="Complete right after the session so the 24-hour follow-up can start.">
          <FormGrid>
            <Input label="Admin reviewer" value={form.adminReviewer} onChange={set('adminReviewer')} />
            <Select label="Rating" placeholder="Not rated" options={['1', '2', '3', '4', '5']} value={form.rating} onChange={set('rating')} />
            <Textarea className="sm:col-span-2" label="Tutor feedback" value={form.tutorFeedback} onChange={set('tutorFeedback')} />
            <Textarea className="sm:col-span-2" label="Client feedback" value={form.clientFeedback} onChange={set('clientFeedback')} />
            <Textarea label="Strong points" value={form.strongPoints} onChange={set('strongPoints')} />
            <Textarea label="Areas to improve" value={form.areasToImprove} onChange={set('areasToImprove')} />
          </FormGrid>
        </FormSection>

        <FormSection title="Commercial follow-up">
          <FormGrid>
            <Select label="Follow-up owner" placeholder="Unassigned" options={lists.leadOwner || []}
                    value={form.commercialFollowUpOwner} onChange={set('commercialFollowUpOwner')} />
            <Input label="Follow-up deadline" type="date" value={form.followUpDeadline} onChange={set('followUpDeadline')} />
            <Select label="Outcome" options={lists.trialOutcome || []} value={form.outcome} onChange={set('outcome')} />
            <Input label="Next step" value={form.nextStep} onChange={set('nextStep')} placeholder="Send package options" />
          </FormGrid>
        </FormSection>
      </form>
    </Modal>
  );
}
