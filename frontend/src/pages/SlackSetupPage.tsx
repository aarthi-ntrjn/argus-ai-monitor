import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import ArgusLogo from '../components/ArgusLogo';
import slackGuide from '../../../docs/README-SLACK-APP.md?raw';

const COMPONENTS: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-semibold text-gray-900 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-medium text-gray-700 mt-4 mb-2">{children}</h3>,
  p: ({ children }) => <p className="text-sm text-gray-700 mb-3">{children}</p>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    return isBlock
      ? <code className="block text-sm font-mono bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto mb-3 whitespace-pre">{children}</code>
      : <code className="text-sm font-mono bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">{children}</code>;
  },
  pre: ({ children }) => <>{children}</>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sm text-gray-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm text-gray-700">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-200 pl-4 text-gray-500 text-sm italic my-3">{children}</blockquote>,
  hr: () => <hr className="border-gray-200 my-6" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="text-sm w-full border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="text-left text-xs font-medium text-gray-600 border-b border-gray-200 py-2 px-3 bg-gray-50">{children}</th>,
  td: ({ children }) => <td className="text-sm text-gray-700 border-b border-gray-100 py-2 px-3">{children}</td>,
};

export default function SlackSetupPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <button onClick={() => navigate('/')} className="icon-btn text-sm font-medium text-gray-700 hover:text-blue-600 mb-6 flex items-center gap-1">
            <ArrowLeft size={14} />Back
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 mb-1">
            <ArgusLogo size={28} />
            Slack Setup
          </h1>
          <p className="text-sm text-gray-500">How to configure Slack notifications.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
            {slackGuide}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
