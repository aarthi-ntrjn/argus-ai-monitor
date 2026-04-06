import { useEffect, useRef, useCallback } from 'react';

interface RemoveConfirmDialogProps {
  repoName: string | undefined;
  removing: boolean;
  skipConfirm: boolean;
  onSkipConfirmChange: (val: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RemoveConfirmDialog({ repoName, removing, skipConfirm, onSkipConfirmChange, onCancel, onConfirm }: RemoveConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { cancelRef.current?.focus(); }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !removing) onCancel();
  }, [onCancel, removing]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="remove-dialog-title"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h2 id="remove-dialog-title" className="text-lg font-semibold mb-2">Remove Repository</h2>
        <p className="text-gray-600 text-sm mb-4">
          Remove <span className="font-semibold">{repoName}</span>?
          This will also delete all associated sessions and output history.
        </p>
        <div className="flex items-center justify-between mt-4">
          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipConfirm}
              onChange={e => onSkipConfirmChange(e.target.checked)}
              className="rounded"
            />
            Don't ask again
          </label>
          <div className="flex gap-2">
            <button
              ref={cancelRef}
              onClick={onCancel}
              disabled={removing}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded-sm"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={removing}
              className="bg-red-600 text-white px-4 py-2 rounded-sm hover:bg-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
            >
              {removing ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
