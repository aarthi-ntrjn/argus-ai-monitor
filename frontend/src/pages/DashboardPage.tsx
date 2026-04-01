import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getRepositories, getSessions, addRepository, removeRepository, pickFolder, queryClient } from '../services/api';
import type { Repository, Session } from '../types';
import SessionCard from '../components/SessionCard/SessionCard';

interface RepoWithSessions extends Repository {
  sessions: Session[];
}

export default function DashboardPage() {
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const { data: repos = [], isLoading: reposLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: getRepositories,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getSessions(),
  });

  const reposWithSessions: RepoWithSessions[] = repos.map((repo) => ({
    ...repo,
    sessions: sessions.filter((s) => s.repositoryId === repo.id),
  }));

  const handleAddRepo = async () => {
    setAddError(null);
    setAdding(true);
    try {
      const path = await pickFolder();
      if (!path) return;
      await addRepository(path);
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add repository';
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveRepo = async () => {
    if (!removeConfirmId) return;
    setRemoving(true);
    try {
      await removeRepository(removeConfirmId);
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } finally {
      setRemoving(false);
      setRemoveConfirmId(null);
    }
  };

  if (reposLoading || sessionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Argus Dashboard</h1>
          <button
            onClick={handleAddRepo}
            disabled={adding}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add Repository'}
          </button>
        </div>

        {addError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex justify-between">
            <span>{addError}</span>
            <button onClick={() => setAddError(null)} className="ml-4 font-bold">x</button>
          </div>
        )}

        {reposWithSessions.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-xl">No repositories registered.</p>
            <p className="mt-2">Click "Add Repository" to get started.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reposWithSessions.map((repo) => (
              <div key={repo.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{repo.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{repo.path}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                      {repo.sessions.length} session{repo.sessions.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setRemoveConfirmId(repo.id)}
                      title="Remove repository"
                      className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                {repo.sessions.length === 0 ? (
                  <p className="text-gray-400 text-sm">No active sessions</p>
                ) : (
                  <div className="space-y-2">
                    {repo.sessions.map((session) => (
                      <SessionCard key={session.id} session={session} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {removeConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-2">Remove Repository</h2>
            <p className="text-gray-600 text-sm mb-4">
              Remove <span className="font-semibold">{reposWithSessions.find(r => r.id === removeConfirmId)?.name}</span>?
              This will also delete all associated sessions and output history.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRemoveConfirmId(null)} disabled={removing} className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50">Cancel</button>
              <button onClick={handleRemoveRepo} disabled={removing} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50">
                {removing ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
