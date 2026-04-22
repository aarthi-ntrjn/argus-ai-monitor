#!/usr/bin/env node
// publish-npm.mjs — Create a version tag from package.json and push to both
// private (origin) and public remotes, triggering the publish-npm workflow.
// Cross-platform equivalent of publish-npm.ps1.
//
// Usage: node scripts/publish-npm.mjs
//
// Prerequisites:
//   - Must be on master with a clean working tree
//   - 'public' remote pointing to the public repo
//   - NPM_TOKEN secret set on the public repo
//   - Version already bumped in package.json

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_REMOTE = 'public';

function step(msg) { console.log(`\n==> ${msg}`); }
function ok(msg) { console.log(`    ${msg}`); }
function fail(msg) { console.error(`    ERROR: ${msg}`); process.exit(1); }
function run(cmd, opts = {}) {
  const result = execSync(cmd, { encoding: 'utf8', stdio: opts.inherit ? 'inherit' : 'pipe' });
  return opts.inherit ? '' : result.trim();
}

// 1. Verify on master
step('Checking current branch');
const branch = run('git branch --show-current');
if (branch !== 'master') fail(`Must be on 'master' (currently on '${branch}'). Run: git checkout master`);
ok('On branch master');

// 2. Verify public remote exists
step(`Checking '${PUBLIC_REMOTE}' remote`);
const remotes = run('git remote').split('\n');
if (!remotes.includes(PUBLIC_REMOTE)) {
  fail(`'${PUBLIC_REMOTE}' remote not found. Run: git remote add public <url>`);
}
const publicUrl = run(`git remote get-url ${PUBLIC_REMOTE}`);
ok(`${PUBLIC_REMOTE} -> ${publicUrl}`);

// 3. Read version from package.json
step('Reading version from package.json');
const pkgPath = join(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
if (!version) fail("Could not read 'version' from package.json");
const tag = `v${version}`;
ok(`Version: ${version}  Tag: ${tag}`);

// 4. Check tag status — handle both new and pre-created tags (/bump-version workflow)
step(`Checking tag ${tag}`);
const localTag = execSync(`git tag -l ${tag}`, { encoding: 'utf8' }).trim();
const originTag = execSync(`git ls-remote origin "refs/tags/${tag}"`, { encoding: 'utf8' }).trim();
const publicTag = execSync(`git ls-remote ${PUBLIC_REMOTE} "refs/tags/${tag}"`, { encoding: 'utf8' }).trim();

if (publicTag) fail(`Tag ${tag} already exists on ${PUBLIC_REMOTE}. This version has already been published.`);

if (localTag && originTag) {
  // Tag was pre-created by /bump-version — skip creation and origin push
  ok(`Tag ${tag} already exists locally and on origin (created by /bump-version) — skipping creation`);
} else if (localTag || originTag) {
  // Partial state — push to origin if needed
  if (!originTag) {
    step(`Pushing tag ${tag} to origin (private)`);
    run(`git push origin ${tag}`, { inherit: true });
    ok('Pushed to origin');
  } else {
    ok(`Tag ${tag} exists on origin`);
  }
} else {
  // Tag does not exist anywhere — create it (legacy workflow)
  ok(`Tag ${tag} is available — creating`);

  // Push master to origin so changelog commit is included
  step('Pushing master to origin (ensures changelog commit is included in tag)');
  run(`git push origin master`, { inherit: true });
  ok('master pushed to origin');

  // Create annotated tag
  step(`Creating annotated tag ${tag}`);
  run(`git tag -a ${tag} -m "Release ${tag}"`);
  ok(`Created local tag ${tag}`);

  // Push tag to origin
  step(`Pushing tag ${tag} to origin (private)`);
  run(`git push origin ${tag}`, { inherit: true });
  ok('Pushed to origin');
}

// Push tag to public (triggers publish-npm workflow)
step(`Pushing tag ${tag} to ${PUBLIC_REMOTE} (public)`);
run(`git push ${PUBLIC_REMOTE} ${tag}`, { inherit: true });
ok(`Pushed to ${PUBLIC_REMOTE}`);

const publicRepo = publicUrl.replace(/.*github\.com[:/](.+?)(?:\.git)?$/, '$1');
console.log(`\n\u2705 Tag ${tag} pushed to both remotes.`);
console.log(`   npm publish workflow running at: https://github.com/${publicRepo}/actions`);
