# Deploys the server, public form and admin panel to Vercel (production),
# then points each main domain at the new deploy.
#
# Usage (from this folder, in PowerShell):   .\deploy-all.ps1
# Deploy just one:                           .\deploy-all.ps1 -Only admin
#
# Needs: Vercel CLI logged in (`vercel login`).

param(
  [ValidateSet("all", "server", "client", "admin")]
  [string]$Only = "all"
)

# "Continue", not "Stop": the Vercel CLI writes normal progress to stderr, which
# Windows PowerShell 5.1 would otherwise treat as a fatal error. Failures are
# caught through $LASTEXITCODE below instead.
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot

# project = Vercel project name, dir = folder to deploy from, domain = main URL.
# server and client projects have their Root Directory set to server/ and client/
# in Vercel, so they deploy from this top folder. admin deploys from admin/.
$apps = @(
  @{ name = "server"; project = "apcformsserver"; dir = $root;              domain = "apcformsserver.vercel.app" },
  @{ name = "client"; project = "apcforms";       dir = $root;              domain = "apcforms.vercel.app" },
  @{ name = "admin";  project = "apcformsadmin";  dir = "$root\admin";      domain = "apcformsadmin.vercel.app" }
)

foreach ($app in $apps) {
  if ($Only -ne "all" -and $Only -ne $app.name) { continue }

  Write-Host "`n=== Deploying $($app.name) ($($app.project)) ===" -ForegroundColor Cyan
  Push-Location $app.dir
  try {
    vercel link --yes --project $app.project 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "vercel link failed for $($app.project)" }

    $output = vercel deploy --prod --yes 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { Write-Host $output; throw "Deploy failed for $($app.project)" }

    $match = [regex]::Match($output, "https://$($app.project)-[a-z0-9]+-[a-z0-9-]+\.vercel\.app")
    if (-not $match.Success) { Write-Host $output; throw "Could not find the deploy URL for $($app.project)" }
    $url = $match.Value

    # Point the main domain at this deploy (Vercel doesn't always do it for CLI deploys).
    vercel alias set $url $app.domain 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not point $($app.domain) at $url" }

    Write-Host "Live: https://$($app.domain)" -ForegroundColor Green
  }
  finally {
    Pop-Location
  }
}

Write-Host "`nDone." -ForegroundColor Green
