export default function ProgressBar({ value, max = 100, tone = 'bg-navy-500', label, className = '' }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`flex w-full flex-col gap-1 ${className}`}>
      {label && (
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-500">{label}</span>
          <span className="font-semibold tabular-nums text-navy-700">{value}/{max}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
