import { IconList } from './Icons.jsx';

export default function EmptyState({ title = 'Nothing here yet', message, action, icon: Icon = IconList }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-500">
        <Icon className="h-6 w-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-navy-800">{title}</p>
        {message && <p className="max-w-sm text-sm text-slate-500">{message}</p>}
      </div>
      {action}
    </div>
  );
}
