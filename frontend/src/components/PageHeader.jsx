/** The navy title band that opens every tab of the original workbook. */
export default function PageHeader({ title, subtitle, actions, children }) {
  return (
    <header className="flex flex-col gap-3 rounded-2xl bg-navy-700 px-4 py-4 text-white shadow-card sm:px-6 sm:py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-navy-100/90">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
