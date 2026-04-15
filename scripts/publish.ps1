#!/usr/bin/env pwsh
# publish.ps1 — Push origin/master to the public repo via a PR with CI gate.
#
# Usage: ./publish.ps1
#
# Requirements:
#   - gh CLI authenticated (gh auth login)
#   - 'public' remote pointing to the public repo
#   - Must be run from origin/master

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$SYNC_BRANCH = "sync"
$PUBLIC_REMOTE = "public"
$TARGET_BRANCH = "master"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "    ERROR: $msg" -ForegroundColor Red; exit 1 }

# ── 1. Verify we are on origin/master ────────────────────────────────────────
Write-Step "Checking current branch"
$branch = git branch --show-current
if ($branch -ne $TARGET_BRANCH) {
    Write-Fail "Must be on '$TARGET_BRANCH' (currently on '$branch'). Run: git checkout $TARGET_BRANCH"
}
Write-Ok "On branch $TARGET_BRANCH"

# ── 2. Verify public remote exists ───────────────────────────────────────────
Write-Step "Checking '$PUBLIC_REMOTE' remote"
$remotes = git remote
if ($remotes -notcontains $PUBLIC_REMOTE) {
    Write-Fail "'$PUBLIC_REMOTE' remote not found. Run: git remote add public <url>"
}
$publicUrl = git remote get-url $PUBLIC_REMOTE
Write-Ok "$PUBLIC_REMOTE -> $publicUrl"

# Parse owner/repo from the public remote URL
if ($publicUrl -match "github\.com[:/](.+?)(?:\.git)?$") {
    $publicRepo = $Matches[1]  # e.g. "aarthi-ntrjn/argus-ai-monitor"
} else {
    Write-Fail "Cannot parse GitHub owner/repo from URL: $publicUrl"
}

# ── 3. Push master to sync branch on public ──────────────────────────────────
Write-Step "Pushing origin/$TARGET_BRANCH -> $PUBLIC_REMOTE/$SYNC_BRANCH"
git push $PUBLIC_REMOTE "${TARGET_BRANCH}:${SYNC_BRANCH}" --force
Write-Ok "Pushed"

# ── 4. Open PR (or reuse existing) ───────────────────────────────────────────
Write-Step "Checking for existing PR on $publicRepo ($SYNC_BRANCH -> $TARGET_BRANCH)"
$existingPr = gh pr list --repo $publicRepo --head $SYNC_BRANCH --base $TARGET_BRANCH --json number --jq ".[0].number" 2>$null

if ($existingPr) {
    Write-Ok "Reusing existing PR #$existingPr"
    $prNumber = $existingPr
} else {
    Write-Step "Creating PR on $publicRepo"
    $originUrl = git remote get-url origin
    $commitMsg = git log -1 --pretty="%s"
    $prUrl = gh pr create `
        --repo $publicRepo `
        --head $SYNC_BRANCH `
        --base $TARGET_BRANCH `
        --title "Sync from private: $commitMsg" `
        --body "Automated sync from $originUrl master."
    # Extract PR number from URL
    $prNumber = $prUrl -replace ".*/", ""
    Write-Ok "Created PR #${prNumber}: $prUrl"
}

# ── 5. Wait for CI to pass ────────────────────────────────────────────────────
Write-Step "Waiting for CI checks on PR #$prNumber"
$maxWaitSeconds = 600
$pollInterval = 15
$elapsed = 0

while ($elapsed -lt $maxWaitSeconds) {
    $checks = gh pr checks $prNumber --repo $publicRepo --json name,state,bucket 2>$null | ConvertFrom-Json
    if (-not $checks) {
        Write-Host "    Waiting for checks to appear..." -ForegroundColor Yellow
    } else {
        $pending  = $checks | Where-Object { $_.bucket -eq "pending" }
        $failed   = $checks | Where-Object { $_.bucket -eq "fail" }
        $passed   = $checks | Where-Object { $_.bucket -eq "pass" }

        if ($failed) {
            $failNames = ($failed | ForEach-Object { $_.name }) -join ", "
            Write-Fail "CI failed on: $failNames`n    Fix the failures on origin/master and re-run ./publish.ps1"
        }

        if (-not $pending -and $passed) {
            Write-Ok "All checks passed"
            break
        }

        $pendingNames = ($pending | ForEach-Object { $_.name }) -join ", "
        Write-Host "    Still running: $pendingNames (${elapsed}s elapsed)" -ForegroundColor Yellow
    }

    Start-Sleep -Seconds $pollInterval
    $elapsed += $pollInterval
}

if ($elapsed -ge $maxWaitSeconds) {
    Write-Fail "CI did not complete within ${maxWaitSeconds}s. Check manually: gh pr checks $prNumber --repo $publicRepo"
}

# ── 6. Merge the PR ───────────────────────────────────────────────────────────
Write-Step "Merging PR #$prNumber into $publicRepo/$TARGET_BRANCH"
gh pr merge $prNumber --repo $publicRepo --merge --delete-branch=false
Write-Ok "Merged"

Write-Host "`n✅ Published to $publicRepo/$TARGET_BRANCH" -ForegroundColor Green
