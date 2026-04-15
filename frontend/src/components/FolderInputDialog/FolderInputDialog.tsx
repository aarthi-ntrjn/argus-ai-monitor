import { Button } from '../Button';

interface FolderInputDialogProps {
  folderInputPath: string;
  onPathChange: (path: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function FolderInputDialog({ folderInputPath, onPathChange, onSubmit, onCancel }: FolderInputDialogProps) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 id="folder-dialog-title" className="text-lg font-semibold mb-1">Add Repositories</h2>
        <p className="text-gray-500 text-sm mb-4">Enter a root folder path to scan for git repositories.</p>
        <input
          autoFocus
          type="text"
          value={folderInputPath}
          onChange={e => onPathChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. C:\source or /home/user/projects"
          aria-label="Repository folder path"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!folderInputPath.trim()}>
            Scan &amp; Add
          </Button>
        </div>
      </div>
    </div>
  );
}
