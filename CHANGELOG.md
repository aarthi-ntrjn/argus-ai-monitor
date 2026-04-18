# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-12

First public release.

### Added

- **Session monitoring**: real-time detection and monitoring of Claude Code and GitHub Copilot CLI sessions
- **Session output streaming**: live output pane with Focused and Verbose display modes
- **Kill session**: terminate any active session with a known PID via the dashboard or detail page
- **Launch with Argus**: start Claude Code or Copilot CLI sessions with PTY control for prompt injection
- **Prompt bar**: send prompts to live sessions directly from the browser
- **Repository management**: scan and register git repositories with one-click bulk import
- **To Tackle panel**: built-in task list for notes and reminders
- **Dashboard settings**: configurable filters (hide ended, hide inactive, hide empty repos) and resting threshold
- **Yolo mode**: launch sessions with all permission checks disabled
- **Mobile browser support**: responsive layout for viewports 390px and up
- **Onboarding tour**: interactive walkthrough for first-time users
- **npm package**: install and run via `npx argus`
- **CONTRIBUTING.md**: contribution guidelines
- **SECURITY.md**: security policy with GitHub Private Vulnerability Reporting
