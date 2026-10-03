import { IconChevronLeft, IconChevronRight } from './Icons.jsx';

export default function Pagination({ meta, onPage, onLimit }) {
  if (!meta) return null;
  const { page, pages, total, limit, hasNext, hasPrev } = meta;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-navy-700">{from}–{to}</span> of{' '}
        <span className="font-semibold text-navy-700">{total}</span>
      </p>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        {onLimit && (
          <select
            className="input w-auto py-1.5 text-xs"
            value={limit}
            onChange={(e) => onLimit(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
        <div className="flex items-center gap-1">
          <button type="button" className="btn-secondary btn-sm" disabled={!hasPrev} onClick={() => onPage(page - 1)}>
            <IconChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Prev</span>
          </button>
          <span className="px-2 text-xs font-semibold text-navy-700">{page} / {pages}</span>
          <button type="button" className="btn-secondary btn-sm" disabled={!hasNext} onClick={() => onPage(page + 1)}>
            <span className="hidden sm:inline">Next</span>
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
