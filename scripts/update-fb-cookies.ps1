<#
.SYNOPSIS
    Update Facebook cookies on the OpenClaw VM.

.DESCRIPTION
    Exports cookies from EditThisCookie (JSON), uploads to VM, writes to
    Chrome's cookie database, restarts the browser, and verifies login.

.PARAMETER CookieFile
    Path to the EditThisCookie JSON export file.

.EXAMPLE
    .\scripts\update-fb-cookies.ps1 -CookieFile cookies.json
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$CookieFile
)

$ErrorActionPreference = "Stop"
$VM = "azureuser@4.155.35.255"
$SSH_OPTS = "-o", "StrictHostKeyChecking=no"
$REMOTE_COOKIE_JSON = "/tmp/fb_cookies.json"
$REMOTE_IMPORT_SCRIPT = "/tmp/import-fb-cookies.py"
$LOCAL_IMPORT_SCRIPT = Join-Path $PSScriptRoot "import-fb-cookies.py"

if (-not (Test-Path $CookieFile)) {
    Write-Error "Cookie file not found: $CookieFile"
    exit 1
}

if (-not (Test-Path $LOCAL_IMPORT_SCRIPT)) {
    Write-Error "Import script not found: $LOCAL_IMPORT_SCRIPT"
    exit 1
}

Write-Host "`n=== OpenClaw Facebook Cookie Updater ===" -ForegroundColor Cyan

# Step 1: Upload files to VM
Write-Host "`n[1/5] Uploading cookies and import script to VM..." -ForegroundColor Yellow
scp @SSH_OPTS $CookieFile "${VM}:${REMOTE_COOKIE_JSON}" 2>&1 | Out-Null
scp @SSH_OPTS $LOCAL_IMPORT_SCRIPT "${VM}:${REMOTE_IMPORT_SCRIPT}" 2>&1 | Out-Null
Write-Host "  Done" -ForegroundColor Green

# Step 2: Stop browser
Write-Host "`n[2/5] Stopping browser..." -ForegroundColor Yellow
ssh @SSH_OPTS $VM "openclaw browser --browser-profile openclaw stop 2>&1"
Write-Host "  Done" -ForegroundColor Green

# Step 3: Import cookies
Write-Host "`n[3/5] Writing cookies to Chrome DB..." -ForegroundColor Yellow
$importResult = ssh @SSH_OPTS $VM "python3 $REMOTE_IMPORT_SCRIPT $REMOTE_COOKIE_JSON 2>&1"
Write-Host $importResult

# Step 4: Restart browser
Write-Host "`n[4/5] Starting browser..." -ForegroundColor Yellow
ssh @SSH_OPTS $VM "DISPLAY=:99 openclaw browser --browser-profile openclaw start 2>&1"
Start-Sleep -Seconds 5

# Step 5: Verify login
Write-Host "`n[5/5] Verifying Facebook login..." -ForegroundColor Yellow
ssh @SSH_OPTS $VM "openclaw browser navigate 'https://www.facebook.com' 2>&1" | Out-Null
Start-Sleep -Seconds 5
$snapshot = ssh @SSH_OPTS $VM "openclaw browser snapshot 2>&1"

if ($snapshot -match "Your profile") {
    Write-Host "  Facebook is LOGGED IN" -ForegroundColor Green
} elseif ($snapshot -match "Log in") {
    Write-Host "  WARNING: Facebook shows login page — cookies may be invalid" -ForegroundColor Red
} else {
    Write-Host "  Could not determine login status — check manually" -ForegroundColor Yellow
}

# Cleanup
ssh @SSH_OPTS -o ConnectTimeout=5 $VM "rm -f $REMOTE_COOKIE_JSON $REMOTE_IMPORT_SCRIPT" 2>&1 | Out-Null

Write-Host "`n=== Cookie update complete ===" -ForegroundColor Cyan
