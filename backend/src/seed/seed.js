import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/db.js';
import { User, Lead, Trial, Followup, Student, WeeklyReport, ActivityLog } from '../models/index.js';
import { nextId, resetSequences } from '../utils/sequence.js';
import { addDays, startOfDay } from '../utils/dates.js';
import {
  LEAD_SOURCES, LEAD_OWNERS, PRIORITIES, GRADE_LEVELS, SUBJECTS, LOSS_REASONS,
} from '../config/constants.js';

const DEMO = process.argv.includes('--demo');
const WIPE = process.argv.includes('--wipe') || DEMO;

const TUTORS = ['Rana K.', 'Omar H.', 'Layla S.', 'Daniel P.', 'Maya T.', 'Youssef A.'];
const FIRST = ['Adam', 'Sara', 'Karim', 'Lina', 'Jad', 'Nour', 'Ziad', 'Maya', 'Hana', 'Rami', 'Talia', 'Fares', 'Dana', 'Elias', 'Zeina', 'Malek', 'Yara', 'Samir', 'Leila', 'Tarek'];
const LAST = ['Haddad', 'Khoury', 'Nasser', 'Saleh', 'Aziz', 'Farah', 'Mansour', 'Chami', 'Rizk', 'Sabbagh'];

const pick = (arr, i) => arr[i % arr.length];
const rand = (n) => Math.floor(Math.random() * n);
const pickRand = (arr) => arr[rand(arr.length)];

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@tutwithus.com').toLowerCase();
  let admin = await User.findOne({ email });
  if (!admin) {
    admin = await User.create({
      name: process.env.SEED_ADMIN_NAME || 'TutWithUs Admin',
      email,
      password: process.env.SEED_ADMIN_PASSWORD || 'TutWithUs2026!',
      role: 'admin',
      ownerAlias: 'CEO / Project Lead',
    });
    console.log(`[seed] admin created → ${email}`);
  } else {
    console.log(`[seed] admin already exists → ${email}`);
  }

  // One user per Lead Owner in the sheet's dropdown.
  const team = [
    { name: 'Thiago', email: 'thiago@tutwithus.com', role: 'manager', ownerAlias: 'Thiago' },
    { name: 'Silvana', email: 'silvana@tutwithus.com', role: 'agent', ownerAlias: 'Silvana' },
    { name: 'Gabriel', email: 'gabriel@tutwithus.com', role: 'agent', ownerAlias: 'Gabriel' },
  ];
  for (const member of team) {
    const exists = await User.findOne({ email: member.email });
    if (!exists) {
      await User.create({ ...member, password: process.env.SEED_ADMIN_PASSWORD || 'TutWithUs2026!' });
      console.log(`[seed] team member created → ${member.email}`);
    }
  }
  return admin;
}

async function seedDemo(admin) {
  console.log('[seed] generating demo pipeline…');
  const today = startOfDay(new Date());

  const stagePlan = [
    ...Array(6).fill('New Lead'),
    ...Array(5).fill('Contacted'),
    ...Array(4).fill('Qualified'),
    ...Array(3).fill('Trial to Schedule'),
    ...Array(4).fill('Trial Scheduled'),
    ...Array(3).fill('Trial Completed'),
    ...Array(4).fill('Follow-up'),
    ...Array(3).fill('Converted / Paid'),
    ...Array(5).fill('Active'),
    ...Array(2).fill('On Hold'),
    ...Array(4).fill('Lost'),
  ];

  const leads = [];
  for (let i = 0; i < stagePlan.length; i += 1) {
    const stage = stagePlan[i];
    const studentName = `${pick(FIRST, i)} ${pick(LAST, i * 3)}`;
    const closed = ['Converted / Paid', 'Active', 'Lost'].includes(stage);
    const receivedDaysAgo = rand(50) + (closed ? 15 : 1);

    const lead = new Lead({
      leadId: await nextId('LEAD'),
      dateReceived: addDays(today, -receivedDaysAgo),
      studentName,
      parentName: `${pick(LAST, i * 3)} family`,
      phone: `+9715${String(10000000 + rand(89999999)).slice(0, 8)}`,
      email: `${studentName.split(' ')[0].toLowerCase()}${i}@example.com`,
      leadSource: pickRand(LEAD_SOURCES),
      gradeLevel: pickRand(GRADE_LEVELS),
      subject: pickRand(SUBJECTS),
      needSummary: 'Needs structured weekly support and exam preparation.',
      leadOwner: pick(LEAD_OWNERS, i),
      priority: pick(PRIORITIES, i + rand(3)),
      pipelineStage: stage,
      lastContactDate: rand(10) > 1 ? addDays(today, -rand(12)) : undefined,
      nextAction: closed ? '' : pickRand(['Call parent to confirm trial', 'Send package options', 'Chase payment link', 'Confirm tutor availability']),
      // ~15% of open leads intentionally left without a date so the
      // "Missing Date" / rule-2 warning is visible in the demo.
      nextFollowUp: closed || rand(100) < 15 ? undefined : addDays(today, rand(12) - 4),
      trialStatus: { 'Trial Scheduled': 'Scheduled', 'Trial Completed': 'Completed', Lost: 'Cancelled' }[stage] || 'To Schedule',
      trialDateTime: ['Trial Scheduled', 'Trial Completed'].includes(stage) ? addDays(today, stage === 'Trial Scheduled' ? rand(7) : -rand(10)) : undefined,
      assignedTutor: ['New Lead', 'Contacted'].includes(stage) ? '' : pickRand(TUTORS),
      conversionStatus: { 'Converted / Paid': 'Converted', Active: 'Converted', Lost: 'Lost', 'On Hold': 'On Hold', 'Trial Completed': 'Pending Decision' }[stage] || 'Not Started',
      expectedRevenue: closed && stage === 'Lost' ? 0 : (rand(9) + 2) * 150,
      paymentStatus: ['Converted / Paid', 'Active'].includes(stage) ? 'Paid' : stage === 'Follow-up' ? pickRand(['Pending', 'Invoice Sent']) : 'Not Applicable',
      notes: 'Imported from the Master Pipeline workbook.',
      lossReason: stage === 'Lost' ? pickRand(LOSS_REASONS) : '',
      convertedAt: ['Converted / Paid', 'Active'].includes(stage) ? addDays(today, -rand(20)) : undefined,
      lostAt: stage === 'Lost' ? addDays(today, -rand(20)) : undefined,
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    await lead.save();
    leads.push(lead);
  }
  console.log(`[seed] ${leads.length} leads`);

  // Trials for every lead that reached a trial stage.
  const trialLeads = leads.filter((l) => ['Trial Scheduled', 'Trial Completed', 'Follow-up', 'Converted / Paid', 'Active'].includes(l.pipelineStage));
  let trialCount = 0;
  for (const lead of trialLeads) {
    const completed = lead.pipelineStage !== 'Trial Scheduled';
    const scheduledDate = completed ? addDays(today, -rand(14) - 1) : addDays(today, rand(8));
    const trial = new Trial({
      trialId: await nextId('TRL'),
      lead: lead._id,
      leadId: lead.leadId,
      studentName: lead.studentName,
      subject: lead.subject,
      tutor: lead.assignedTutor || pickRand(TUTORS),
      scheduledDate,
      startTime: pickRand(['16:00', '17:00', '17:30', '18:00', '19:00']),
      durationMinutes: pickRand([30, 45, 60]),
      sessionStatus: completed ? (rand(10) > 8 ? 'No-show' : 'Completed') : 'Scheduled',
      adminReviewer: pickRand(['Thiago', 'Silvana']),
      tutorFeedback: completed ? 'Student engaged well; gaps in fundamentals identified.' : '',
      clientFeedback: completed ? pickRand(['Parent happy with the approach.', 'Wants a second trial with another tutor.', 'Asked for package pricing.']) : '',
      strongPoints: completed ? 'Motivated, asks questions, good pace.' : '',
      areasToImprove: completed ? 'Needs stronger foundation before exam topics.' : '',
      commercialFollowUpOwner: completed ? lead.leadOwner : '',
      followUpDeadline: completed ? addDays(scheduledDate, 1) : undefined,
      outcome: completed ? pickRand(['Convert - Send Offer', 'Convert - Payment Pending', 'Needs Another Trial', 'Pending Review']) : 'Pending Review',
      nextStep: completed ? 'Send package options and confirm schedule.' : '',
      rating: completed ? rand(2) + 4 : undefined,
      createdBy: admin._id,
    });
    await trial.save();
    trialCount += 1;
  }
  console.log(`[seed] ${trialCount} trial sessions`);

  // Follow-up actions across the open pipeline, deliberately including overdue ones.
  const openLeads = leads.filter((l) => !['Converted / Paid', 'Active', 'Lost'].includes(l.pipelineStage));
  let fuCount = 0;
  for (const lead of openLeads) {
    const n = rand(2) + 1;
    for (let i = 0; i < n; i += 1) {
      const overdue = rand(10) < 3;
      const followup = new Followup({
        actionId: await nextId('FU'),
        lead: lead._id,
        leadId: lead.leadId,
        contactName: lead.parentName || lead.studentName,
        owner: lead.leadOwner,
        actionType: pickRand(['Call', 'WhatsApp', 'Email', 'Payment Reminder', 'Proposal / Quote']),
        dueDate: overdue ? addDays(today, -(rand(7) + 1)) : addDays(today, rand(8)),
        priority: lead.priority,
        status: i === 0 ? 'Open' : pickRand(['Open', 'In Progress', 'No Answer', 'Completed']),
        lastAttempt: rand(2) ? addDays(today, -rand(6)) : undefined,
        attempts: rand(3),
        result: rand(2) ? 'Left a voice note, awaiting reply.' : '',
        nextAction: pickRand(['Confirm trial slot', 'Resend package PDF', 'Call after 6pm', 'Share tutor profile']),
        createdBy: admin._id,
      });
      await followup.save();
      fuCount += 1;
    }
  }
  console.log(`[seed] ${fuCount} follow-up actions`);

  // Active students for converted leads.
  const converted = leads.filter((l) => ['Converted / Paid', 'Active'].includes(l.pipelineStage));
  for (const lead of converted) {
    const purchased = pickRand([8, 12, 16, 24]);
    const used = rand(purchased);
    const student = new Student({
      studentId: await nextId('STU'),
      lead: lead._id,
      leadId: lead.leadId,
      name: lead.studentName,
      parentName: lead.parentName,
      phone: lead.phone,
      email: lead.email,
      gradeLevel: lead.gradeLevel,
      subject: lead.subject,
      tutor: lead.assignedTutor || pickRand(TUTORS),
      startDate: lead.convertedAt || addDays(today, -30),
      packagePlan: `${purchased}-session package`,
      sessionsPurchased: purchased,
      sessionsUsed: used,
      amountPaid: purchased * 45,
      paymentStatus: 'Paid',
      nextSession: addDays(today, rand(6)),
      renewalDate: addDays(today, rand(40)),
      renewalStatus: purchased - used <= 2 ? 'Due Soon' : 'Not Due',
      status: 'Active',
      clientNotes: 'Weekly sessions; parent prefers evening slots.',
      createdBy: admin._id,
    });
    await student.save();
  }
  console.log(`[seed] ${converted.length} active students`);
}

async function run() {
  await connectDB(process.env.MONGODB_URI);

  if (WIPE) {
    console.log('[seed] clearing operational collections…');
    await Promise.all([
      Lead.deleteMany({}), Trial.deleteMany({}), Followup.deleteMany({}),
      Student.deleteMany({}), WeeklyReport.deleteMany({}), ActivityLog.deleteMany({}),
    ]);
    await resetSequences();
  }

  const admin = await seedAdmin();
  if (DEMO) await seedDemo(admin);

  console.log('[seed] done.');
  await disconnectDB();
}

run().catch(async (err) => {
  console.error('[seed] failed', err);
  await disconnectDB();
  process.exit(1);
});
