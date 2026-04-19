#!/usr/bin/env node
// publish.mjs — Push origin/master to the public repo via a PR with CI gate.
// Cross-platform equivalent of publish.ps1.
//
// Usage: node scripts/publish.mjs [--title "..."] [--body "..."]
//
// When invoked via the /publish Claude command, --title and --body are AI-generated.
// When invoked directly they fall back to the commit log.
//
// Requirements:
//   - gh CLI authenticated (gh auth login)
//   - 'public' remote pointing to the public repo
//   - Must be run from origin/master

import { execSync, spawnSync } from 'child_process';

// Parse --title and --body from argv
const argv = process.argv.slice(2);
let title = '';
let body = '';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--title' && argv[i + 1] !== undefined) title = argv[++i];
  else if (argv[i] === '--body' && argv[i + 1] !== undefined) body = argv[++i];
}

const SYNC_BRANCH = 'sync';
const PUBLIC_REMOTE = 'public';
const TARGET_BRANCH = 'master';

function step(msg) { console.log(`\n==> ${msg}`); }
function ok(msg) { console.log(`    ${msg}`); }
function fail(msg) { console.error(`    ERROR: ${msg}`); process.exit(1); }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: opts.inherit ? 'inherit' : 'pipe' }).trim();
  } catch (err) {
    if (opts.optional) return '';
    throw err;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// 1. Verify on master
step('Checking current branch');
const branch = run('git branch --show-current');
if (branch !== TARGET_BRANCH) {
  fail(`Must be on '${TARGET_BRANCH}' (currently on '${branch}'). Run: git checkout ${TARGET_BRANCH}`);
}
ok(`On branch ${TARGET_BRANCH}`);

// 2. Verify public remote
step(`Checking '${PUBLIC_REMOTE}' remote`);
const remotes = run('git remote').split('\n');
if (!remotes.includes(PUBLIC_REMOTE)) {
  fail(`'${PUBLIC_REMOTE}' remote not found. Run: git remote add public <url>`);
}
const publicUrl = run(`git remote get-url ${PUBLIC_REMOTE}`);
ok(`${PUBLIC_REMOTE} -> ${publicUrl}`);
const repoMatch = publicUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
if (!repoMatch) fail(`Cannot parse GitHub owner/repo from URL: ${publicUrl}`);
const publicRepo = repoMatch[1];

// 3. Push master to sync branch on public
step(`Pushing origin/${TARGET_BRANCH} -> ${PUBLIC_REMOTE}/${SYNC_BRANCH}`);
run(`git push ${PUBLIC_REMOTE} ${TARGET_BRANCH}:${SYNC_BRANCH} --force`, { inherit: true });
ok('Pushed');

// 4. Open PR (or reuse existing)
step(`Checking for existing PR on ${publicRepo} (${SYNC_BRANCH} -> ${TARGET_BRANCH})`);
const existingPr = run(
  `gh pr list --repo ${publicRepo} --head ${SYNC_BRANCH} --base ${TARGET_BRANCH} --json number --jq ".[0].number"`,
  { optional: true }
);

let prNumber;
if (existingPr) {
  ok(`Reusing existing PR #${existingPr}`);
  prNumber = existingPr;
} else {
  step(`Creating PR on ${publicRepo}`);
  const originUrl = run('git remote get-url origin');

  let commitLog = run(
    `git --no-pager log ${PUBLIC_REMOTE}/${TARGET_BRANCH}..HEAD --pretty=format:"- %h %s" --no-merges`,
    { optional: true }
  );
  if (!commitLog) {
    commitLog = run('git --no-pager log -20 --pretty=format:"- %h %s" --no-merges', { optional: true });
  }
  if (!title) title = `Sync from private: ${run('git log -1 --pretty=%s')}`;
  if (!body) body = `Automated sync from ${originUrl} master.`;

  const fullBody = `${body}\n\n## Commits\n\n${commitLog}`;

  // Use spawnSync with an args array so title/body special characters are safe.
  const result = spawnSync('gh', [
    'pr', 'create',
    '--repo', publicRepo,
    '--head', SYNC_BRANCH,
    '--base', TARGET_BRANCH,
    '--title', title,
    '--body', fullBody,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

  if (result.status !== 0) fail('gh pr create failed');
  const prUrl = result.stdout.trim();
  prNumber = prUrl.split('/').pop();
  ok(`Created PR #${prNumber}: ${prUrl}`);
}

// 5. Wait for CI checks to pass
step(`Waiting for CI checks on PR #${prNumber}`);
const MAX_WAIT_MS = 600_000;
const POLL_MS = 15_000;
const startTime = Date.now();

while (Date.now() - startTime < MAX_WAIT_MS) {
  let checks;
  try {
    const raw = run(`gh pr checks ${prNumber} --repo ${publicRepo} --json name,state,bucket`, { optional: true });
    checks = raw ? JSON.parse(raw) : null;
  } catch {
    checks = null;
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  if (!checks || checks.length === 0) {
    process.stdout.write(`    Waiting for checks to appear...\n`);
  } else {
    const pending = checks.filter(c => c.bucket === 'pending');
    const failed = checks.filter(c => c.bucket === 'fail');
    const passed = checks.filter(c => c.bucket === 'pass');

    if (failed.length) {
      fail(`CI failed on: ${failed.map(c => c.name).join(', ')}\n    Fix the failures on origin/master and re-run publish.mjs`);
    }
    if (!pending.length && passed.length) {
      ok('All checks passed');
      break;
    }
    process.stdout.write(`    Still running: ${pending.map(c => c.name).join(', ')} (${elapsed}s elapsed)\n`);
  }

  sleep(POLL_MS);
}

if (Date.now() - startTime >= MAX_WAIT_MS) {
  fail(`CI did not complete within 600s. Check manually: gh pr checks ${prNumber} --repo ${publicRepo}`);
}

// 6. Merge the PR
step(`Merging PR #${prNumber} into ${publicRepo}/${TARGET_BRANCH}`);
run(`gh pr merge ${prNumber} --repo ${publicRepo} --merge --delete-branch=false`, { inherit: true });
ok('Merged');

console.log(`\n\u2705 Published to ${publicRepo}/${TARGET_BRANCH}`);
