#Requires -Version 5.1
<#
  songreply local install + checks (Windows).
  Usage:  powershell -ExecutionPolicy Bypass -File install.ps1
  Needs:  Node.js 22+ on PATH. Zero npm dependencies.
#>
$ErrorActionPreference = "Stop"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Output "Node.js not found. Install Node 22+ from https://nodejs.org/ then re-run this script."
  exit 1
}
$ver = (node -e "console.log(process.versions.node)").Trim()
$major = [int]($ver.Split(".")[0])
if ($major -lt 22) {
  Write-Output "Node $ver found, but this demo needs Node 22+. Update Node, then re-run."
  exit 1
}
Write-Output "Node $ver OK - zero dependencies to install."
node src/build.mjs
node --check src/reply.js
node --check src/app.js
node --check src/serve.js
Write-Output "Checks passed: model rebuilt, all sources parse."
Write-Output ""
Write-Output "Run the app:  npm run demo   then open http://localhost:8082/"
