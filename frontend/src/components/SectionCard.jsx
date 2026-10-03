/** Card with the sheet's navy sub-header band ("LIVE PIPELINE KPIs", etc). */
export default function SectionCard({ title, subtitle, actions, children, className = '', bodyClassName = 'p-4 sm:p-5' }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-navy-600 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-sm font-bold uppercase tracking-wide text-white">{title}</h2>
            {subtitle && <p className="truncate text-xs text-navy-100/80">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
