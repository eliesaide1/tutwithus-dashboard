import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../api/endpoints.js';
import { useLists } from '../context/ListsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Modal from './Modal.jsx';
import { Input, Select, Textarea, FormGrid } from './Field.jsx';
import { Spinner } from './Loader.jsx';
import { toDateInput } from '../lib/format.js';

/** Rule 5 — the lead becomes an Active Student only once payment is confirmed. */
export default function ConvertForm({ open, onClose, lead, onConverted }) {
  const lists = useLists();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    packagePlan: '', sessionsPurchased: 8, amountPaid: '', paymentStatus: 'Paid',
    startDate: toDateInput(new Date()), tutor: '', subject: '', nextSession: '', renewalDate: '', clientNotes: '',
  });

  useEffect(() => {
    if (!open || !lead) return;
    setForm((f) => ({
      ...f,
      tutor: lead.assignedTutor || '',
      subject: lead.subject || '',
      amountPaid: lead.expectedRevenue || '',
    }));
  }, [open, lead]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload) => leadsApi.convert(lead._id, payload),
    onSuccess: (res) => {
      ['leads', 'lead', 'students', 'dashboard'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success(`${lead.studentName} is now student ${res.data.student.studentId}`);
      onConverted?.(res.data.student);
      onClose();
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert to Active Student"
      subtitle={lead ? `${lead.leadId} · ${lead.studentName}` : ''}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="convert-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />} Confirm conversion
          </button>
        </>
      }
    >
      <form id="convert-form" className="flex flex-col gap-4"
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}>
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          Payment must be confirmed before the student appears in Active Students.
        </p>
        <FormGrid>
          <Input label="Package / plan" value={form.packagePlan} onChange={set('packagePlan')} placeholder="12-session package" />
          <Input label="Sessions purchased" type="number" min="1" value={form.sessionsPurchased} onChange={set('sessionsPurchased')} />
          <Input label="Amount paid (USD)" type="number" min="0" step="10" value={form.amountPaid} onChange={set('amountPaid')} />
          <Select label="Payment status" options={['Paid', 'Partially Paid']} value={form.paymentStatus} onChange={set('paymentStatus')} />
          <Input label="Start date" type="date" value={form.startDate} onChange={set('startDate')} />
          <Input label="Next session" type="date" value={form.nextSession} onChange={set('nextSession')} />
          <Input label="Tutor" list="convert-tutors" value={form.tutor} onChange={set('tutor')} />
          <datalist id="convert-tutors">{(lists.tutorsInUse || []).map((t) => <option key={t} value={t} />)}</datalist>
          <Input label="Subject" value={form.subject} onChange={set('subject')} />
          <Input label="Renewal date" type="date" value={form.renewalDate} onChange={set('renewalDate')} />
          <Textarea className="sm:col-span-2" label="Client notes" value={form.clientNotes} onChange={set('clientNotes')} />
        </FormGrid>
      </form>
    </Modal>
  );
}
