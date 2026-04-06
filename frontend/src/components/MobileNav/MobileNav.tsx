type MobileTab = 'sessions' | 'tasks';

interface Props {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export default function MobileNav({ activeTab, onTabChange }: Props) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-40 flex border-t border-gray-200 bg-white md:hidden"
      style={{ height: '56px' }}
    >
      <button
        aria-pressed={activeTab === 'sessions'}
        aria-label="Sessions"
        onClick={() => onTabChange('sessions')}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
          activeTab === 'sessions' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Sessions
      </button>
      <button
        aria-pressed={activeTab === 'tasks'}
        aria-label="Tasks"
        onClick={() => onTabChange('tasks')}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
          activeTab === 'tasks' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Tasks
      </button>
    </nav>
  );
}
