import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ArgusLogo from '../components/ArgusLogo';

const EVENTS = [
  { name: 'app_started', when: 'The Argus backend server starts and begins listening.' },
  { name: 'app_ended', when: 'The Argus backend server shuts down gracefully (SIGTERM or SIGINT).' },
  { name: 'session_started', when: 'A new session is detected.' },
  { name: 'session_ended', when: 'A session ends (process exits or is reconciled as finished).' },
  { name: 'session_stopped', when: 'You manually stop a session using the Stop button.' },
  { name: 'session_prompt_sent', when: 'You send a prompt to a session via Argus.' },
  { name: 'todo_added', when: 'You add a new todo item in Argus.' },
  { name: 'repo_diff_opened', when: 'You click the "View diff on GitHub" button for a repository.' },
];

export default function TelemetryPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <button onClick={() => navigate('/')} className="icon-btn text-sm font-medium text-gray-700 hover:text-blue-600 mb-6 flex items-center gap-1">
            <ArrowLeft size={14} />Back
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 mb-1">
            <ArgusLogo size={28} />
            Telemetry &amp; Privacy
          </h1>
          <p className="text-sm text-gray-500">What Argus collects and when.</p>
        </div>

        <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">What is included</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <span className="font-medium text-gray-900">Anonymous installation ID:</span> a random UUID generated on first run. It is not linked to your identity, account, or machine.
            </li>
            <li>
              <span className="font-medium text-gray-900">App version:</span> the Argus version number (e.g. 0.1.0).
            </li>
            <li>
              <span className="font-medium text-gray-900">Timestamp:</span> when the event occurred (UTC).
            </li>
            <li>
              <span className="font-medium text-gray-900">Session ID:</span> a random UUID assigned to each session. Not linked to any user or machine.
            </li>
            <li>
              <span className="font-medium text-gray-900">Session type:</span> whether the session is Claude Code or Copilot.
            </li>
            <li>
              <span className="font-medium text-gray-900">Launch mode:</span> whether the session was launched via Argus (connected) or auto-detected (readonly).
            </li>
            <li>
              <span className="font-medium text-gray-900">Yolo mode:</span> whether the session was started with the <span className="font-mono">--dangerously-skip-permissions</span> or <span className="font-mono">--allow-all</span> flags.
            </li>
          </ul>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Events</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left font-medium text-gray-700 pb-2 pr-4 w-40">Event</th>
                <th className="text-left font-medium text-gray-700 pb-2">When</th>
              </tr>
            </thead>
            <tbody>
              {EVENTS.map(event => (
                <tr key={event.name} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 font-mono text-gray-900 align-top">{event.name}</td>
                  <td className="py-2 text-gray-600 align-top">{event.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">What is never collected</h2>
          <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
            <li>File paths or repository names</li>
            <li>Prompts or session content</li>
            <li>Usernames or account information</li>
            <li>IP address or hostname</li>
            <li>Operating system or hardware details</li>
          </ul>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Opting out</h2>
          <p className="text-sm text-gray-700">
            Open the settings panel (gear icon, top right of the dashboard) and uncheck{' '}
            <span className="font-medium">Send anonymous usage telemetry</span> under Privacy.
            No events will be sent after that.
          </p>
        </section>
      </div>
    </div>
  );
}
