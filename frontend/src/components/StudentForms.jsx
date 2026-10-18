import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '../api/endpoints.js';
import { useLists } from '../context/ListsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Modal from './Modal.jsx';
import { Input, Select, Textarea, FormGrid, FormSection } from './Field.jsx';
import { Spinner } from './Loader.jsx';
import { toDateInput } from '../lib/format.js';

const EMPTY_PERSON = {
  name: '', parentName: '', phone: '', email: '', gradeLevel: '', clientNotes: '',
};

const EMPTY_ENROLLMENT = {
  subject: '', tutor: '', startDate: toDateInput(new Date()), packagePlan: '',
  sessionsPurchased: 0, sessionsUsed: 0, amountPaid: 0, paymentStatus: 'Paid',
  nextSession: '', renewalDate: '', renewalStatus: 'Not Due', status: 'Active', notes: '',
};

const invalidate = (qc) => ['students', 'dashboard', 'lists'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

/** The person: name, contact, grade. Subjects are managed separately. */
export function StudentForm({ open, onClose, student }) {
  const lists = useLists();
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = Boolean(student?._id);
  const [form, setForm] = useState(EMPTY_PERSON);
  const [enrollment, setEnrollment] = useState(EMPTY_ENROLLMENT);
  const [duplicate, setDuplicate] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDuplicate(null);
    setForm(student ? { ...EMPTY_PERSON, ...student } : EMPTY_PERSON);
    setEnrollment(EMPTY_ENROLLMENT);
  }, [open, student]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setE = (key) => (e) => setEnrollment((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: ({ force } = {}) => {
      const person = { ...form };
      ['_id', 'id', 'studentId', 'leadId', 'lead', 'createdAt', 'updatedAt', '__v', 'createdBy',
       'updatedBy', 'enrollments', 'status', 'sessionsPurchased', 'sessionsUsed', 'amountPaid',
       'sessionsRemaining', 'subjectCount', 'subjects', 'tutors', 'nextSession',
       'renewalDueSoon', 'paymentStatus', 'renewalStatus'].forEach((k) => delete person[k]);
      if (isEdit) return studentsApi.update(student._id, person);
      return studentsApi.create({ ...person, enrollments: [enrollment] }, { force });
    },
    onSuccess: () => { invalidate(qc); toast.success(isEdit ? 'Student updated' : 'Student added'); onClose(); },
    onError: (err) => {
      // The API blocks a second record for someone who already exists.
      if (err.response?.status === 409) setDuplicate(err.friendlyMessage);
      else toast.error(err.friendlyMessage);
    },
  });

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEdit ? `Edit ${student.studentId}` : 'Add student'}
      subtitle={isEdit ? student.name : 'One record per person — subjects are added separately.'}
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="student-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />} {isEdit ? 'Save changes' : 'Add student'}
          </button>
        </>
      }
    >
      <form id="student-form" className="flex flex-col gap-6"
            onSubmit={(e) => { e.preventDefault(); mutation.mutate({}); }}>
        <FormSection title="Person">
          <FormGrid>
            <Input label="Name" required value={form.name} onChange={set('name')} />
            <Input label="Parent / Guardian" value={form.parentName} onChange={set('parentName')} />
            <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} />
            <Select label="Grade / level" placeholder="Not set" options={lists.gradeLevel || []}
                    value={form.gradeLevel} onChange={set('gradeLevel')} />
            <Textarea className="sm:col-span-2" label="Client notes" value={form.clientNotes} onChange={set('clientNotes')} />
          </FormGrid>
        </FormSection>

        {!isEdit && (
          <FormSection title="First subject" description="You can add more subjects to this student afterwards.">
            <EnrollmentFields value={enrollment} onChange={setE} lists={lists} />
          </FormSection>
        )}

        {duplicate && (
          <div className="flex flex-col gap-2 rounded-xl bg-amber-50 p-3.5">
            <p className="text-sm font-medium text-amber-900">{duplicate}</p>
            <button type="button" className="btn-secondary btn-sm self-start"
                    onClick={() => { setDuplicate(null); mutation.mutate({ force: true }); }}>
              Create a separate record anyway
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

function EnrollmentFields({ value, onChange, lists }) {
  return (
    <FormGrid>
      <Input label="Subject" required list="enrollment-subjects" value={value.subject} onChange={onChange('subject')} />
      <datalist id="enrollment-subjects">{(lists.subject || []).map((s) => <option key={s} value={s} />)}</datalist>
      <Input label="Tutor" list="enrollment-tutors" value={value.tutor} onChange={onChange('tutor')} />
      <datalist id="enrollment-tutors">{(lists.tutorsInUse || []).map((t) => <option key={t} value={t} />)}</datalist>
      <Input label="Start date" type="date" value={value.startDate} onChange={onChange('startDate')} />
      <Input label="Package / plan" value={value.packagePlan} onChange={onChange('packagePlan')} />
      <Input label="Sessions purchased" type="number" min="0" value={value.sessionsPurchased} onChange={onChange('sessionsPurchased')} />
      <Input label="Sessions used" type="number" min="0" value={value.sessionsUsed} onChange={onChange('sessionsUsed')} />
      <Input label="Amount paid (USD)" type="number" min="0" step="10" value={value.amountPaid} onChange={onChange('amountPaid')} />
      <Select label="Payment status" options={lists.paymentStatus || []} value={value.paymentStatus} onChange={onChange('paymentStatus')} />
      <Input label="Next session" type="date" value={value.nextSession} onChange={onChange('nextSession')} />
      <Input label="Renewal date" type="date" value={value.renewalDate} onChange={onChange('renewalDate')} />
      <Select label="Renewal status" options={lists.renewalStatus || []} value={value.renewalStatus} onChange={onChange('renewalStatus')} />
      <Select label="Status" options={lists.studentStatus || []} value={value.status} onChange={onChange('status')} />
      <Textarea className="sm:col-span-2" label="Notes" value={value.notes} onChange={onChange('notes')} />
    </FormGrid>
  );
}

/** Add or edit one subject on an existing student. */
export function EnrollmentForm({ open, onClose, student, enrollment }) {
  const lists = useLists();
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = Boolean(enrollment?._id);
  const [form, setForm] = useState(EMPTY_ENROLLMENT);

  useEffect(() => {
    if (!open) return;
    setForm(enrollment
      ? { ...EMPTY_ENROLLMENT, ...enrollment,
          startDate: toDateInput(enrollment.startDate),
          nextSession: toDateInput(enrollment.nextSession),
          renewalDate: toDateInput(enrollment.renewalDate) }
      : EMPTY_ENROLLMENT);
  }, [open, enrollment]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      ['_id', 'id', '__v', 'createdAt', 'updatedAt', 'sessionsRemaining', 'usagePercent',
       'renewalDueSoon', 'lead', 'leadId'].forEach((k) => delete payload[k]);
      return isEdit
        ? studentsApi.updateEnrollment(student._id, enrollment._id, payload)
        : studentsApi.addEnrollment(student._id, payload);
    },
    onSuccess: () => { invalidate(qc); toast.success(isEdit ? 'Subject updated' : 'Subject added'); onClose(); },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  if (!student) return null;

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEdit ? `Edit ${enrollment.subject}` : 'Add a subject'}
      subtitle={`${student.studentId} · ${student.name}`}
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="enrollment-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />} {isEdit ? 'Save changes' : 'Add subject'}
          </button>
        </>
      }
    >
      <form id="enrollment-form" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <EnrollmentFields value={form} onChange={set} lists={lists} />
      </form>
    </Modal>
  );
}

/** Renew one subject's package. */
export function RenewForm({ open, onClose, student, enrollment }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ sessionsPurchased: 12, amountPaid: '', packagePlan: '', renewalDate: '', paymentStatus: 'Paid' });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (open && enrollment) {
      setForm((f) => ({ ...f, packagePlan: enrollment.packagePlan || '', sessionsPurchased: enrollment.sessionsPurchased || 12 }));
    }
  }, [open, enrollment]);

  const mutation = useMutation({
    mutationFn: () => studentsApi.renew(student._id, enrollment._id, form),
    onSuccess: () => { invalidate(qc); toast.success('Package renewed'); onClose(); },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  if (!student || !enrollment) return null;

  return (
    <Modal
      open={open} onClose={onClose} size="sm"
      title="Renew package"
      subtitle={`${student.name} · ${enrollment.subject}`}
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="renew-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />} Renew
          </button>
        </>
      }
    >
      <form id="renew-form" className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <Input label="Sessions purchased" type="number" min="1" required value={form.sessionsPurchased} onChange={set('sessionsPurchased')} />
        <Input label="Amount paid (USD)" type="number" min="0" step="10" value={form.amountPaid} onChange={set('amountPaid')} />
        <Input label="Package / plan" value={form.packagePlan} onChange={set('packagePlan')} />
        <Input label="Next renewal date" type="date" value={form.renewalDate} onChange={set('renewalDate')} />
        <Select label="Payment status" options={['Paid', 'Partially Paid', 'Invoice Sent']} value={form.paymentStatus} onChange={set('paymentStatus')} />
      </form>
    </Modal>
  );
}
