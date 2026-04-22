import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import ArgusLogo from '../ArgusLogo';

// --- Primitives ---

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  return (
    <button type="button" onClick={handle} aria-label="Copy to clipboard" className="icon-btn text-gray-400 hover:text-blue-600 shrink-0">
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
    </button>
  );
}

export function CodeBlock({ value }: { value: string }) {
  return (
    <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 mt-2">
      <code className="text-xs font-mono text-gray-800 flex-1 whitespace-pre">{value}</code>
      <CopyButton value={value} />
    </div>
  );
}

export function Mono({ children }: { children: string }) {
  return <code className="text-xs font-mono bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">{children}</code>;
}

export function ExternalA({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{children}</a>;
}

// --- Layout ---

export interface SetupStep {
  title: string;
  body: React.ReactNode;
}

interface SetupPageProps {
  title: string;
  subtitle: string;
  logoSrc: string;
  prerequisites: React.ReactNode;
  steps: SetupStep[];
}

export function SetupPage({ title, subtitle, logoSrc, prerequisites, steps }: SetupPageProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="mx-auto max-w-2xl">

        <div className="mb-8">
          <button onClick={() => navigate('/')} className="icon-btn text-sm text-gray-600 hover:text-blue-600 mb-6 flex items-center gap-1.5">
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <ArgusLogo size={24} />
            <img src={logoSrc} alt="" width={20} height={20} aria-hidden="true" />
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </div>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prerequisites</h2>
          {prerequisites}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
          {steps.map((step, i) => (
            <div key={step.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold shrink-0">
                  {i + 1}
                </div>
                {i < steps.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1.5" />}
              </div>
              <div className={`flex-1 ${i < steps.length - 1 ? 'pb-6' : 'pb-0'}`}>
                <h2 className="text-sm font-semibold text-gray-900 mb-2 leading-6">{step.title}</h2>
                {step.body}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <button onClick={() => navigate('/')} className="icon-btn text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1.5">
            <ArrowLeft size={13} aria-hidden="true" /> Back to Argus
          </button>
        </div>

      </div>
    </div>
  );
}
