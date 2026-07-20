# Generate usermode/src/sdk/dead_offsets.hpp from dumper/schema-dump/deadlock
#
# Usage:
#   .\tools\generate_offsets.ps1
#   .\tools\generate_offsets.ps1 -Check
#   .\tools\generate_offsets.ps1 -AllowMissingDump

param(
    [switch]$Check,
    [switch]$AllowMissingDump,
    [string]$Dump = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot "offset-codegen\generate_offsets.py"

$python = $null
foreach ($candidate in @("python", "py")) {
    try {
        $ver = & $candidate --version 2>&1
        if ($LASTEXITCODE -eq 0 -or $ver -match "Python") {
            $python = $candidate
            break
        }
    } catch {
        # try next
    }
}

if (-not $python) {
    Write-Error "Python is required to generate offsets. Install Python 3 and retry."
    exit 1
}

$argsList = @($script, "--repo", $repoRoot)
if ($Check) { $argsList += "--check" }
if ($AllowMissingDump) { $argsList += "--allow-missing-dump" }
if ($Dump) { $argsList += @("--dump", $Dump) }

if ($python -eq "py") {
    & py -3 @argsList
} else {
    & python @argsList
}
exit $LASTEXITCODE
