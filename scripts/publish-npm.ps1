#!/usr/bin/env pwsh
# publish-npm.ps1 — Create a version tag from package.json and push to both
# private (origin) and public remotes, triggering the publish-npm workflow.
#
# Usage: ./scripts/publish-npm.ps1
#
# Prerequisites:
#   - Must be on master with a clean working tree
#   - 'public' remote pointing to the public repo
#   - NPM_TOKEN secret set on the public repo
#   - Version already bumped in package.json

param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PUBLIC_REMOTE = "public"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "    ERROR: $msg" -ForegroundColor Red; exit 1 }

# 1. Verify we are on master
Write-Step "Checking current branch"
$branch = git branch --show-current
if ($branch -ne "master") {
    Write-Fail "Must be on 'master' (currently on '$branch'). Run: git checkout master"
}
Write-Ok "On branch master"

# 2. Verify public remote exists
Write-Step "Checking '$PUBLIC_REMOTE' remote"
$remotes = git remote
if ($remotes -notcontains $PUBLIC_REMOTE) {
    Write-Fail "'$PUBLIC_REMOTE' remote not found. Run: git remote add public <url>"
}
$publicUrl = git remote get-url $PUBLIC_REMOTE
Write-Ok "$PUBLIC_REMOTE -> $publicUrl"

# 3. Read version from package.json
Write-Step "Reading version from package.json"
$pkg = Get-Content (Join-Path $PSScriptRoot ".." "package.json") -Raw | ConvertFrom-Json
$version = $pkg.version
if (-not $version) {
    Write-Fail "Could not read 'version' from package.json"
}
$tag = "v$version"
Write-Ok "Version: $version  Tag: $tag"

# 4. Check the tag does not already exist locally or on origin
Write-Step "Checking tag $tag is not already taken"
$localTag = git tag -l $tag
if ($localTag) {
    Write-Fail "Tag $tag already exists locally. Bump the version in package.json first."
}
$remoteTag = git ls-remote origin "refs/tags/$tag" 2>$null
if ($remoteTag) {
    Write-Fail "Tag $tag already exists on origin. Bump the version in package.json first."
}
Write-Ok "Tag $tag is available"

# 5. Create the annotated tag
Write-Step "Creating annotated tag $tag"
git tag -a $tag -m "Release $tag"
Write-Ok "Created local tag $tag"

# 6. Push tag to origin (private)
Write-Step "Pushing tag $tag to origin (private)"
git push origin $tag
Write-Ok "Pushed to origin"

# 7. Push tag to public (triggers publish-npm workflow)
Write-Step "Pushing tag $tag to $PUBLIC_REMOTE (public)"
git push $PUBLIC_REMOTE $tag
Write-Ok "Pushed to $PUBLIC_REMOTE"

$publicRepo = $publicUrl -replace ".*github\.com[:/](.+?)(?:\.git)?$", '$1'
Write-Host "`n✅ Tag $tag pushed to both remotes." -ForegroundColor Green
Write-Host "   npm publish workflow running at: https://github.com/$publicRepo/actions" -ForegroundColor Green
