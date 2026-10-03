import { IconTrend } from './Icons.jsx';

/**
 * The KPI tiles of the Dashboard tab. `tone` drives the accent so a screen of
 * tiles still reads as one system.
 */
export default function StatCard({
  label, value, hint, icon: Icon, tone = 'navy', change, onClick, loading, alert,
}) {
  const tones = {
    navy: 'bg-navy-50 text-navy-700',
    sky: 'bg-sky-100 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    violet: 'bg-violet-50 text-violet-700',
  };

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card flex-row items-center gap-3 p-4 text-left transition ${
        onClick ? 'hover:-translate-y-0.5 hover:shadow-lg active:scale-[.99]' : ''
      } ${alert ? 'ring-1 ring-rose-300' : ''}`}
    >
      {Icon && (
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* wraps rather than truncates so narrow phone tiles stay readable */}
        <span className="text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500">{label}</span>
        {loading ? (
          <span className="skeleton mt-1 h-7 w-16" />
        ) : (
          <span className="text-2xl font-extrabold leading-tight text-navy-800">{value}</span>
        )}
        {(hint || change !== undefined) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-slate-500">
            {change !== undefined && change !== null && (
              <span className={`inline-flex items-center gap-0.5 font-semibold ${
                change > 0 ? 'text-emerald-600' : change < 0 ? 'text-rose-600' : 'text-slate-400'
              }`}>
                <IconTrend className={`h-3.5 w-3.5 ${change < 0 ? 'rotate-90' : ''}`} />
                {change > 0 ? '+' : ''}{change}%
              </span>
            )}
            {hint && <span className="leading-tight">{hint}</span>}
          </span>
        )}
      </div>
    </Wrapper>
  );
}
