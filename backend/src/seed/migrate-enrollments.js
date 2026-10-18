import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { connectDB, disconnectDB } from '../config/db.js';
import mongoose from 'mongoose';

/**
 * Converts the old one-row-per-subject Student records into
 * one-person-with-enrollments, merging duplicates of the same human.
 *
 *   node src/seed/migrate-enrollments.js --dry     preview only
 *   node src/seed/migrate-enrollments.js           apply
 *
 * A JSON backup of the collection is written before anything changes.
 */
const DRY = process.argv.includes('--dry');

const ENROLLMENT_FIELDS = [
  'subject', 'tutor', 'startDate', 'packagePlan', 'sessionsPurchased', 'sessionsUsed',
  'amountPaid', 'paymentStatus', 'nextSession', 'renewalDate', 'renewalStatus', 'status', 'lead', 'leadId',
];

/** Same human? Last 9 digits of the phone, else an exact name match. */
function identityKey(doc) {
  const digits = String(doc.phone || '').replace(/\D/g, '');
  if (digits.length >= 7) return `phone:${digits.slice(-9)}`;
  return `name:${String(doc.name || '').trim().toLowerCase()}`;
}

async function run() {
  await connectDB(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('students');
  const docs = await col.find({}).sort({ studentId: 1 }).toArray();
  console.log(`[migrate] ${docs.length} student document(s) found`);

  const backupPath = path.resolve(process.cwd(), `students-backup-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(docs, null, 2));
  console.log(`[migrate] backup written → ${backupPath}`);

  const alreadyMigrated = docs.every((d) => Array.isArray(d.enrollments));
  if (alreadyMigrated && !docs.some((d) => d.subject)) {
    console.log('[migrate] nothing to do — already in the enrollment shape');
    await disconnectDB();
    return;
  }

  // Group the flat rows by person.
  const groups = new Map();
  for (const doc of docs) {
    const key = identityKey(doc);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  let merged = 0;
  let converted = 0;

  for (const [key, rows] of groups) {
    // Oldest studentId wins, so the identity people already know is kept.
    rows.sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
    const keeper = rows[0];

    const enrollments = [];
    for (const row of rows) {
      if (Array.isArray(row.enrollments) && row.enrollments.length) {
        enrollments.push(...row.enrollments);
        continue;
      }
      if (!row.subject && !row.tutor && !row.sessionsPurchased) continue;
      const enrollment = {};
      for (const f of ENROLLMENT_FIELDS) if (row[f] !== undefined) enrollment[f] = row[f];
      enrollment._id = new mongoose.Types.ObjectId();
      enrollment.subject = enrollment.subject || 'General';
      enrollment.status = enrollment.status || row.status || 'Active';
      enrollment.createdAt = row.createdAt || new Date();
      enrollment.updatedAt = row.updatedAt || new Date();
      enrollments.push(enrollment);
    }

    const update = {
      $set: {
        enrollments,
        name: keeper.name,
        parentName: keeper.parentName || rows.find((r) => r.parentName)?.parentName || '',
        phone: keeper.phone || rows.find((r) => r.phone)?.phone || '',
        email: keeper.email || rows.find((r) => r.email)?.email || '',
        gradeLevel: keeper.gradeLevel || rows.find((r) => r.gradeLevel)?.gradeLevel || '',
        clientNotes: [...new Set(rows.map((r) => r.clientNotes).filter(Boolean))].join('\n'),
        status: enrollments.some((e) => e.status === 'Active') ? 'Active' : (keeper.status || 'Active'),
      },
      $unset: {
        subject: '', tutor: '', startDate: '', packagePlan: '', sessionsPurchased: '',
        sessionsUsed: '', amountPaid: '', paymentStatus: '', nextSession: '',
        renewalDate: '', renewalStatus: '',
      },
    };

    const dropped = rows.slice(1);
    const label = `${keeper.studentId} ${keeper.name}`;
    if (dropped.length) {
      merged += dropped.length;
      console.log(`[migrate] ${label} ← merging ${dropped.map((d) => d.studentId).join(', ')} ` +
                  `(${enrollments.map((e) => e.subject).join(' + ')})`);
    } else {
      converted += 1;
      console.log(`[migrate] ${label} → ${enrollments.length} enrollment(s): ${enrollments.map((e) => e.subject).join(', ')}`);
    }

    if (!DRY) {
      await col.updateOne({ _id: keeper._id }, update);
      if (dropped.length) await col.deleteMany({ _id: { $in: dropped.map((d) => d._id) } });
    }
  }

  console.log(`\n[migrate] ${DRY ? 'DRY RUN — nothing written' : 'applied'}: ` +
              `${converted} converted, ${merged} duplicate record(s) merged away`);
  await disconnectDB();
}

run().catch(async (err) => {
  console.error('[migrate] failed', err);
  await disconnectDB();
  process.exit(1);
});
