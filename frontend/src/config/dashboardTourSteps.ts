import type { TourStep } from '../types';

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour-id="dashboard-header"]',
    title: '👋 Welcome Commander!',
    content: "You're running an AI army of Claude Code and GitHub Copilot CLI sessions. Argus is your command center. Let's go!",
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
    content: "Sessions launched via Argus show a green \"live\" badge (command mode): you can send prompts and control them. Auto-detected sessions show a grey \"read-only\" badge (view mode): you can monitor output but not send commands.",
    placement: 'right',
    disableBeacon: true,
    targetWaitTimeout: 5000,
  },
  {
    target: '[data-tour-id="dashboard-launch"]',
    title: '🚀 Launch with Argus',
    content: "Start a new Claude Code or Copilot CLI session directly from Argus. Sessions launched here run in command mode: you can send prompts, interrupt, and control them remotely.",
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
    // Final step uses a centered modal - no element target needed
    target: 'body',
    title: "🎉 You're all set!",
    content: "You're officially an Argus pro. Your AI army awaits. Go build something awesome!",
    placement: 'center',
    disableBeacon: true,
  },
];
