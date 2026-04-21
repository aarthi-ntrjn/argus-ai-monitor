---
description: Tag the current version, push to both remotes, and monitor the npm publish workflow on the public repo until it succeeds or fails.
---

## Invocation rules

**ONLY execute this skill when the user explicitly types `/publish-npm` as a standalone command.**
Do NOT execute it in response to any of the following:
- Phrases like "publish npm", "release the package", "push to npm", or any paraphrase
- Being asked to "run the next step" when an npm release is implied
- Any autonomous or inferred intent — the user must type the exact slash command `/publish-npm`

If this skill was not triggered by the exact command `/publish-npm`, stop immediately without taking any action.

---

## Outline

You are releasing the npm package for this project. Follow these steps exactly.

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

### Step 1 — Commit the package.json version bump

Check whether `package.json` has uncommitted changes:

```bash
git diff --name-only
git diff --cached --name-only
```

If `package.json` appears in either list (unstaged or staged), commit it now:

```bash
git add package.json
git commit -m "chore: bump version to v<version>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

If `package.json` is clean (already committed), skip this sub-step and continue.

If `package.json` is absent from the diff but the tag for the current version already exists locally or on origin, stop and tell the user the version has already been released and they need to bump it first.

---

### Step 2 — Update the changelog

Before tagging, invoke the `/update-changelog` skill inline (do not ask the user to run it separately — run it as part of this flow):

- Read the version from `package.json`
- Collect commits since the last tag
- Generate and commit the changelog entry to `master` on `origin`

The changelog commit must exist on `master` **before** the tag is created, so it is included in the release.

If changelog generation fails for any reason, stop and report the error. Do not proceed to tagging.

---

### Step 3 — Run the publish-npm script

Run:
```bash
node scripts/publish-npm.mjs
```

If the script fails (wrong branch, tag already exists, remote not found), stop and report the error clearly with the fix the user needs to apply.

If it succeeds, note the tag name printed by the script (e.g. `v0.1.1`).

---

### Step 4 — Locate the triggered workflow run

Wait about 5 seconds for GitHub to register the tag push, then run:
```bash
gh run list --repo aarthi-ntrjn/argus --workflow=publish-npm.yml --limit=5 --json databaseId,status,conclusion,headBranch,createdAt
```

Find the run whose `headBranch` matches the tag pushed in Step 3. Note its `databaseId`.

If no matching run appears after two attempts (10 seconds apart), report:
"The workflow did not appear on the public repo. Check https://github.com/aarthi-ntrjn/argus/actions manually."

---

### Step 5 — Poll until complete

Poll the run every 15 seconds using:
```bash
gh run view <databaseId> --repo aarthi-ntrjn/argus --json status,conclusion,jobs
```

- While `status` is `in_progress` or `queued`, print a one-line status update showing the elapsed time and the name of any currently running job, then wait 15 seconds and poll again.
- Stop polling when `status` is `completed`.

---

### Step 6 — Report the result

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
