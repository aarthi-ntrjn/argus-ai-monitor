import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getRepositories, getSessions, addRepository, queryClient } from '../services/api';
import type { Repository, Session } from '../types';
import SessionCard from '../components/SessionCard/SessionCard';

interface RepoWithSessions extends Repository {
  sessions: Session[];
}

export default function DashboardPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRepoPath, setNewRepoPath] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      await addRepository(newRepoPath);
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
      setShowAddModal(false);
      setNewRepoPath('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add repository';
      setAddError(msg);
    } finally {
      setAdding(false);
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
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add Repository
          </button>
        </div>

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
                  <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                    {repo.sessions.length} session{repo.sessions.length !== 1 ? 's' : ''}
                  </span>
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Repository</h2>
            <form onSubmit={handleAddRepo}>
              <input
                type="text"
                value={newRepoPath}
                onChange={(e) => setNewRepoPath(e.target.value)}
                placeholder="Enter repository path..."
                className="w-full border border-gray-300 rounded px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {addError && <p className="text-red-500 text-sm mb-3">{addError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={adding || !newRepoPath} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                  {adding ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}