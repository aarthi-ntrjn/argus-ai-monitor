---
description: Generate a meaningful PR description for the public repo sync, then run the publish pipeline (push sync branch, CI gate, merge).
---

## Invocation rules

**ONLY execute this skill when the user explicitly types `/push-to-public` as a standalone command.**
Do NOT execute it in response to any of the following:
- Phrases like "publish", "sync the public repo", "push to public", or any paraphrase
- Being asked to "run the next step" when publish is implied
- Any autonomous or inferred intent — the user must type the exact slash command `/push-to-public`

If this skill was not triggered by the exact command `/push-to-public`, stop immediately without taking any action.

---

## User Input

```text
$ARGUMENTS
```

Optional. Any text supplied is treated as additional context for the PR description (e.g. release notes, caveats, highlights to emphasize).

## Outline

You are a senior engineer publishing the private `origin/master` to the public repo. Your job is to write a clear, accurate PR description and then hand off to the publish script for the mechanical steps.

---

### Step 1 — Verify we are on master

Run:
```
git branch --show-current
```

If not on `master`, **stop immediately** and tell the user:
"This skill must be run from `master`. You are currently on `<branch>`. Run: `git checkout master` first."

Do not proceed past this step unless the branch is exactly `master`.

---

### Step 2 — Collect the changes since last public sync

Run:
```
git fetch public
git --no-pager log public/master..HEAD --pretty=format:"%h %s" --no-merges
```

If there are no new commits, tell the user: "Nothing to publish — `origin/master` is already in sync with `public/master`." and stop.

Read the diff summary to understand what changed:
```
git --no-pager diff public/master..HEAD --stat
```

---

### Step 3 — Generate the PR title and description

Using the commit list and diff stat from Step 2, write:

**Title**: A single concise sentence (under 72 characters) that accurately summarises the most significant change(s). Do not use generic phrases like "Sync from private" or "Update master". Write something a person reading the public repo would find meaningful.

**Body**: A structured markdown description with:
- A short paragraph (2-4 sentences) summarising what this sync brings and why it matters.
- A `## Changes` section with bullet points grouped by area (e.g. Backend, Frontend, CI, Docs, Scripts). Each bullet should be a human-readable sentence, not a raw commit subject. Omit trivial housekeeping commits (formatting, typo fixes) unless they are the only changes.
- A `## Commits` section with the raw commit log lines from Step 2 (verbatim, as a code block or bullet list), so reviewers can cross-reference exact commits.
- If `$ARGUMENTS` was supplied, incorporate that context prominently.

Do NOT use em dashes in the description.

---

### Step 4 — Run the publish script

Invoke the script with the generated title and body:

```bash
node scripts/publish.mjs --title "<generated title>" --body "<generated body>"
```

Stream the output so the user can see CI poll progress in real time.

---

### Step 5 — Report

Once the script completes, output:

```
## Published

- PR title: <title>
- Public repo: <url>
- CI: ✅ passed
- Merged: ✅
```

If the script fails (CI failure, merge conflict, etc.), report the error clearly and tell the user what to fix before re-running `/push-to-public`.

