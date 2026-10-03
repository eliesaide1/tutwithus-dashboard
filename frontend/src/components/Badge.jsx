import { styleFor } from '../lib/constants.js';

/** Small pill used everywhere a sheet cell had a coloured status. */
export default function Badge({ value, map, className = '', dot = false, fallback }) {
  if (value === undefined || value === null || value === '') return <span className="text-slate-400">—</span>;
  const tone = map ? styleFor(map, value, fallback) : fallback || 'bg-slate-100 text-slate-600';
  return (
    <span className={`badge ${tone} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {value}
    </span>
  );
}
