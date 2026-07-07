param(
    [switch]$UsePython312,
    [switch]$KillStaleFunc = $true
)

$ErrorActionPreference = "Stop"

$scriptRoot = $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..")
$runtimeFile = Join-Path $scriptRoot ".python_runtime"
$venvPython = Join-Path $scriptRoot ".venv\Scripts\python.exe"
$repoVenvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
$python312 = "C:/Users/Think/AppData/Local/Programs/Python/Python312/python.exe"

$pythonPath = if (Test-Path $runtimeFile) {
    (Get-Content $runtimeFile -Raw).Trim()
} elseif (Test-Path $venvPython) {
    $venvPython
} elseif (Test-Path $repoVenvPython) {
    $repoVenvPython
} elseif ($UsePython312) {
    $python312
} else {
    $python312
}

if (-not (Test-Path $pythonPath)) {
    throw "Python executable was not found at $pythonPath"
}

$pythonVersion = & $pythonPath -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"
if (-not $pythonVersion.StartsWith("3.12.")) {
    throw "Expected Python 3.12 for the Functions worker, but found $pythonVersion at $pythonPath"
}

if ($KillStaleFunc) {
    Get-Process -Name func -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            Stop-Process -Id $_.Id -Force -ErrorAction Stop
            Write-Host "Stopped stale func host process Id=$($_.Id)"
        } catch {
            Write-Host "Could not stop func process Id=$($_.Id): $($_.Exception.Message)"
        }
    }
}

$env:AzureWebJobsScriptRoot = $scriptRoot
$venvSitePackages = Join-Path $scriptRoot ".venv\Lib\site-packages"
$env:PYTHONPATH = @(
    $scriptRoot
    $venvSitePackages
    $env:PYTHONPATH
) -join [System.IO.Path]::PathSeparator
$env:FUNCTIONS_WORKER_RUNTIME = "python"
$env:languageWorkers__python__defaultExecutablePath = $pythonPath
$env:FUNCTIONS_WORKER_RUNTIME_VERSION = "3.12"
$env:PYTHON_ISOLATE_WORKER_DEPENDENCIES = "1"
$env:PY_PYTHON = "3.12"
$env:PY_PYTHON3 = "3.12"
$env:PYLAUNCHER_DEFAULT_PYTHON = "3.12"
Write-Host "Forcing Functions worker runtime version: $env:FUNCTIONS_WORKER_RUNTIME_VERSION"

Write-Host "Starting Azure Functions with Python at: $pythonPath"
func start --verbose
