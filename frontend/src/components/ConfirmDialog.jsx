import Modal from './Modal.jsx';
import { Spinner } from './Loader.jsx';

export default function ConfirmDialog({
  open, onClose, onConfirm, title = 'Are you sure?', message,
  confirmLabel = 'Confirm', tone = 'danger', loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={`${tone === 'danger' ? 'btn-danger' : 'btn-primary'} w-full sm:w-auto`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
    </Modal>
  );
}
