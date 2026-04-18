## Drops unused columns from the teams_threads table in the existing Argus database.
## Removes: current_output_message_id, delta_link
## Safe to run while the server is stopped. Do not run while the server is running.

$dbFile = if ($env:ARGUS_DB_PATH) { $env:ARGUS_DB_PATH } else { Join-Path $HOME '.argus' 'argus.db' }

if (-not (Test-Path $dbFile)) {
    Write-Host "Database not found at $dbFile"
    Write-Host "Set ARGUS_DB_PATH if your database is in a non-default location."
    exit 1
}

Write-Host "Database: $dbFile"
Write-Host ""

$sqlite = Get-Command sqlite3 -ErrorAction SilentlyContinue
if (-not $sqlite) {
    Write-Error "sqlite3 not found on PATH. Install it from https://www.sqlite.org/download.html and add it to your PATH."
    exit 1
}

function Get-Columns($db, $table) {
    $result = & sqlite3 $db "PRAGMA table_info($table);" 2>&1
    return $result | ForEach-Object { ($_ -split '\|')[1] }
}

$cols = Get-Columns $dbFile 'teams_threads'

$dropped = @()

if ($cols -contains 'current_output_message_id') {
    Write-Host "Dropping current_output_message_id..."
    & sqlite3 $dbFile "ALTER TABLE teams_threads DROP COLUMN current_output_message_id;"
    $dropped += 'current_output_message_id'
} else {
    Write-Host "current_output_message_id: already absent, skipping."
}

if ($cols -contains 'delta_link') {
    Write-Host "Dropping delta_link..."
    & sqlite3 $dbFile "ALTER TABLE teams_threads DROP COLUMN delta_link;"
    $dropped += 'delta_link'
} else {
    Write-Host "delta_link: already absent, skipping."
}

Write-Host ""
if ($dropped.Count -gt 0) {
    Write-Host "Done. Dropped: $($dropped -join ', ')"
} else {
    Write-Host "Nothing to do. Database is already up to date."
}
