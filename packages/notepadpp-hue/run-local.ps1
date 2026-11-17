param(
  [string]$FileToOpen = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent (Split-Path -Parent $scriptDir)
$dllPath   = Join-Path $scriptDir "dist\hue-md\hue-md.dll"

if (-not (Test-Path $dllPath)) {
  & (Join-Path $scriptDir "build.ps1")
}

$sysNppDir = "C:\Program Files\Notepad++"
if (-not (Test-Path "$sysNppDir\notepad++.exe")) {
  throw "Notepad++ not found at $sysNppDir"
}

# Prepare a user-writable local Notepad++ instance with HueMarkdown.dll pre-installed (no UAC needed)
$localNppDir = Join-Path $env:LOCALAPPDATA "Notepad++Hue"
New-Item -ItemType Directory -Path $localNppDir -Force | Out-Null

# Copy top-level Notepad++ files and runtime folders if not already present
Get-ChildItem $sysNppDir -File | ForEach-Object {
  $dest = Join-Path $localNppDir $_.Name
  if (-not (Test-Path $dest)) {
    Copy-Item $_.FullName $dest -Force
  }
}

foreach ($dirName in @("autoCompletion", "functionList", "localization", "themes", "contextMenu")) {
  $srcSub = Join-Path $sysNppDir $dirName
  $dstSub = Join-Path $localNppDir $dirName
  if ((Test-Path $srcSub) -and -not (Test-Path $dstSub)) {
    Copy-Item $srcSub $dstSub -Recurse -Force
  }
}

# Sync user Defined Languages (including Markdown) from %APPDATA%\Notepad++
$userAppDataNpp = Join-Path $env:APPDATA "Notepad++"
$dstUdlDir = Join-Path $localNppDir "userDefineLangs"
New-Item -ItemType Directory -Path $dstUdlDir -Force | Out-Null
if (Test-Path "$userAppDataNpp\userDefineLangs") {
  Copy-Item "$userAppDataNpp\userDefineLangs\*" $dstUdlDir -Force
}

# Enable portable config so Notepad++ loads plugins from $localNppDir\plugins without UAC
$doLocalConf = Join-Path $localNppDir "doLocalConf.xml"
if (-not (Test-Path $doLocalConf)) {
  Set-Content -Path $doLocalConf -Value "" -Encoding UTF8
}

# Install hue-md.dll into $localNppDir\plugins\hue-md\hue-md.dll
$pluginTargetDir = Join-Path $localNppDir "plugins\hue-md"
New-Item -ItemType Directory -Path $pluginTargetDir -Force | Out-Null
Copy-Item $dllPath (Join-Path $pluginTargetDir "hue-md.dll") -Force

if (-not $FileToOpen) {
  $FileToOpen = Join-Path $repoRoot "demo\demo.hue.md"
}

$nppExe = Join-Path $localNppDir "notepad++.exe"
Start-Process -FilePath $nppExe -ArgumentList @("-multiInst", "-nosession", "`"$FileToOpen`"")
Write-Host "Launched a SEPARATE portable Notepad++: $nppExe"
Write-Host "Plugin file staged at: $pluginTargetDir\hue-md.dll (loading must be verified in its Plugins menu)."
Write-Host 'This does not install Hue MD into your regular Notepad++. Use install-system.ps1 for that.'
