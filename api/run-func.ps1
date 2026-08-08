param(
    [switch]$UsePython312,
    [int]$Port = 7071
)

$ErrorActionPreference = "Stop"

$scriptRoot = $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..")
# func start resolves the function app root from the current directory,
# so always run from the api folder regardless of where the script is invoked.
Set-Location $scriptRoot
$runtimeFile = Join-Path $scriptRoot ".python_runtime"
$apiVenvPython = Join-Path $scriptRoot ".venv\Scripts\python.exe"
$repoVenvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
$python312 = "C:/Users/Think/AppData/Local/Programs/Python/Python312/python.exe"

$pythonCandidates = @()
if (Test-Path $apiVenvPython) {
    $pythonCandidates += $apiVenvPython
}
if (Test-Path $runtimeFile) {
    $pythonCandidates += (Get-Content $runtimeFile -Raw).Trim()
}
if (Test-Path $repoVenvPython) {
    $pythonCandidates += $repoVenvPython
}
if ($UsePython312) {
    $pythonCandidates += $python312
}
if (-not $pythonCandidates) {
    $pythonCandidates += $python312
}

$pythonPath = $null
foreach ($candidate in $pythonCandidates) {
    if (Test-Path $candidate) {
        $pythonPath = $candidate
        break
    }
}

if (-not (Test-Path $pythonPath)) {
    throw "Python executable was not found at $pythonPath"
}

$pythonVersion = & $pythonPath -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"
if (-not $pythonVersion.StartsWith("3.12.")) {
    throw "Expected Python 3.12 for the Functions worker, but found $pythonVersion at $pythonPath"
}

$env:AzureWebJobsScriptRoot = $scriptRoot
$venvRoot = Split-Path -Parent $pythonPath
$venvRoot = Split-Path -Parent $venvRoot
$venvScripts = Join-Path $venvRoot "Scripts"
$venvSitePackages = Join-Path $venvRoot "Lib\site-packages"
$env:VIRTUAL_ENV = $venvRoot
$env:PATH = "$venvScripts;$env:PATH"
$env:PYTHONPATH = @(
    $scriptRoot
    $venvSitePackages
    $env:PYTHONPATH
) -join [System.IO.Path]::PathSeparator
$env:FUNCTIONS_WORKER_RUNTIME = "python"
$env:languageWorkers__python__defaultExecutablePath = $pythonPath

# Pin everything to Python 3.12 and use the repo venv's worker/site-packages,
# avoiding Core Tools' bundled (potentially broken/incompatible) worker for 3.14.
$env:PY_PYTHON = "3.12"
$env:PYTHON_ISOLATE_WORKER_DEPENDENCIES = "0"

Write-Host "Starting Azure Functions with Python at: $pythonPath"
func start --verbose --port $Port
