import { SkeletonRows } from './Loader.jsx';
import EmptyState from './EmptyState.jsx';
import { IconChevronRight } from './Icons.jsx';

/**
 * One data definition, two presentations:
 *  - `lg` and up → the wide banded table that mirrors the spreadsheet
 *  - below `lg`  → stacked tap-friendly cards
 *
 * columns: [{ key, label, render(row), className, mobile: 'title'|'subtitle'|'meta'|'badge'|'hide' }]
 */
export default function DataView({
  columns, rows, loading, onRowClick, emptyTitle, emptyMessage, emptyAction,
  keyField = '_id', renderMobileActions, selected = [], onToggleSelect, footer,
}) {
  if (loading) return <SkeletonRows rows={6} />;
  if (!rows?.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }

  const mobileOf = (kind) => columns.filter((c) => c.mobile === kind);
  const titleCols = mobileOf('title');
  const subtitleCols = mobileOf('subtitle');
  const badgeCols = mobileOf('badge');
  const metaCols = columns.filter((c) => !['title', 'subtitle', 'badge', 'hide'].includes(c.mobile));

  const cell = (col, row) => (col.render ? col.render(row) : row[col.key] ?? '—');

  return (
    <>
      {/* ---------- desktop table ---------- */}
      <div className="hidden lg:block">
        <div className="table-wrap">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {onToggleSelect && <th className="th w-10" />}
                {columns.map((col) => (
                  <th key={col.key} className={`th ${col.thClassName || ''}`}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row[keyField]}
                  className={`tr-band border-b border-slate-100 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {onToggleSelect && (
                    <td className="td w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
                        checked={selected.includes(row[keyField])}
                        onChange={() => onToggleSelect(row[keyField])}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`td ${col.className || ''}`}>{cell(col, row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {footer}
      </div>

      {/* ---------- mobile cards ---------- */}
      <div className="flex flex-col gap-3 p-3 lg:hidden">
        {rows.map((row) => (
          <article
            key={row[keyField]}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <div className="flex items-start gap-3">
              {onToggleSelect && (
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
                  checked={selected.includes(row[keyField])}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleSelect(row[keyField])}
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {titleCols.map((col) => (
                    <span key={col.key} className="truncate text-base font-semibold text-navy-800">{cell(col, row)}</span>
                  ))}
                </div>
                {subtitleCols.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    {subtitleCols.map((col) => <span key={col.key} className="truncate">{cell(col, row)}</span>)}
                  </div>
                )}
              </div>
              {onRowClick && <IconChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />}
            </div>

            {badgeCols.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {badgeCols.map((col) => <span key={col.key}>{cell(col, row)}</span>)}
              </div>
            )}

            {metaCols.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3">
                {metaCols.map((col) => (
                  <div key={col.key} className="flex min-w-0 flex-col">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{col.label}</dt>
                    <dd className="truncate text-sm text-navy-800">{cell(col, row)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {renderMobileActions && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
                {renderMobileActions(row)}
              </div>
            )}
          </article>
        ))}
        {footer}
      </div>
    </>
  );
}
