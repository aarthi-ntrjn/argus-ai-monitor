---
description: Auto-generate a CHANGELOG.md entry for the current version from commits since the last tag, and commit it to master.
---

## Invocation rules

This skill may be invoked:
- Explicitly by the user typing `/update-changelog`
- Automatically as a step inside `/publish-npm` — in that case, skip the standalone invocation check and proceed directly

If invoked as `/update-changelog` standalone, only run on `master`. If not on `master`, stop and say:
"This skill must be run from `master`. You are currently on `<branch>`."

---

## Outline

You are generating a human-readable changelog entry for the version about to be released.

---

### Step 1 — Read the new version

Run:
```bash
node -e "console.log(require('./package.json').version)"
```

This is the version being released (e.g. `0.1.10`). The tag will be `v<version>`.

---

### Step 2 — Find the previous tag

Run:
```bash
git describe --tags --abbrev=0
```

This is the last released tag (e.g. `v0.1.9`).

---

### Step 3 — Collect commits since last tag

Run:
```bash
git --no-pager log <previous-tag>..HEAD --pretty=format:"%h %s" --no-merges
```

Collect the full list. These are the raw material for the entry.

---

### Step 4 — Categorize and write the changelog entry

Using the commit list, write a `## [<version>] - <today's date YYYY-MM-DD>` section.

**Categorization rules:**

| Commit prefix | Changelog section |
|---|---|
| `feat` | ### Added |
| `fix` | ### Fixed |
| `perf`, `refactor` | ### Changed |
| `docs` (user-facing only) | ### Changed |
| `ci`, `chore`, `test`, `style`, `build` | Omit |
| merge-gate fixes | Omit |
| version bump commits | Omit |

**Writing rules:**
- Each bullet must be a clear, human-readable sentence — not a raw commit subject line.
- Group related commits into a single bullet when they form one logical change.
- Lead each bullet with a **bold noun phrase** (e.g. `**Session output streaming**`) for scanability.
- Never use em dashes. Use a comma, colon, or reword instead.
- Omit sections that have no entries (do not write empty `### Added` headers).
- Do not include internal housekeeping, spec/task tracking commits, CI pipeline tweaks, or test-only fixes unless they directly affect the user.

---

### Step 5 — Prepend to CHANGELOG.md

Read the current `CHANGELOG.md`. Insert the new section immediately after the header block (after the last line of the preamble, before the first `## [` entry).

The result should look like:

```markdown
# Changelog

All notable changes...

The format is based on...

## [0.1.10] - 2026-04-21

### Added

- **Feature name**: description of what it does.

### Fixed

- **Component**: description of what was fixed.

## [0.1.9] - 2026-04-20
...
```

Write the updated file.

---

### Step 6 — Commit

Run:
```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for v<version>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Do NOT push. The push happens in the calling skill (`/publish-npm`).

---

### Step 7 — Report

Print:
```
CHANGELOG updated for v<version> — <N> entries written.
```

List the bullet points that were added so the user can review them before the tag is created.
