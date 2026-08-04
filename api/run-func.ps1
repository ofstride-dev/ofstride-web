param(
    [switch]$UsePython312
)

$ErrorActionPreference = "Stop"

$scriptRoot = $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..")
$runtimeFile = Join-Path $scriptRoot ".python_runtime"
$pythonCandidates = @()

if (Test-Path $runtimeFile) {
    $runtimePath = (Get-Content $runtimeFile -Raw).Trim()
    if ($runtimePath) {
        $pythonCandidates += $runtimePath
    }
}

$pythonCandidates += @(
    (Join-Path $repoRoot "venv\Scripts\python.exe"),
    (Join-Path $repoRoot ".venv\Scripts\python.exe"),
    "C:/Users/Hp/AppData/Local/Programs/Python/Python312/python.exe",
    "C:/Users/Think/AppData/Local/Programs/Python/Python312/python.exe"
)

$pythonPath = $pythonCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not (Test-Path $pythonPath)) {
    throw "Python executable was not found. Checked: $($pythonCandidates -join ', ')"
}

$pythonVersion = & $pythonPath -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"
if (-not $pythonVersion.StartsWith("3.12.")) {
    throw "Expected Python 3.12 for the Functions worker, but found $pythonVersion at $pythonPath"
}

$env:AzureWebJobsScriptRoot = $scriptRoot
$venvSitePackages = if (Test-Path (Join-Path $repoRoot "venv\Lib\site-packages")) {
    Join-Path $repoRoot "venv\Lib\site-packages"
} else {
    Join-Path $repoRoot ".venv\Lib\site-packages"
}
$env:PYTHONPATH = @(
    $scriptRoot
    $venvSitePackages
    $env:PYTHONPATH
) -join [System.IO.Path]::PathSeparator
$env:FUNCTIONS_WORKER_RUNTIME = "python"
$env:languageWorkers__python__defaultExecutablePath = $pythonPath

Write-Host "Starting Azure Functions with Python at: $pythonPath"
func start --verbose
