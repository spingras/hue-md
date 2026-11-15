# Installs git pre-commit hook in the current repository
$gitDir = Join-Path $PSScriptRoot "..\..\.git\hooks"
if (Test-Path $gitDir) {
    $srcHook = Join-Path $PSScriptRoot "pre-commit"
    $dstHook = Join-Path $gitDir "pre-commit"
    Copy-Item $srcHook $dstHook -Force
    Write-Host "✓ Installed Hue pre-commit hook to $dstHook" -ForegroundColor Green
} else {
    Write-Warning "Could not find .git\hooks directory."
}
