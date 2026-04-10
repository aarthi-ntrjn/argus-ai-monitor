# Argus: Output Stream Manual Tests

Manual tests for the inline output pane and real-time updates. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least one session with output exists

---

## P0: Inline output pane (desktop)

**Prerequisites:** Desktop viewport (>768px).

| # | Steps | Expected |
|---|-------|----------|
| P-01 | Click on a session card | An output pane slides in on the right side showing the session's output stream |
| P-02 | Click the same session card again | The output pane closes |
| P-03 | Click a different session card while the pane is open | The pane updates to show the newly selected session's output |
| P-04 | Press **Escape** while the output pane is open | The pane closes |

---

## P1: Real-time updates (WebSocket)

**Prerequisites:** The dashboard is open and at least one session is active.

| # | Steps | Expected |
|---|-------|----------|
| P-05 | Open the dashboard with an active session | The session card's elapsed time updates in real time without refreshing |
| P-06 | From another terminal, trigger activity on an active session | The session card's last output preview and status update automatically |
| P-07 | End a session externally (e.g. type `/exit` in a Claude terminal) | The session card transitions to "ended" status within a few seconds without refreshing |
| P-08 | Open browser DevTools > Network > WS tab | A WebSocket connection to `/ws` is active; events like `session.updated` appear in the message log |

---

## P2: Claude Code output stream content

**Prerequisites:** At least one active or recent Claude Code session with varied output (messages, tool calls, thinking blocks).

| # | Steps | Expected |
|---|-------|----------|
| P-09 | Open the output pane for a Claude Code session that includes an assistant text response | An "AI" badge (blue) appears next to the message content |
| P-10 | Locate a Claude Code entry where the assistant used a tool (e.g. Read, Edit) | Two separate output rows appear: one "AI" (blue) for the text and one "TOOL" (purple) showing the tool name |
| P-11 | Locate a tool result entry in a Claude Code session | A "RESULT" (green) badge appears with the tool output content |
| P-12 | Locate a user message in a Claude Code session | A "YOU" (gray) badge appears next to the user's input |
| P-13 | Locate a status change entry (e.g. session start) | A "STATUS" (yellow) badge appears |
| P-14 | Verify that tool names display correctly for Claude Code tools (e.g. Read, Edit, Bash) | The tool name appears in the TOOL row's content or label |

---

## P3: Copilot CLI output stream content

**Prerequisites:** At least one active or recent Copilot CLI session with varied output (messages, tool executions).

| # | Steps | Expected |
|---|-------|----------|
| P-15 | Open the output pane for a Copilot CLI session that includes an assistant message | An "AI" badge (blue) appears next to the message content |
| P-16 | Locate a tool execution start entry in a Copilot CLI session | A "TOOL" (purple) badge appears with the tool name from the event |
| P-17 | Locate a tool execution complete entry in a Copilot CLI session | A "RESULT" (green) badge appears with the tool result content |
| P-18 | Locate a user message in a Copilot CLI session | A "YOU" (gray) badge appears next to the user's input |
| P-19 | Locate a session start event in a Copilot CLI session | A "STATUS" (yellow) badge appears |
| P-20 | Compare the same badge type (e.g. TOOL) across a Claude Code and a Copilot CLI session | Both render with the same badge color and layout, despite originating from different JSONL formats |

---

## P4: Error handling per session type

**Prerequisites:** Sessions that have encountered errors or parsing failures.

| # | Steps | Expected |
|---|-------|----------|
| P-21 | Open a Claude Code session where an error occurred (e.g. tool failure) | An "ERR" (red) badge appears with the error content |
| P-22 | Open a Copilot CLI session where an error occurred | An "ERR" (red) badge appears with the error content |
| P-23 | Open a session whose JSONL file contains a malformed line | The valid entries still render; the malformed line is skipped without crashing the pane |

---

## P5: Focused mode

**Prerequisites:** A session with multiple tool calls and results (e.g. an active Claude Code session that has used Read, Edit, or Bash).

| # | Steps | Expected |
|---|-------|----------|
| P-24 | Open the output pane for any session | The mode toggle button in the header reads "Focused" (this is the default) |
| P-25 | Locate a tool call row in focused mode | The TOOL row shows the tool name badge and a one-line summary; no separate RESULT row appears beneath it |
| P-26 | Click "show result" on a paired tool row | The tool result content expands inline; the button label changes to "hide result" |
| P-27 | Click "hide result" on an expanded tool row | The result collapses; the button reverts to "show result" |
| P-28 | Find a session where the model made several consecutive tool calls | The tool calls are grouped into a single collapsible block showing a summary such as "3 tool calls: Read, Edit, Bash" |
| P-29 | Click the ▸ arrow on a tool group | The group expands to show all individual tool pairs inside it; the arrow changes to ▾ |
| P-30 | Click the ▾ arrow on an expanded tool group | The group collapses back to the summary row |
| P-31 | Inspect the output for a session that has orphaned tool results (result with no matching tool use) | The orphaned RESULT rows do not appear in the list |
| P-32 | Observe a tool_use entry that arrived before its result (e.g. mid-stream in an active session) | The tool call renders as a single TOOL row with a "show details" button rather than a paired row |

---

## P6: Verbose mode

**Prerequisites:** A session with multiple tool calls and results, including at least one tool result that is more than 40 lines long.

| # | Steps | Expected |
|---|-------|----------|
| P-33 | With the output pane open in Focused mode, click the "Focused" button | The button label changes to "Verbose" and the output re-renders immediately |
| P-34 | Inspect the output in verbose mode | Every item appears as its own row: tool calls have a TOOL row and their results have a separate RESULT row directly beneath |
| P-35 | Verify tool grouping in verbose mode | No collapsible tool groups appear; all rows are flat and sequential |
| P-36 | Locate a RESULT row whose content exceeds 40 lines in verbose mode | The content is truncated at 40 lines with a "show more" button at the bottom |
| P-37 | Click "show more" on a truncated RESULT row | The full content expands; the "show more" button disappears |
| P-38 | Switch back to focused mode by clicking the "Verbose" button | The button label returns to "Focused" and tool pairs are grouped and paired again |

---

## P7: Mode persistence

**Prerequisites:** Argus is running with at least one session visible.

| # | Steps | Expected |
|---|-------|----------|
| P-39 | Switch the output pane to Verbose mode, then close the pane | The mode selection is saved |
| P-40 | Click a session card to reopen the output pane | The pane reopens in Verbose mode (the toggle button reads "Verbose") |
| P-41 | Refresh the page, then open any session's output pane | The previously chosen mode (Verbose) is still active after the page reload |
| P-42 | Switch to Focused mode, refresh, and reopen the output pane | The pane opens in Focused mode, confirming the setting was updated and persisted |
