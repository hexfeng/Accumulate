$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $Root ".runtime"
New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null

$ApiLog = Join-Path $RuntimeDir "api.log"
$WebLog = Join-Path $RuntimeDir "web.log"
$PidFile = Join-Path $RuntimeDir "dev-pids.json"

$Api = Start-Process -FilePath "python" `
  -ArgumentList "-m","uvicorn","app.main:app","--app-dir","apps/api","--host","0.0.0.0","--port","8000" `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $ApiLog `
  -RedirectStandardError (Join-Path $RuntimeDir "api.err.log") `
  -PassThru

$Web = Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run","dev","--workspace","@finsight/web","--","--hostname","0.0.0.0","--port","3000" `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $WebLog `
  -RedirectStandardError (Join-Path $RuntimeDir "web.err.log") `
  -PassThru

@{
  api = $Api.Id
  web = $Web.Id
  startedAt = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -Path $PidFile -Encoding UTF8

Write-Host "FinSight dev servers started."
Write-Host "API PID: $($Api.Id)"
Write-Host "Web PID: $($Web.Id)"
Write-Host "Dashboard: http://127.0.0.1:3000/dashboard"

