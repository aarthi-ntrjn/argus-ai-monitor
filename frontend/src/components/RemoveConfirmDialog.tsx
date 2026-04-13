import { useEffect, useRef, useCallback } from 'react';
import { Button } from './Button';
import { Checkbox } from './Checkbox';

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
          <Checkbox
            label="Don't ask again"
            checked={skipConfirm}
            onChange={e => onSkipConfirmChange(e.target.checked)}
          />
          <div className="flex gap-2">
            <Button
              ref={cancelRef}
              variant="ghost"
              onClick={onCancel}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              disabled={removing}
            >
              {removing ? 'Removing...' : 'Remove'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
