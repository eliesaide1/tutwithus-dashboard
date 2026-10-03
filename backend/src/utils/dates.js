/** All date maths in the app is done on calendar days, ignoring clock time. */

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Whole days between two dates (b - a). */
export function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

/** Monday 00:00 of the week containing `date`. */
export function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7; // Mon = 0
  return addDays(d, -day);
}

export function endOfWeek(date = new Date()) {
  return endOfDay(addDays(startOfWeek(date), 6));
}

/** ISO week label, e.g. 2026-W40 — used as the investor report key. */
export function isoWeekKey(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  firstThursday.setDate(
    firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7),
  );
  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Replicates the sheet's Follow-up Status formula.
 * No date at all → "Missing Date" (exactly what the blank sheet shows today).
 */
export function computeFollowUpStatus(nextFollowUp, reference = new Date()) {
  if (!nextFollowUp) return 'Missing Date';
  const diff = daysBetween(reference, nextFollowUp);
  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Due Today';
  if (diff <= 3) return 'Due Soon';
  return 'Scheduled';
}
