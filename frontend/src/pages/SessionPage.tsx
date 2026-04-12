import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '../services/api';
import OutputPane from '../components/OutputPane/OutputPane';
import SessionPromptBar from '../components/SessionPromptBar/SessionPromptBar';
import SessionMetaRow from '../components/SessionMetaRow/SessionMetaRow';


export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery({
    queryKey: ['session', id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <button onClick={() => navigate('/')} className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1">
          ← Back to Dashboard
        </button>
        <div className="text-center text-gray-500 py-16">Session not found.</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* Always-visible header — shrink-0 sibling of the scrollable area */}
      <div className="shrink-0 px-4 md:px-8 pt-4 md:pt-6">
        <div className="max-w-4xl mx-auto w-full">
          <button onClick={() => navigate('/')} className="text-sm font-medium text-gray-700 hover:text-blue-600 mb-4 py-2 flex items-center gap-1">
            <ArrowLeft size={14} />Back
          </button>
          <div data-tour-id="session-status">
            <SessionMetaRow session={session} />
            {session.summary && (
              <p className="text-gray-600 text-sm mt-2">{session.summary}</p>
            )}
          </div>
        </div>
      </div>

      {/* Output stream + prompt bar — fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col px-4 md:px-8 pb-4 md:pb-6 mt-4">
        <div className="max-w-4xl mx-auto w-full flex-1 min-h-0 flex flex-col">

          <OutputPane
            session={session}
            className="flex-1 min-h-0 shadow"
            data-tour-id="session-output-stream"
          />

          <div data-tour-id="session-prompt-bar" className="mt-2 shrink-0">
            <SessionPromptBar session={session} />
          </div>

        </div>
      </div>

    </div>
  );
}
