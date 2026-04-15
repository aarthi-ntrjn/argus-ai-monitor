#!/usr/bin/env pwsh
# kill-dev.ps1
# Finds any process tree owning the dev server port and kills it entirely.
# Walks up to the top npm ancestor, then kills all descendants first (children
# before parents) so no orphaned tsx/node processes are left behind.

param(
  [int]$Port = 7411
)

function Get-AllDescendants {
  param([int]$ParentId)
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    $child.ProcessId
    Get-AllDescendants -ParentId $child.ProcessId
  }
}

function Get-TopDevAncestor {
  param([int]$ProcessId)
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
  if (-not $proc) { return $ProcessId }
  # Stop walking if the parent is not an npm/node process (e.g. explorer, pwsh running the predev)
  $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.ParentProcessId)" -ErrorAction SilentlyContinue
  if (-not $parent -or $parent.CommandLine -notmatch 'npm|tsx|node\.exe') {
    return $ProcessId
  }
  return Get-TopDevAncestor -ProcessId $proc.ParentProcessId
}

$conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $conn) {
  Write-Host "No process on port $Port - nothing to kill."
  exit 0
}

$serverPid  = $conn.OwningProcess
$rootPid    = Get-TopDevAncestor -ProcessId $serverPid

# Collect: all descendants of root (deepest first), then the root itself
$descendants = @(Get-AllDescendants -ParentId $rootPid) | Sort-Object -Descending
$toKill = $descendants + @($rootPid)

Write-Host "Stopping dev server tree on port $Port (PIDs: $($toKill -join ', '))"
foreach ($id in $toKill) {
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
}
Write-Host "Dev server stopped."
