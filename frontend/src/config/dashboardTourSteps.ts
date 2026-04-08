import type { TourStep } from '../types';

/**
 * Steps that always exist on the dashboard (empty or populated).
 */
const ALWAYS_STEPS: TourStep[] = [
  {
    target: '[data-tour-id="dashboard-header"]',
    title: '👋 Welcome!',
    content: "Argus helps you manage and control your team of CLI sessions. Let's go!",
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="dashboard-add-repo"]',
    title: '📁 Add Repositories',
    content: "Add a folder of repositories and Argus will sniff out every AI session running inside them.",
    placement: 'bottom',
    disableBeacon: true,
  },
];

/**
 * Steps that only make sense when at least one repo (and ideally sessions) exist.
 */
const POPULATED_STEPS: TourStep[] = [
  {
    target: '[data-tour-id="dashboard-repo-card"]',
    title: '🗂️ Your Repositories',
    content: "Each card shows a repo and its active AI sessions, all updating live.",
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="dashboard-session-card"]',
    title: '🤖 AI Sessions',
    content: "Monitor your AI sessions here. Sessions launched outside of Argus are read-only.",
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="dashboard-launch"]',
    title: '🚀 Launch with Argus',
    content: "You can control your AI sessions when launched from Argus.",
    placement: 'bottom',
    disableBeacon: true,
  },
];

const CLOSING_STEPS: TourStep[] = [
  {
    target: '[data-tour-id="dashboard-todo"]',
    title: '📝 To Do or Not To Do',
    content: "Track your wild ideas here.",
    placement: 'left',
    disableBeacon: true,
  },
  {
    target: 'body',
    title: "🎉 You're all set!",
    content: "You're officially an Argus pro. Your AI team awaits. Go build something awesome!",
    placement: 'center',
    disableBeacon: true,
  },
];

export function buildDashboardTourSteps(hasRepos: boolean): TourStep[] {
  return [
    ...ALWAYS_STEPS,
    ...(hasRepos ? POPULATED_STEPS : []),
    ...CLOSING_STEPS,
  ];
}

/** Default steps with all sections (for backwards compat with tests). */
export const DASHBOARD_TOUR_STEPS = buildDashboardTourSteps(true);
