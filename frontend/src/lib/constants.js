/** Mirrors backend/src/config/constants.js so the UI can render before /lists resolves. */
export const PIPELINE_STAGES = [
  'New Lead', 'Contacted', 'Qualified', 'Trial to Schedule', 'Trial Scheduled',
  'Trial Completed', 'Follow-up', 'Converted / Paid', 'Active', 'On Hold', 'Lost',
];

export const CLOSED_STAGES = ['Converted / Paid', 'Active', 'Lost'];

/** Tailwind classes per enum value — one place to change the whole app's colour language. */
export const STAGE_STYLES = {
  'New Lead': 'bg-slate-100 text-slate-700',
  Contacted: 'bg-sky-100 text-sky-800',
  Qualified: 'bg-indigo-100 text-indigo-800',
  'Trial to Schedule': 'bg-amber-100 text-amber-800',
  'Trial Scheduled': 'bg-violet-100 text-violet-800',
  'Trial Completed': 'bg-purple-100 text-purple-800',
  'Follow-up': 'bg-orange-100 text-orange-800',
  'Converted / Paid': 'bg-emerald-100 text-emerald-800',
  Active: 'bg-green-100 text-green-800',
  'On Hold': 'bg-yellow-100 text-yellow-800',
  Lost: 'bg-rose-100 text-rose-800',
};

export const PRIORITY_STYLES = {
  High: 'bg-rose-100 text-rose-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-slate-100 text-slate-600',
};

export const FOLLOWUP_STATUS_STYLES = {
  'Missing Date': 'bg-rose-100 text-rose-700',
  Overdue: 'bg-rose-100 text-rose-700',
  'Due Today': 'bg-amber-100 text-amber-800',
  'Due Soon': 'bg-sky-100 text-sky-800',
  Scheduled: 'bg-slate-100 text-slate-600',
};

export const PAYMENT_STYLES = {
  'Not Applicable': 'bg-slate-100 text-slate-600',
  Pending: 'bg-amber-100 text-amber-800',
  'Invoice Sent': 'bg-sky-100 text-sky-800',
  'Partially Paid': 'bg-indigo-100 text-indigo-800',
  Paid: 'bg-emerald-100 text-emerald-800',
  Overdue: 'bg-rose-100 text-rose-700',
};

export const SESSION_STYLES = {
  Scheduled: 'bg-sky-100 text-sky-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  'No-show': 'bg-rose-100 text-rose-700',
  Cancelled: 'bg-slate-100 text-slate-600',
  Rescheduled: 'bg-amber-100 text-amber-800',
};

export const ACTION_STATUS_STYLES = {
  Open: 'bg-sky-100 text-sky-800',
  'In Progress': 'bg-indigo-100 text-indigo-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  'No Answer': 'bg-amber-100 text-amber-800',
  Rescheduled: 'bg-violet-100 text-violet-800',
  Cancelled: 'bg-slate-100 text-slate-600',
};

export const RENEWAL_STYLES = {
  'Not Due': 'bg-slate-100 text-slate-600',
  'Due Soon': 'bg-amber-100 text-amber-800',
  'In Discussion': 'bg-sky-100 text-sky-800',
  Renewed: 'bg-emerald-100 text-emerald-800',
  Churned: 'bg-rose-100 text-rose-700',
  Paused: 'bg-yellow-100 text-yellow-800',
};

export const STUDENT_STATUS_STYLES = {
  Active: 'bg-emerald-100 text-emerald-800',
  'On Hold': 'bg-amber-100 text-amber-800',
  Completed: 'bg-sky-100 text-sky-800',
  Churned: 'bg-rose-100 text-rose-700',
};

export const styleFor = (map, value, fallback = 'bg-slate-100 text-slate-600') => map[value] || fallback;
