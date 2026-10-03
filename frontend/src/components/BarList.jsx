/** Horizontal flexbox bars — the Pipeline by Stage / source breakdown blocks. */
export default function BarList({ items, valueKey = 'count', labelKey = 'label', formatValue, accent = 'bg-navy-500', onSelect }) {
  const max = Math.max(1, ...items.map((i) => i[valueKey] || 0));

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => {
        const value = item[valueKey] || 0;
        const pct = Math.round((value / max) * 100);
        const Row = onSelect ? 'button' : 'div';
        return (
          <li key={item[labelKey]}>
            <Row
              type={onSelect ? 'button' : undefined}
              onClick={onSelect ? () => onSelect(item) : undefined}
              className={`flex w-full flex-col gap-1 ${onSelect ? 'group text-left' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className={`truncate text-sm font-medium text-navy-800 ${onSelect ? 'group-hover:underline' : ''}`}>
                  {item[labelKey]}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-navy-700">
                  {formatValue ? formatValue(item) : value}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${item.accent || accent} transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}
