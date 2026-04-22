---
description: Increment package.json version, update CHANGELOG, create an annotated git tag, and push to origin.
---

## Invocation rules

**ONLY execute this skill when the user explicitly types `/bump-version` as a standalone command.**
Do NOT execute it in response to any paraphrase or implied intent. The user must type the exact slash command `/bump-version`.

If this skill was not triggered by the exact command `/bump-version`, stop immediately without taking any action.

---

## Outline

You are bumping the version for this project. Follow these steps exactly.

---

### Step 0 — Verify we are on master

Run:
```
git branch --show-current
```

If not on `master`, stop immediately and tell the user:
"This skill must be run from `master`. You are currently on `<branch>`. Run: `git checkout master` first."

Also verify the working tree is clean:
```
git status --porcelain
```

If there are uncommitted changes (other than `package.json`), stop and tell the user to commit or stash them first.

---

### Step 1 — Determine the bump type

Check `$ARGUMENTS` first. If the user passed a bump type or version as an argument (e.g. `/bump-version patch`, `/bump-version minor`, `/bump-version 1.2.3`), use that directly.

If no argument was provided, ask the user:

```
Which version bump?
  1. patch  (bug fixes — x.y.Z)
  2. minor  (new features — x.Y.0)
  3. major  (breaking changes — X.0.0)
  4. custom (enter a specific version)
```

Wait for the user's choice before proceeding.

---

### Step 2 — Bump package.json

Run `npm version` with `--no-git-tag-version` so npm updates the file without creating a commit or tag (we handle those explicitly):

```bash
npm version <patch|minor|major|custom-version> --no-git-tag-version
```

Read back the new version:

```bash
node -e "console.log(require('./package.json').version)"
```

The tag will be `v<version>` (e.g. `v1.2.3`).

Check that this tag does not already exist locally or on origin:

```bash
git tag -l v<version>
git ls-remote origin "refs/tags/v<version>"
```

If the tag already exists, stop and report: "Tag v<version> already exists. The version has already been released."

---

### Step 3 — Commit the version bump

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to v<version>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Step 4 — Update the changelog

Invoke the `/update-changelog` skill inline (do not ask the user to run it separately):

- Collect commits since the last tag
- Generate and commit the changelog entry

The changelog commit must exist **before** the tag is created so it is included in the release.

If changelog generation fails for any reason, stop and report the error. Do not proceed to tagging.

---

### Step 5 — Push master to origin

```bash
git push origin master
```

This ensures the version bump commit and changelog commit are on origin before the tag points at them.

---

### Step 6 — Create and push the annotated tag

```bash
git tag -a v<version> -m "Release v<version>"
git push origin v<version>
```

---

### Step 7 — Report

Print a summary:

```
## Version bumped to v<version>

- package.json updated
- CHANGELOG updated (<N> entries)
- Tag v<version> created and pushed to origin

Run /npm-release to publish to npm.
```
