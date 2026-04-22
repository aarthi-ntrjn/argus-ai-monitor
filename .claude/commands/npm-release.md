---
description: Push the current version tag to the public remote and monitor the npm publish workflow until it succeeds or fails.
---

## Invocation rules

**ONLY execute this skill when the user explicitly types `/npm-release` as a standalone command.**
Do NOT execute it in response to any of the following:
- Phrases like "publish npm", "release the package", "push to npm", or any paraphrase
- Being asked to "run the next step" when an npm release is implied
- Any autonomous or inferred intent — the user must type the exact slash command `/npm-release`

If this skill was not triggered by the exact command `/npm-release`, stop immediately without taking any action.

---

## Prerequisite

**Run `/bump-version` before this command.** `/bump-version` handles the full version bump cycle: it increments `package.json`, updates the CHANGELOG, creates the annotated tag, and pushes master + the tag to origin.

`/npm-release` only pushes the tag to the public remote and monitors the publish CI workflow.

---

## Outline

You are publishing the already-tagged version of this project to npm. Follow these steps exactly.

---

### Step 0 — Verify we are on master

Run:
```
git branch --show-current
```

If not on `master`, **stop immediately** and tell the user:
"This skill must be run from `master`. You are currently on `<branch>`. Run: `git checkout master` first."

Do not proceed past this step unless the branch is exactly `master`.

---

### Step 1 — Verify the tag exists

Read the version from `package.json`:

```bash
node -e "console.log(require('./package.json').version)"
```

The expected tag is `v<version>`. Verify it exists on origin:

```bash
git ls-remote origin "refs/tags/v<version>"
```

If the tag does not exist on origin, stop and tell the user:
"Tag v<version> has not been pushed to origin yet. Run `/bump-version` first."

---

### Step 2 — Run the publish-npm script

Run:
```bash
node scripts/publish-npm.mjs
```

If the script fails (wrong branch, tag already exists, remote not found), stop and report the error clearly with the fix the user needs to apply.

If it succeeds, note the tag name printed by the script (e.g. `v0.1.1`).

---

### Step 3 — Locate the triggered workflow run

Wait about 5 seconds for GitHub to register the tag push, then run:
```bash
gh run list --repo aarthi-ntrjn/argus --workflow=publish-npm.yml --limit=5 --json databaseId,status,conclusion,headBranch,createdAt
```

Find the run whose `headBranch` matches the tag pushed in Step 2. Note its `databaseId`.

If no matching run appears after two attempts (10 seconds apart), report:
"The workflow did not appear on the public repo. Check https://github.com/aarthi-ntrjn/argus/actions manually."

---

### Step 4 — Poll until complete

Poll the run every 15 seconds using:
```bash
gh run view <databaseId> --repo aarthi-ntrjn/argus --json status,conclusion,jobs
```

- While `status` is `in_progress` or `queued`, print a one-line status update showing the elapsed time and the name of any currently running job, then wait 15 seconds and poll again.
- Stop polling when `status` is `completed`.

---

### Step 5 — Report the result

**On success** (`conclusion` is `success`):

```
## Published

- Tag: <tag>
- npm package: https://www.npmjs.com/package/argus-ai-hub
- Workflow run: https://github.com/aarthi-ntrjn/argus/actions/runs/<databaseId>
- CI: ✅ passed
- Published: ✅
```

**On failure** (`conclusion` is `failure` or `cancelled`):

Run:
```bash
gh run view <databaseId> --repo aarthi-ntrjn/argus --log-failed
```

Report the exact error from the failed step and tell the user what to fix before retrying.
Note: the tag has already been pushed to both remotes. After fixing the issue, they can re-run the workflow manually at https://github.com/aarthi-ntrjn/argus/actions/workflows/publish-npm.yml rather than running this command again (which would fail because the tag already exists).
