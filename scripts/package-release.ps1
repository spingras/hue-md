$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$releaseDir = Join-Path $repoRoot "dist\release"

if (Test-Path $releaseDir) {
  Remove-Item $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

# 1. CSS & Landing Page
& node (Join-Path $repoRoot "scripts\build-css.js")
& node (Join-Path $repoRoot "scripts\build-hero.js")
& node (Join-Path $repoRoot "scripts\generate-readme-assets.js")
& node (Join-Path $repoRoot "scripts\render-demo.js")
Copy-Item (Join-Path $repoRoot "dist\hue-md.css") (Join-Path $releaseDir "hue-md.css") -Force

# 2. VS Code Extension (hue-md-*.vsix)
$vscodePkg = Get-Content (Join-Path $repoRoot "packages\vscode-hue\package.json") -Raw | ConvertFrom-Json
$targetVsix = Join-Path $repoRoot ("packages\vscode-hue\hue-md-" + $vscodePkg.version + ".vsix")
Push-Location (Join-Path $repoRoot "packages\vscode-hue")
& node build.js
& npx --yes @vscode/vsce package --no-dependencies -o $targetVsix
Pop-Location
Copy-Item $targetVsix (Join-Path $releaseDir (Split-Path $targetVsix -Leaf)) -Force
# A copy without the version in its name, so releases/latest/download/hue-md.vsix
# (the README's link) keeps working for every release.
Copy-Item $targetVsix (Join-Path $releaseDir "hue-md.vsix") -Force

# 3. Notepad++ x64 Plugin (hue-md-npp-x64.zip)
$nppDll = Join-Path $repoRoot "packages\notepadpp-hue\dist\hue-md\hue-md.dll"
if (-not (Test-Path $nppDll)) {
  & (Join-Path $repoRoot "packages\notepadpp-hue\build.ps1")
}
$nppStage = Join-Path $releaseDir "_stage_npp"
New-Item -ItemType Directory -Path (Join-Path $nppStage "hue-md") -Force | Out-Null
Copy-Item $nppDll (Join-Path $nppStage "hue-md\hue-md.dll") -Force
# The plugin runs the CLI and opens the demo from its own folder (see hueCliCommand).
Copy-Item (Join-Path $repoRoot "packages\claude-code-hue\scripts\hue-md.cjs") (Join-Path $nppStage "hue-md\hue-md.cjs") -Force
Copy-Item (Join-Path $repoRoot "demo\demo.hue.md") (Join-Path $nppStage "hue-md\demo.hue.md") -Force
Copy-Item (Join-Path $repoRoot "packages\notepadpp-hue\install-system.ps1") (Join-Path $nppStage "install.ps1") -Force
Copy-Item (Join-Path $repoRoot "packages\notepadpp-hue\README.md") (Join-Path $nppStage "README.md") -Force
Compress-Archive -Path "$nppStage\*" -DestinationPath (Join-Path $releaseDir "hue-md-npp-x64.zip") -Force
Remove-Item $nppStage -Recurse -Force

# 4. GitHub UserScript (hue-md.user.js)
Copy-Item (Join-Path $repoRoot "packages\github-hue\userscript\hue-md.user.js") (Join-Path $releaseDir "hue-md.user.js") -Force

# 5. GitHub Browser Extension (hue-md-browser.zip)
$extDir = Join-Path $repoRoot "packages\github-hue\extension"
Compress-Archive -Path "$extDir\*" -DestinationPath (Join-Path $releaseDir "hue-md-browser.zip") -Force

# 6. Obsidian Plugin (hue-md-obsidian.zip)
$obsDir = Join-Path $repoRoot "packages\obsidian-hue"
Compress-Archive -Path "$obsDir\*" -DestinationPath (Join-Path $releaseDir "hue-md-obsidian.zip") -Force

# 7. Neovim Plugin (hue-md-nvim.zip)
$nvimDir = Join-Path $repoRoot "packages\nvim-hue"
Compress-Archive -Path "$nvimDir\*" -DestinationPath (Join-Path $releaseDir "hue-md-nvim.zip") -Force

# 8. Universal Editor Snippets & Emacs Mode (hue-md-snippets.zip)
$snipStage = Join-Path $releaseDir "_stage_snippets"
New-Item -ItemType Directory -Path $snipStage -Force | Out-Null
Copy-Item (Join-Path $repoRoot "snippets\*") $snipStage -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $snipStage "emacs") -Force | Out-Null
Copy-Item (Join-Path $repoRoot "packages\emacs-hue\hue-markdown-mode.el") (Join-Path $snipStage "emacs\hue-markdown-mode.el") -Force
Compress-Archive -Path "$snipStage\*" -DestinationPath (Join-Path $releaseDir "hue-md-snippets.zip") -Force
Remove-Item $snipStage -Recurse -Force

Write-Host "Packaged all hue-md release artifacts in: $releaseDir"
Get-ChildItem $releaseDir | Select-Object Name, Length
