import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons.jsx';

/**
 * Full-height sheet on phones (slides up from the bottom, scrolls internally),
 * centred dialog from `sm` upwards.
 */
export default function Modal({ open, onClose, title, subtitle, children, footer, size = 'lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-navy-900/50 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[92vh] w-full animate-slide-up flex-col overflow-hidden rounded-t-3xl
                    bg-white shadow-2xl sm:max-h-[86vh] sm:rounded-2xl ${widths[size]}`}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          {/* Drag affordance on mobile */}
          <div className="absolute inset-x-0 top-2 flex justify-center sm:hidden">
            <span className="h-1 w-10 rounded-full bg-slate-300" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col pt-2 sm:pt-0">
            <h2 className="truncate text-lg font-bold text-navy-800">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="icon-btn -mr-1 shrink-0 text-navy-600 hover:bg-navy-50" aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4
                          sm:flex-row sm:justify-end sm:px-6"
               style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
