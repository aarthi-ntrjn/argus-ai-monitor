interface YoloWarningDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function YoloWarningDialog({ open, onConfirm, onCancel }: YoloWarningDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="yolo-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-5">
        <h2 id="yolo-dialog-title" className="text-sm font-semibold text-gray-900 mb-2">
          Enable Yolo Mode
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Yolo mode bypasses all permission checks and safety prompts for every session launched from Argus.
          Claude Code will launch with <code className="text-xs bg-gray-100 px-1 rounded">--dangerously-skip-permissions</code> and
          Copilot will launch with <code className="text-xs bg-gray-100 px-1 rounded">--allow-all</code>.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          Only enable this if you understand the risks. All safety guardrails will be disabled.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
          >
            Enable Yolo Mode
          </button>
        </div>
      </div>
    </div>
  );
}
