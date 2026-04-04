import type { TourStep } from '../types';

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour-id="dashboard-header"]',
    title: 'Welcome to Argus',
    content: 'Argus monitors and controls your Claude Code and Copilot sessions from one place. This quick tour will show you around.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="dashboard-add-repo"]',
    title: 'Add a Repository',
    content: 'Click here to add a git repository. Argus will scan it and begin tracking any AI coding sessions running inside it.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="dashboard-repo-card"]',
    title: 'Your Repositories',
    content: 'Each card shows a repository and all active sessions within it. Sessions update in real time.',
    placement: 'right',
    disableBeacon: true,
    targetWaitTimeout: 5000,
  },
  {
    target: '[data-tour-id="dashboard-session-card"]',
    title: 'AI Sessions',
    content: 'Each row is a live Claude Code or Copilot session. Click a session to open the output pane and control panel.',
    placement: 'right',
    disableBeacon: true,
    targetWaitTimeout: 5000,
  },
  {
    target: '[data-tour-id="dashboard-settings"]',
    title: 'Customise Your View',
    content: 'Use Settings to hide ended sessions, filter inactive ones, or restart this tour at any time.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    // Final step uses a centered modal — no element target needed
    target: 'body',
    title: "You're all set!",
    content: "You now know your way around Argus. Head back here anytime — sessions are always one click away.",
    placement: 'center',
    disableBeacon: true,
  },
];
