# Tasks: 041-perf-and-fixes

## Phase 1 — PTY Reliability

- [X] T001 [P1] Persist `pty_launch_id` in DB schema and sessions table
- [X] T002 [P1] Generate `ptyLaunchId` UUID in `launch.ts` and pass via `?id=` WS URL
- [X] T003 [P1] Immediate reconnect in launcher route when existing session found by `ptyLaunchId`
- [X] T004 [P1] Fix `notifySessionEnded` to include `sessionId` in message payload
- [X] T005 [P1] Fix stale test method name `claimByTempId` → `claimByPtyLaunchId`
- [X] T006 [P1] Apply immediate reconnect to copilot-cli sessions (same as claude-code)
- [X] T007 [P1] Add 3-guard PID validation to prevent PID reuse false positives

## Phase 2 — UX Improvements

- [X] T008 [P2] Session card hover: neutral gray; selected: blue
- [X] T009 [P2] Output pane: single-click opens, only X button closes
- [X] T010 [P2] Persist selected session ID in localStorage
- [X] T011 [P2] Dashboard layout: output pane flex-[4], todo panel flex-[1]
- [X] T012 [P3] Settings panel: increase padding, reduce width
- [X] T013 [P3] SessionPromptBar: consolidate PTY state into readonly/connecting/connected

## Phase 3 — Rescan Remote URLs

- [X] T014 [P2] Backend: `POST /api/v1/repositories/rescan-remotes` endpoint
- [X] T015 [P2] Frontend: `rescanRemoteUrls()` API function
- [X] T016 [P2] Settings panel: "Rescan Remote URLs" button with scanning/done states
- [X] T017 [P2] Contract test for `rescan-remotes` endpoint

## Phase 4 — Documentation

- [X] T018 [P1] Update README: output pane selection persistence
- [X] T019 [P1] Update README: Rescan Remote URLs feature
- [X] T020 [P1] Write spec.md, plan.md, tasks.md
