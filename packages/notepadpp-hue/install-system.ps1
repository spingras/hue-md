# Installs the Hue MD Notepad++ plugin.
#   .\install.ps1                          -> C:\Program Files\Notepad++\plugins\hue-md (asks for admin once)
#   .\install.ps1 -TargetDir <plugins\hue-md folder>   -> e.g. a portable Notepad++ (no admin needed)
param(
  [string]$TargetDir = "C:\Program Files\Notepad++\plugins\hue-md"
)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Release zip: install.ps1 sits next to a hue-md\ folder with the DLL, CLI and demo.
# Repository: the DLL is built into dist\hue-md\.
$sourceDir = Join-Path $scriptDir "hue-md"
if (-not (Test-Path (Join-Path $sourceDir "hue-md.dll"))) {
  $sourceDir = Join-Path $scriptDir "dist\hue-md"
  if (-not (Test-Path (Join-Path $sourceDir "hue-md.dll"))) {
    $build = Join-Path $scriptDir "build.ps1"
    if (-not (Test-Path $build)) {
      throw "hue-md.dll not found next to this script. Extract the whole zip and run install.ps1 from the extracted folder."
    }
    & $build
  }
}
$dllPath = Join-Path $sourceDir "hue-md.dll"
$targetDll = Join-Path $TargetDir "hue-md.dll"

# The plugin runs hue-md.cjs and opens demo.hue.md from its own folder, so copy every file, not only the DLL.
# Encode the command so paths with spaces or apostrophes survive elevation.
$q = { param($s) $s.Replace("'", "''") }
$cmd = @"
`$ErrorActionPreference = 'Stop'
`$ProgressPreference = 'SilentlyContinue'
try {
  [System.IO.Directory]::CreateDirectory('$(& $q $TargetDir)') | Out-Null
  Get-ChildItem -LiteralPath '$(& $q $sourceDir)' -File | Copy-Item -Destination '$(& $q $TargetDir)' -Force
  exit 0
} catch {
  Write-Error `$_
  exit 1
}
"@
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))

# Ask for admin only when the target folder isn't writable as the current user.
$needsAdmin = $false
try {
  [System.IO.Directory]::CreateDirectory($TargetDir) | Out-Null
  $probe = Join-Path $TargetDir ".hue-md-write-test"
  [System.IO.File]::WriteAllText($probe, "")
  Remove-Item -LiteralPath $probe -Force
} catch {
  $needsAdmin = $true
}

$psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path -LiteralPath $psExe)) { $psExe = (Get-Process -Id $PID).Path }
$psArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded)
if ($needsAdmin) {
  $installer = Start-Process $psExe -Verb RunAs -WindowStyle Hidden -ArgumentList $psArgs -Wait -PassThru
} else {
  $installer = Start-Process $psExe -NoNewWindow -ArgumentList $psArgs -Wait -PassThru
}
if ($installer.ExitCode -ne 0) {
  throw "Installation failed (exit code $($installer.ExitCode)). The plugin was not verified."
}

foreach ($file in Get-ChildItem -LiteralPath $sourceDir -File) {
  $installed = Join-Path $TargetDir $file.Name
  if (-not (Test-Path -LiteralPath $installed)) {
    throw "Installation did not create $installed"
  }
  if ((Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $installed).Hash) {
    throw "Installed $($file.Name) does not match the source."
  }
}
Write-Host "Verified installation in $TargetDir"
Write-Host 'Close and reopen Notepad++. Then choose Plugins > Hue Markdown.'
