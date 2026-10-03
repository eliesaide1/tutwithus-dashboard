/** Minimal RFC4180 CSV writer — no dependency needed for exports. */
function cell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows, columns) {
  const header = columns.map((c) => cell(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','))
    .join('\n');
  return `${header}\n${body}`;
}
