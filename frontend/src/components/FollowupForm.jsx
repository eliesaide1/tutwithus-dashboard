import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followupsApi } from '../api/endpoints.js';
import { useLists } from '../context/ListsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Modal from './Modal.jsx';
import LeadPicker from './LeadPicker.jsx';
import { Input, Select, Textarea, FormGrid, FormSection } from './Field.jsx';
import { Spinner } from './Loader.jsx';
import { toDateInput } from '../lib/format.js';

const EMPTY = {
  lead: '', owner: '', actionType: 'Call', dueDate: toDateInput(new Date()),
  priority: 'Medium', status: 'Open', lastAttempt: '', attempts: 0, result: '', nextAction: '',
};

export default function FollowupForm({ open, onClose, followup, presetLead }) {
  const lists = useLists();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const isEdit = Boolean(followup?._id);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(followup
      ? { ...EMPTY, ...followup, lead: followup.lead?._id || followup.lead,
          dueDate: toDateInput(followup.dueDate), lastAttempt: toDateInput(followup.lastAttempt) }
      : { ...EMPTY, lead: presetLead || '' });
  }, [open, followup, presetLead]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? followupsApi.update(followup._id, payload) : followupsApi.create(payload)),
    onSuccess: () => {
      ['followups', 'leads', 'lead', 'dashboard'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success(isEdit ? 'Action updated' : 'Follow-up action created');
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
    if (!form.lead) { setErrors({ lead: 'Choose the lead this action belongs to' }); return; }
    const payload = { ...form };
    ['_id', 'id', 'actionId', 'leadId', 'contactName', 'createdAt', 'updatedAt', '__v',
     'createdBy', 'updatedBy', 'completedAt', 'dueStatus', 'isOverdue'].forEach((k) => delete payload[k]);
    if (isEdit) delete payload.lead;
    mutation.mutate(payload);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${followup.actionId}` : 'New follow-up action'}
      subtitle="Rule 2: every open opportunity carries a next step and a date."
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="followup-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />}
            {isEdit ? 'Save changes' : 'Create action'}
          </button>
        </>
      }
    >
      <form id="followup-form" onSubmit={onSubmit} className="flex flex-col gap-6">
        <FormSection>
          {!isEdit && <LeadPicker value={form.lead} onChange={(v) => setForm((f) => ({ ...f, lead: v }))} error={errors.lead} />}
          <FormGrid>
            <Select label="Owner" placeholder="Inherit from lead" options={lists.leadOwner || []} value={form.owner} onChange={set('owner')} />
            <Select label="Action type" options={lists.actionType || []} value={form.actionType} onChange={set('actionType')} />
            <Input label="Due date" type="date" required value={form.dueDate} onChange={set('dueDate')} />
            <Select label="Priority" options={lists.priority || []} value={form.priority} onChange={set('priority')} />
            <Select label="Status" options={lists.actionStatus || []} value={form.status} onChange={set('status')} />
            <Input label="Attempts" type="number" min="0" value={form.attempts} onChange={set('attempts')} />
            <Input className="sm:col-span-2" label="Next action" value={form.nextAction} onChange={set('nextAction')}
                   placeholder="Confirm the trial slot for Saturday" />
            <Textarea className="sm:col-span-2" label="Result / notes" value={form.result} onChange={set('result')} />
          </FormGrid>
        </FormSection>
      </form>
    </Modal>
  );
}
