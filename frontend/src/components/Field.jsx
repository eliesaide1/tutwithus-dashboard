/** Labelled form controls sized for thumbs on mobile and dense on desktop. */

export function Field({ label, error, hint, required, className = '', children }) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export function Input({ label, error, hint, required, className, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      <input className={`input ${error ? 'ring-rose-400' : ''}`} {...props} />
    </Field>
  );
}

export function Textarea({ label, error, hint, rows = 3, className, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      <textarea rows={rows} className={`input resize-y ${error ? 'ring-rose-400' : ''}`} {...props} />
    </Field>
  );
}

export function Select({ label, error, hint, required, options = [], placeholder, className, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      <select className={`input appearance-none bg-[length:1rem] pr-9 ${error ? 'ring-rose-400' : ''}`}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%2364748b' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.65rem center',
              }}
              {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((opt) => {
          const value = typeof opt === 'string' ? opt : opt.value;
          const text = typeof opt === 'string' ? opt : opt.label;
          return <option key={value} value={value}>{text}</option>;
        })}
      </select>
    </Field>
  );
}

/** Groups fields into the responsive two-column grid used by every form. */
export function FormGrid({ children, className = '' }) {
  return <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${className}`}>{children}</div>;
}

export function FormSection({ title, description, children }) {
  return (
    <section className="flex flex-col gap-4 border-t border-slate-200 pt-5 first:border-0 first:pt-0">
      {title && (
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-navy-700">{title}</h3>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
