param(
    [switch]$UsePython312
)

$ErrorActionPreference = "Stop"

$scriptRoot = $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..")
$runtimeFile = Join-Path $scriptRoot ".python_runtime"
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
$python312 = "C:/Users/Think/AppData/Local/Programs/Python/Python312/python.exe"

$pythonPath = if (Test-Path $runtimeFile) {
    (Get-Content $runtimeFile -Raw).Trim()
} elseif (Test-Path $venvPython) {
    $venvPython
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

$env:AzureWebJobsScriptRoot = $scriptRoot
$venvSitePackages = Join-Path $repoRoot ".venv\Lib\site-packages"
$env:PYTHONPATH = @(
    $scriptRoot
    $venvSitePackages
    $env:PYTHONPATH
) -join [System.IO.Path]::PathSeparator
$env:FUNCTIONS_WORKER_RUNTIME = "python"
$env:languageWorkers__python__defaultExecutablePath = $pythonPath

Write-Host "Starting Azure Functions with Python at: $pythonPath"
func start --verbose
