import type { TourStep } from '../types';

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour-id="dashboard-header"]',
    title: '👋 Welcome Commander!',
    content: "You're running an AI army of Claude Code and GitHub Copilot CLI sessions - Argus is your command center. Let's go!",
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
  {
    target: '[data-tour-id="dashboard-repo-card"]',
    title: '🗂️ Your Repositories',
    content: "Each card shows a repo and its active AI sessions - all updating live.",
    placement: 'right',
    disableBeacon: true,
    targetWaitTimeout: 5000,
  },
  {
    target: '[data-tour-id="dashboard-session-card"]',
    title: '🤖 AI Sessions',
    content: "Each row is a live Claude Code or GitHub Copilot CLI session. Click to see the live stream, control it via the ⋮ actions menu, and send it messages.",
    placement: 'right',
    disableBeacon: true,
    targetWaitTimeout: 5000,
  },
  {
    target: '[data-tour-id="dashboard-settings"]',
    title: '⚙️ Customise Your View',
    content: "Hide ended or inactive sessions, and replay this tour anytime. You're in control.",
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    // Final step uses a centered modal - no element target needed
    target: 'body',
    title: "🎉 You're all set!",
    content: "You're officially an Argus pro. Your AI army awaits - go build something awesome!",
    placement: 'center',
    disableBeacon: true,
  },
];
