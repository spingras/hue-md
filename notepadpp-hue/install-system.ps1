$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dllPath   = Join-Path $scriptDir "dist\hue-md\hue-md.dll"

if (-not (Test-Path $dllPath)) {
  & (Join-Path $scriptDir "build.ps1")
}

$targetDir = "C:\Program Files\Notepad++\plugins\hue-md"
$targetDll = Join-Path $targetDir "hue-md.dll"

# Encode the command so paths with spaces or apostrophes survive elevation.
$escapedSource = $dllPath.Replace("'", "''")
$escapedDir = $targetDir.Replace("'", "''")
$escapedTarget = $targetDll.Replace("'", "''")
$cmd = @"
`$ErrorActionPreference = 'Stop'
try {
  [System.IO.Directory]::CreateDirectory('$escapedDir') | Out-Null
  Copy-Item -LiteralPath '$escapedSource' -Destination '$escapedTarget' -Force
  if ((Get-FileHash -LiteralPath '$escapedSource').Hash -ne (Get-FileHash -LiteralPath '$escapedTarget').Hash) {
    throw 'Installed DLL does not match the build.'
  }
  exit 0
} catch {
  Write-Error `$_
  exit 1
}
"@
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
$installer = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded) -Wait -PassThru
if ($installer.ExitCode -ne 0) {
  throw "Installation failed (exit code $($installer.ExitCode)). The plugin was not verified."
}
if (-not (Test-Path -LiteralPath $targetDll)) {
  throw "Installation did not create $targetDll"
}
if ((Get-FileHash -LiteralPath $dllPath).Hash -ne (Get-FileHash -LiteralPath $targetDll).Hash) {
  throw 'Installed DLL does not match the build.'
}
Write-Host "Verified installation: $targetDll"
Write-Host 'Close and reopen your regular Notepad++. Then choose Plugins > Hue Markdown.'
