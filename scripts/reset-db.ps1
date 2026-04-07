## Deletes the Argus SQLite database and its WAL/SHM files so the next startup begins clean.

$dbDir = if ($env:ARGUS_DB_PATH) { Split-Path $env:ARGUS_DB_PATH } else { Join-Path $HOME '.argus' }
$dbFile = if ($env:ARGUS_DB_PATH) { $env:ARGUS_DB_PATH } else { Join-Path $dbDir 'argus.db' }

$files = @($dbFile, "$dbFile-wal", "$dbFile-shm")

$found = $files | Where-Object { Test-Path $_ }

if (-not $found) {
    Write-Host "Nothing to delete. No database files found in $dbDir"
    exit 0
}

Write-Host "The following files will be deleted:"
$found | ForEach-Object { Write-Host "  $_" }
Write-Host ""

$confirm = Read-Host "Proceed? (y/N)"
if ($confirm -ne 'y') {
    Write-Host "Cancelled."
    exit 0
}

# Backup before deleting
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $dbDir "backups"
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

$found | ForEach-Object {
    $name = Split-Path $_ -Leaf
    $backupPath = Join-Path $backupDir "$timestamp-$name"
    Copy-Item $_ $backupPath
    Write-Host "Backed up $_ -> $backupPath"
}

Add-Type -AssemblyName Microsoft.VisualBasic
$found | ForEach-Object {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($_, 'OnlyErrorDialogs', 'SendToRecycleBin')
    Write-Host "Sent to Recycle Bin: $_"
}

Write-Host "`nBackup saved to $backupDir"
Write-Host "Database reset complete. Restart Argus to create a fresh database."
