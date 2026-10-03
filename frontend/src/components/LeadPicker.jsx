import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../api/endpoints.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { Field } from './Field.jsx';
import { IconSearch, IconCheck } from './Icons.jsx';

/** Type-ahead lead selector used by the trial and follow-up forms. */
export default function LeadPicker({ value, onChange, label = 'Lead', error, disabled }) {
  const [term, setTerm] = useState('');
  const search = useDebounce(term, 300);

  const { data: selectedData } = useQuery({
    queryKey: ['lead', value],
    queryFn: () => leadsApi.get(value),
    enabled: Boolean(value),
  });

  const { data, isFetching } = useQuery({
    queryKey: ['leads', 'picker', search],
    queryFn: () => leadsApi.list({ search, limit: 8, view: 'open' }),
    enabled: !disabled && term.length > 0,
  });

  const selected = selectedData?.data?.lead;

  if (selected && !term) {
    return (
      <Field label={label} error={error}>
        <div className="flex items-center gap-3 rounded-xl bg-navy-50 px-3.5 py-2.5 ring-1 ring-inset ring-navy-200">
          <IconCheck className="h-4 w-4 shrink-0 text-navy-600" />
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-navy-800">{selected.studentName}</span>
            <span className="truncate text-xs text-slate-500">{selected.leadId} · {selected.pipelineStage}</span>
          </div>
          {!disabled && (
            <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => { onChange(''); setTerm(' '); }}>
              Change
            </button>
          )}
        </div>
      </Field>
    );
  }

  return (
    <Field label={label} error={error} hint="Search by name, phone or lead ID">
      <div className="relative flex items-center">
        <IconSearch className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Start typing…"
          value={term}
          disabled={disabled}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>
      {term.trim().length > 0 && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {isFetching && <li className="px-3 py-2.5 text-sm text-slate-400">Searching…</li>}
          {!isFetching && !data?.data?.length && <li className="px-3 py-2.5 text-sm text-slate-400">No open leads found</li>}
          {data?.data?.map((lead) => (
            <li key={lead._id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-navy-50"
                onClick={() => { onChange(lead._id); setTerm(''); }}
              >
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-medium text-navy-800">{lead.studentName}</span>
                  <span className="truncate text-xs text-slate-500">{lead.leadId} · {lead.pipelineStage} · {lead.leadOwner}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
