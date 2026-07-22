$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $PSScriptRoot
$Tarball = Get-ChildItem -Path (Join-Path $PackageRoot "release") -Filter "numtema-mcp-foundry-*.tgz" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
$InstallTarget = if ($Tarball) { $Tarball.FullName } else { $PackageRoot }
Write-Host "Installing Nümtema MCP Foundry from $InstallTarget"
npm install --global --no-audit --no-fund $InstallTarget
Write-Host "Running installation diagnostics"
foundry doctor
