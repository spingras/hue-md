$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcFile   = Join-Path $scriptDir "src\HueMarkdownPlugin.cpp"
$outDir    = Join-Path $scriptDir "dist\hue-md"
$outDll    = Join-Path $outDir "hue-md.dll"
$legacyDir = Join-Path $scriptDir "dist\HueMarkdown"

New-Item -ItemType Directory -Path $outDir -Force | Out-Null
New-Item -ItemType Directory -Path $legacyDir -Force | Out-Null

$vcvarsCandidates = @()

# vswhere ships with every Visual Studio installation (any version or edition,
# including the GitHub Actions Windows images) and finds the newest one that
# has the C++ tools.
$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
  $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if ($vsPath) {
    $vcvarsCandidates += (Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat")
  }
}

# Fallback: the usual Visual Studio 2022 folders.
$vcvarsCandidates += @(
  "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat",
  "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat",
  "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat",
  "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
)

$vcvars = $vcvarsCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $vcvars) {
  throw "Could not find Visual Studio with the C++ tools (vcvars64.bat) to compile hue-md.dll"
}
Write-Host "Using $vcvars"

$cmd = "`"$vcvars`" && cl.exe /nologo /O2 /EHsc /std:c++17 /MT /LD `"$srcFile`" /Fe:`"$outDll`" /Fo:`"$outDir\hue-md.obj`""
cmd.exe /c $cmd
if ($LASTEXITCODE -ne 0) {
  throw "Compilation failed with exit code $LASTEXITCODE"
}

Remove-Item "$outDir\*.obj", "$outDir\*.exp", "$outDir\*.lib" -ErrorAction SilentlyContinue
Copy-Item $outDll (Join-Path $legacyDir "HueMarkdown.dll") -Force
Write-Host "Successfully built: $outDll"
