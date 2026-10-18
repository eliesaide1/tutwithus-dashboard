import { useState } from 'react';
import { IconSearch, IconFilter, IconClose } from './Icons.jsx';

/**
 * Search + quick views always visible; the full filter set collapses behind a
 * button on small screens so the list stays the focus.
 */
export default function FilterBar({
  search, onSearch, searchPlaceholder = 'Search…',
  views = [], activeView, onView,
  filters = [], onClear, right,
}) {
  const [open, setOpen] = useState(false);
  const activeCount = filters.filter((f) => f.value && f.value !== 'all').length;

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex min-w-[180px] flex-1 items-center">
          <IconSearch className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            className="input pl-9"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        {filters.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`btn-secondary shrink-0 ${open ? 'ring-navy-500' : ''}`}
          >
            <IconFilter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-navy-600 px-1.5 text-[10px] font-bold text-white">{activeCount}</span>
            )}
          </button>
        )}
        {right}
      </div>

      {views.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0">
          {views.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => onView(v.value)}
              className={`chip ${
                activeView === v.value
                  ? 'bg-navy-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {v.label}
              {v.count !== undefined && v.count !== null && (
                <span className={`rounded-full px-1.5 text-[10px] ${
                  activeView === v.value ? 'bg-white/20' : 'bg-white text-slate-500'
                }`}>{v.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && filters.length > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3 lg:grid-cols-5">
          {filters.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{f.label}</span>
              <select
                className="input py-2 text-xs"
                value={f.value || ''}
                onChange={(e) => f.onChange(e.target.value)}
              >
                <option value="">All</option>
                {f.options.map((o) => {
                  const value = typeof o === 'string' ? o : o.value;
                  const text = typeof o === 'string' ? o : o.label;
                  return <option key={value} value={value}>{text}</option>;
                })}
              </select>
            </label>
          ))}
          {activeCount > 0 && (
            <button type="button" className="btn-ghost self-end text-xs" onClick={onClear}>
              <IconClose className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
