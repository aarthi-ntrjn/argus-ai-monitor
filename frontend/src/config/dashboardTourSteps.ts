import type { TourStep } from '../types';

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour-id="dashboard-header"]',
    title: '👋 Welcome!',
    content: "You're running a team of Claude Code and GitHub Copilot CLI sessions. Argus helps you keep track of them all. Let's go!",
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
    content: "Each card shows a repo and its active AI sessions, all updating live.",
    placement: 'right',
    disableBeacon: true,
    targetWaitTimeout: 5000,
  },
  {
    target: '[data-tour-id="dashboard-session-card"]',
    title: '🤖 AI Sessions',
    content: "Monitor your AI sessions here. Sessions launched outside of Argus are read-only.",
    placement: 'right',
    disableBeacon: true,
    targetWaitTimeout: 5000,
  },
  {
    target: '[data-tour-id="dashboard-launch"]',
    title: '🚀 Launch with Argus',
    content: "You can control your AI sessions when launched from Argus.",
    placement: 'bottom',
    disableBeacon: true,
    targetWaitTimeout: 5000,
  },
  {
    target: '[data-tour-id="dashboard-settings"]',
    title: '⚙️ Customize Your View',
    content: "Hide ended or inactive sessions, and replay this tour anytime. You're in control.",
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="dashboard-todo"]',
    title: '📝 To Do or Not To Do',
    content: "Track your wild ideas here.",
    placement: 'left',
    disableBeacon: true,
    targetWaitTimeout: 5000,
  },
  {
    // Final step uses a centered modal - no element target needed
    target: 'body',
    title: "🎉 You're all set!",
    content: "You're officially an Argus pro. Your AI team awaits. Go build something awesome!",
    placement: 'center',
    disableBeacon: true,
  },
];
