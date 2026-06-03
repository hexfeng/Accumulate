$ErrorActionPreference = "SilentlyContinue"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$PidFile = Join-Path $Root ".runtime\dev-pids.json"

if (Test-Path $PidFile) {
  $Pids = Get-Content -Path $PidFile | ConvertFrom-Json
  foreach ($ProcessId in @($Pids.api, $Pids.web)) {
    if ($ProcessId) {
      Stop-Process -Id $ProcessId -Force
    }
  }
  Remove-Item $PidFile -Force
}

Write-Host "FinSight dev servers stopped."

