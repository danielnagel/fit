import { forwardRef, useImperativeHandle, useRef } from 'react';

export type ConfirmDialogHandle = { open: () => void };

type Props = {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

const ConfirmDialog = forwardRef<ConfirmDialogHandle, Props>(({ message, confirmLabel = 'Delete', onConfirm }, ref) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => dialogRef.current?.showModal(),
  }));

  return (
    <dialog
      ref={dialogRef}
      className="max-w-xs rounded-2xl border border-edge bg-surface p-5 text-fg shadow-2xl shadow-black/50 backdrop:bg-black/70"
    >
      <p>{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={() => {
            dialogRef.current?.close();
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
});

export default ConfirmDialog;
