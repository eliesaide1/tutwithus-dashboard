/**
 * Single source of truth for every dropdown / enum used across the workbook.
 * Mirrors the "Instructions & Lists" tab of TutWithUs_Master_Pipeline.
 */

export const PIPELINE_STAGES = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Trial to Schedule',
  'Trial Scheduled',
  'Trial Completed',
  'Follow-up',
  'Converted / Paid',
  'Active',
  'On Hold',
  'Lost',
];

/** Stages that still represent an open commercial opportunity. */
export const OPEN_STAGES = PIPELINE_STAGES.filter(
  (s) => !['Converted / Paid', 'Active', 'Lost'].includes(s),
);

export const LEAD_SOURCES = [
  'Instagram',
  'Website',
  'WhatsApp',
  'Referral',
  'Organic Search',
  'School / Institution',
  'Direct Outreach',
  'Existing Client',
  'Other',
];

export const PRIORITIES = ['High', 'Medium', 'Low'];

export const LEAD_OWNERS = ['Thiago', 'Silvana', 'Gabriel', 'CEO / Project Lead', 'Other'];

export const TRIAL_STATUSES = [
  'Not Required',
  'To Schedule',
  'Scheduled',
  'Completed',
  'No-show',
  'Reschedule',
  'Cancelled',
];

export const CONVERSION_STATUSES = [
  'Not Started',
  'Pending Trial',
  'Pending Decision',
  'Converted',
  'Lost',
  'On Hold',
];

export const PAYMENT_STATUSES = [
  'Not Applicable',
  'Pending',
  'Invoice Sent',
  'Partially Paid',
  'Paid',
  'Overdue',
];

export const LOSS_REASONS = [
  'No Response',
  'Price',
  'Schedule Conflict',
  'Tutor Availability',
  'Chose Competitor',
  'No Longer Needed',
  'Trial Experience',
  'Other',
];

/** Computed in the sheet by formula; computed here as a virtual. */
export const FOLLOWUP_STATUSES = ['Missing Date', 'Overdue', 'Due Today', 'Due Soon', 'Scheduled'];

export const SESSION_STATUSES = [
  'Scheduled',
  'Completed',
  'No-show',
  'Cancelled',
  'Rescheduled',
];

export const TRIAL_OUTCOMES = [
  'Pending Review',
  'Convert - Send Offer',
  'Convert - Payment Pending',
  'Needs Another Trial',
  'Change Tutor',
  'Not Interested',
];

export const FOLLOWUP_ACTION_TYPES = [
  'Call',
  'WhatsApp',
  'Email',
  'SMS',
  'Meeting',
  'Proposal / Quote',
  'Payment Reminder',
  'Renewal Check-in',
];

export const FOLLOWUP_ACTION_STATUSES = [
  'Open',
  'In Progress',
  'Completed',
  'No Answer',
  'Rescheduled',
  'Cancelled',
];

export const RENEWAL_STATUSES = [
  'Not Due',
  'Due Soon',
  'In Discussion',
  'Renewed',
  'Churned',
  'Paused',
];

export const STUDENT_STATUSES = ['Active', 'On Hold', 'Completed', 'Churned'];

export const GRADE_LEVELS = [
  'KG',
  'Grade 1-3',
  'Grade 4-6',
  'Grade 7-9',
  'Grade 10-12',
  'University',
  'Adult / Professional',
];

/** Subject catalogue from tutwithus.com. */
export const SUBJECTS = [
  'Mathematics',
  'Science',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Arabic',
  'French',
  'SAT',
  'IELTS',
  'TOEFL',
  'ESL',
  'Programming',
  'Python',
  'Web Development',
  'Robotics',
  'Drawing',
  'Painting',
  'Music',
  'Sound Engineering',
  'Accounting',
  'Marketing',
  'HR Management',
  'Other',
];

export const USER_ROLES = ['admin', 'manager', 'agent', 'tutor', 'viewer'];

/** Roles allowed to mutate commercial data. */
export const WRITE_ROLES = ['admin', 'manager', 'agent'];

/** The 7 daily operating rules, surfaced in the app's Instructions page. */
export const OPERATING_RULES = [
  'Every new inquiry is entered in Master Pipeline on the same day it is received.',
  'Every open lead must have an Owner, Next Action, and Next Follow-up Date.',
  'Trial Sessions are logged once scheduled and updated immediately after completion/no-show.',
  'After a completed trial, record feedback and schedule a commercial follow-up within 24 hours.',
  'Converted students move to Active Students only after payment/package confirmation.',
  'Lost opportunities require a Loss Reason so management can identify recurring bottlenecks.',
  'Friday investor reporting is generated from the live pipeline; do not maintain a separate manual investor list.',
];

export const ALL_LISTS = {
  pipelineStage: PIPELINE_STAGES,
  leadSource: LEAD_SOURCES,
  priority: PRIORITIES,
  leadOwner: LEAD_OWNERS,
  trialStatus: TRIAL_STATUSES,
  conversionStatus: CONVERSION_STATUSES,
  paymentStatus: PAYMENT_STATUSES,
  lossReason: LOSS_REASONS,
  followUpStatus: FOLLOWUP_STATUSES,
  sessionStatus: SESSION_STATUSES,
  trialOutcome: TRIAL_OUTCOMES,
  actionType: FOLLOWUP_ACTION_TYPES,
  actionStatus: FOLLOWUP_ACTION_STATUSES,
  renewalStatus: RENEWAL_STATUSES,
  studentStatus: STUDENT_STATUSES,
  gradeLevel: GRADE_LEVELS,
  subject: SUBJECTS,
  role: USER_ROLES,
};
