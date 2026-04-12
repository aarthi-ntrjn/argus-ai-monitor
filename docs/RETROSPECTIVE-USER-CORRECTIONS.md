# Retrospective: Where User Said AI Was Wrong or Had to Correct It

**Date**: 2026-04-12
**Scope**: `c:\source\github\artynuts\argus*` -> `C--source-github-artynuts-argus`, `C--source-github-artynuts-argus2`, `C--source-github-artynuts-argus3`, `C--source-github-artynuts-argus4`
**Sessions scanned**: 80 (main sessions, subagents excluded)
**Sessions with matches**: 8
**Copilot sessions**: 0 matched

## Summary

Eight sessions contained explicit user corrections where the AI produced wrong output and the user had to intervene. The corrections cluster heavily around two feature branches: `020-fix-send-prompts` (3 sessions) and `024-short-name-ghcp` (2 sessions). The most severe case involved the AI generating a hallucinated process ID in PTY child-tree walking logic. The pattern that triggered the most corrections was the AI making assumptions about UI behaviour or data structures it had not directly verified.

---

## Findings

### `9d764f12` — argus2 (branch: 025-yolo-mode)

**3 corrections within 1 hour on the same issue**
**Confidence**: HIGH

```
02:21:35  [USER] this is wrong - G-03
03:23:38  [USER] this is very wrong.
03:23:51  [USER] this is very wrong. revert these changes - you are assuming that if the
                 config says its is yolomode then the session is yolo mode
```

The AI made a false assumption: it inferred yolo mode status directly from config rather than from actual session state. The user had to correct it three times, with the third correction explicitly stating the wrong assumption and demanding a revert. The AI did not self-identify the problem between the first and second correction.

---

### `854c156f` — argus2 (branch: 024-short-name-ghcp)

**Hallucinated process ID in PTY child-tree logic**
**Confidence**: HIGH

```
22:36:20  [USER] the entire logic to walk the child tree fo PTY process if wrong. fully.
                 it si finding some hallucinated process id
```

The user used the word "hallucinated" explicitly. The AI constructed PTY child-tree walking logic that referenced a process ID that did not exist. The failure was described as total ("wrong. fully.") not a minor edge case.

---

### `efa9d835` — argus2 (branch: 024-short-name-ghcp)

**Two corrections in 90 seconds on the same PTY problem area**
**Confidence**: HIGH

```
22:17:25  [USER] the parent walking logic is pretty wrong [log output follows]
22:18:55  [USER] the process id of the intermediate node is also wrong.
```

Same feature branch and same problem domain as `854c156f` above. Both occurred on 2026-04-11 within an hour of each other, suggesting the PTY process-walking logic on `024-short-name-ghcp` was a consistently unreliable area across multiple sessions.

---

### `c9f74d87` — argus2 (branch: 022-test-ghcp-launch)

**AI wrong about UI element existence**
**Confidence**: HIGH

```
10:55:04  [USER] youare wrong on the repo card there is a launch with argus button
                 that has a dropdown
          [ASST] My mistake. Let me find it properly.
```

The AI asserted that a UI element (launch button with dropdown) did not exist on the repo card. The user corrected it. This is one of the few cases where the AI explicitly acknowledged the error ("My mistake").

---

### `50fe500b` — argus2 (branch: 020-fix-send-prompts)

**AI misread a test case specification**
**Confidence**: HIGH

```
19:57:20  [USER] L0-03 is wrong - for a readonly session there is not input.
19:59:19  [USER] i am talking about this one   L0-03   If a Claude session detected
                 automatically (not via Argus launch) is also visible on the dashboard,
                 click its prompt input   Input is disabled...
```

The AI produced a test case (L0-03) that assumed read-only sessions have prompt input. The user corrected it and had to provide the correct expected behaviour on the follow-up.

---

### `1d7bb25f` — argus2 (branch: 020-fix-send-prompts)

**User asked AI to formally document its wrong decision**
**Confidence**: HIGH

```
10:22:44  [USER] add your incorrect decision and learning to learning.md file
```

This is the only case where the user asked the AI to acknowledge the mistake in writing and add it to the project learnings log. The phrasing implies the AI had made a significant enough wrong call that it warranted permanent documentation, not just a quick fix.

---

### `f5de134e` — argus (branch: master)

**Two corrections of skill documentation in one session**
**Confidence**: HIGH

```
05:16:20  [USER] this is not true - Copilot conversations in VS Code are stored in
                 SQLite databases under %APPDATA%\Code\User\workspaceStorage\...
05:24:21  [USER] This is wrong, i want it not miss conversations. You can skip all
                 the tool calls as they are just read and writing content.
```

Both occurred during authoring of the `/retrospective` skill (this session). The first corrected a factually wrong claim about where Copilot stores conversations. The second corrected a flawed constraint that would cause the skill to truncate and miss conversations. Both were factual errors in generated documentation, not code.

---

### `d2e7d5c2` — argus2 (branch: 020-fix-send-prompts)

**User challenged AI's understanding of session timeout behaviour**
**Confidence**: MEDIUM

```
05:28:56  [USER] Hmm, that sounds incorrect. I thought resting was 20 mins and it was
                 front end only behavior based on last activity at
```

The AI stated something about session timeout/resting that the user believed was wrong. Softer phrasing ("sounds incorrect") and no explicit revert requested. The user provided their understanding as a correction.

---

## Observations

- **Branch `024-short-name-ghcp` produced the most severe corrections.** Two separate sessions (`854c156f` and `efa9d835`) on the same branch both had the AI wrong about PTY process-walking logic, with one case producing a hallucinated process ID. This suggests the AI lacks reliable grounding when dealing with OS-level process trees and should verify actual `/proc` or `wmic` output rather than inferring structure.

- **Branch `020-fix-send-prompts` had 3 sessions with corrections** (1d7bb25f, 50fe500b, d2e7d5c2), all involving incorrect assumptions about UI state or session behaviour. This feature involved subtle distinctions (readonly vs live sessions, input availability) that the AI consistently got wrong without explicit verification.

- **UI element existence was a correction trigger.** In `c9f74d87`, the AI claimed a UI element didn't exist when it did. The AI should read the component source before asserting what is or isn't rendered.

- **The AI rarely acknowledged being wrong spontaneously.** Only one case (`c9f74d87`) showed the AI producing "My mistake" in its response. In all other cases the assistant either silently corrected or responded with a tool call, suggesting the AI does not self-flag when it makes factual errors.

- **One correction resulted in a formal learning entry** (`1d7bb25f`). This is the highest-cost correction in the set — the user considered the wrong decision significant enough to document it permanently.

- **Corrections about documentation/skill content** (`f5de134e`) were easier to catch because the user could read the output directly. Corrections about code logic (`854c156f`, `9d764f12`) required the user to run or inspect the code to discover the error.
