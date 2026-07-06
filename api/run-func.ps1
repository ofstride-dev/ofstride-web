param(
    [switch]$UsePython312
)

$ErrorActionPreference = "Stop"

# Core Tools on this machine is using the Python 3.14 worker bundle.
# Default to Python 3.14 for local stability, but keep a 3.12 switch for compatibility checks.
$python314 = "C:/Users/Think/AppData/Local/Programs/Python/Python314/python.exe"
$python312 = "C:/Users/Think/AppData/Local/Programs/Python/Python312/python.exe"

$pythonPath = if ($UsePython312) { $python312 } else { $python314 }
if (-not (Test-Path $pythonPath)) {
    throw "Python executable was not found at $pythonPath"
}

$env:AzureWebJobsScriptRoot = (Get-Location).Path
$env:FUNCTIONS_WORKER_RUNTIME = "python"
$env:languageWorkers__python__defaultExecutablePath = $pythonPath

Write-Host "Starting Azure Functions with Python at: $pythonPath"
func start --verbose
