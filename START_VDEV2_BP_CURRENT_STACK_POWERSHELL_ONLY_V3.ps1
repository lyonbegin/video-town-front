$ErrorActionPreference = 'Stop'

# ============================================================
# VDEV2 BP STACK - POWERSHELL ONLY RESTART V3
#
# FIX V3
# - child PowerShell launcher 안의 native command에 line-continuation(`) 사용 안 함
# - docker inspect --format 파서 오류 제거
# - Windows PowerShell 5.1 기준
# - 서비스 콘솔은 모두 powershell.exe 창으로 실행
#
# SERVICES
# 1) Docker Desktop / Linux engine
# 2) Clinical PostgreSQL
# 3) BP Simulator Node :18101
# 4) VDEV2 Backend      :8888
# 5) BP Connector ONLINE/CONNECTED
# 6) VDEV2 Frontend     :5181
# 7) NORMAL measurement
# 8) Simulator Controller + BP Clinical UI
# ============================================================

$RunRoot       = 'C:\Users\sky01\VDEV2\run-bp-stack'
$BackendRoot   = 'C:\realtime-server'
$FrontendRoot  = 'C:\telemedicine-front'
$SimulatorRoot = 'C:\VDEV2\device-nodes\automated-bp-monitor'

New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " VDEV2 AUTOMATED_BP_MONITOR - POWERSHELL ONLY START V3" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# Helper: native process status without PowerShell stderr promotion
# ------------------------------------------------------------

function Invoke-NativeQuiet {
    param(
        [Parameter(Mandatory=$true)][string]$FilePath,
        [Parameter(Mandatory=$false)][string[]]$Arguments = @()
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    if ($Arguments.Count -gt 0) {
        $parts = @()
        foreach ($arg in $Arguments) {
            if ($arg -match '[\s"]') {
                $parts += ('"' + ($arg -replace '"','\"') + '"')
            } else {
                $parts += $arg
            }
        }
        $psi.Arguments = ($parts -join ' ')
    }

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    $null = $proc.Start()
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    return [pscustomobject]@{
        ExitCode = $proc.ExitCode
        StdOut   = $stdout
        StdErr   = $stderr
    }
}

function Test-DockerReady {
    $result = Invoke-NativeQuiet -FilePath 'docker.exe' -Arguments @('info')
    return ($result.ExitCode -eq 0)
}

function Wait-Http {
    param(
        [Parameter(Mandatory=$true)][string]$Url,
        [int]$Seconds = 60
    )

    for ($i = 0; $i -lt $Seconds; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
                return $true
            }
        } catch {}
        Start-Sleep -Seconds 1
    }

    return $false
}

# ------------------------------------------------------------
# 0. Required paths / executables
# ------------------------------------------------------------

if (-not (Test-Path -LiteralPath (Join-Path $SimulatorRoot 'server.js'))) {
    throw "BP Simulator server.js not found: $SimulatorRoot\server.js"
}
if (-not (Test-Path -LiteralPath (Join-Path $BackendRoot 'package.json'))) {
    throw "Backend not found: $BackendRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $FrontendRoot 'package.json'))) {
    throw "Frontend not found: $FrontendRoot"
}

$NodeExe   = (Get-Command node.exe -ErrorAction Stop).Source
$DockerExe = (Get-Command docker.exe -ErrorAction Stop).Source
$NpmPs1    = Get-Command npm.ps1 -ErrorAction SilentlyContinue

if ($NpmPs1) {
    $NpmCommand = $NpmPs1.Source
} else {
    $NpmCommand = (Get-Command npm -ErrorAction Stop).Source
}

Write-Host "[PASS] Required source directories found" -ForegroundColor Green
Write-Host "[INFO] node   = $NodeExe"
Write-Host "[INFO] npm    = $NpmCommand"
Write-Host "[INFO] docker = $DockerExe"

# ------------------------------------------------------------
# 1. Docker Desktop / engine
# ------------------------------------------------------------

if (-not (Test-DockerReady)) {
    $DockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

    if (-not (Test-Path -LiteralPath $DockerDesktop)) {
        throw "Docker daemon is not running and Docker Desktop executable was not found: $DockerDesktop"
    }

    Write-Host "[INFO] Docker Linux engine is not ready." -ForegroundColor Yellow

    $dd = Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue
    if (-not $dd) {
        Write-Host "[INFO] Starting Docker Desktop..." -ForegroundColor Yellow
        Start-Process -FilePath $DockerDesktop | Out-Null
    } else {
        Write-Host "[INFO] Docker Desktop process exists; waiting for engine..." -ForegroundColor Yellow
    }

    $dockerReady = $false
    for ($i = 1; $i -le 90; $i++) {
        Start-Sleep -Seconds 2
        if (Test-DockerReady) {
            $dockerReady = $true
            break
        }
        if (($i % 5) -eq 0) {
            Write-Host "[WAIT] Docker engine... $($i * 2)s" -ForegroundColor DarkYellow
        }
    }

    if (-not $dockerReady) {
        throw "Docker Desktop Linux engine did not become ready within 180 seconds."
    }
}

Write-Host "[PASS] Docker Linux engine ready" -ForegroundColor Green

# ------------------------------------------------------------
# 2. Clinical PostgreSQL
# ------------------------------------------------------------

$Container = 'deployment-clinical-postgres-1'
$allContainers = @(& docker.exe ps -a --format '{{.Names}}')

if ($allContainers -notcontains $Container) {
    $candidate = $allContainers |
        Where-Object { $_ -match 'clinical.*postgres|postgres.*clinical' } |
        Select-Object -First 1

    if ($candidate) {
        $Container = [string]$candidate
        Write-Host "[INFO] Clinical PostgreSQL fallback: $Container" -ForegroundColor Yellow
    } else {
        throw "Clinical PostgreSQL container not found."
    }
}

$runningContainers = @(& docker.exe ps --format '{{.Names}}')
if ($runningContainers -notcontains $Container) {
    Write-Host "[INFO] Starting PostgreSQL container: $Container" -ForegroundColor Yellow
    & docker.exe start $Container | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start PostgreSQL container: $Container"
    }
}

Write-Host "[PASS] PostgreSQL container running: $Container" -ForegroundColor Green

# ------------------------------------------------------------
# 3. Generate BP Simulator launcher
# ------------------------------------------------------------

$SimulatorLauncher = Join-Path $RunRoot '01-start-bp-simulator.ps1'

$simTemplate = @'
$ErrorActionPreference = 'Stop'
$env:BP_SIM_PORT = '18101'
Set-Location '__SIM_ROOT__'
$Host.UI.RawUI.WindowTitle = 'VDEV2 BP Simulator :18101'

Write-Host ''
Write-Host '=============================================' -ForegroundColor Cyan
Write-Host ' VDEV2 BP SIMULATOR NODE :18101' -ForegroundColor Cyan
Write-Host ' PowerShell process' -ForegroundColor DarkGray
Write-Host '=============================================' -ForegroundColor Cyan
Write-Host ''

& '__NODE_EXE__' 'server.js'
'@

$simTemplate = $simTemplate.Replace('__SIM_ROOT__', $SimulatorRoot)
$simTemplate = $simTemplate.Replace('__NODE_EXE__', $NodeExe)
Set-Content -LiteralPath $SimulatorLauncher -Value $simTemplate -Encoding UTF8

$simAlive = $false
try {
    $r = Invoke-RestMethod 'http://127.0.0.1:18101/v1/health' -TimeoutSec 2
    if ($r.ok) { $simAlive = $true }
} catch {}

if (-not $simAlive) {
    Write-Host "[INFO] Starting BP Simulator in PowerShell..." -ForegroundColor Yellow
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoLogo',
        '-NoExit',
        '-NoProfile',
        '-ExecutionPolicy','Bypass',
        '-File', ('"{0}"' -f $SimulatorLauncher)
    ) -WindowStyle Normal

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $r = Invoke-RestMethod 'http://127.0.0.1:18101/v1/health' -TimeoutSec 2
            if ($r.ok) {
                $simAlive = $true
                break
            }
        } catch {}
    }
}

if (-not $simAlive) {
    throw "BP Simulator failed to start on port 18101."
}

Write-Host "[PASS] BP Simulator online :18101" -ForegroundColor Green

# ------------------------------------------------------------
# 4. Generate Backend launcher
#    IMPORTANT: no native-command continuation/backtick
# ------------------------------------------------------------

$BackendLauncher = Join-Path $RunRoot '02-start-vdev2-backend.ps1'

$backendTemplate = @'
$ErrorActionPreference = 'Stop'
$Container = '__CONTAINER__'

function Get-ContainerEnv([string]$Name) {
    # Keep this native command on ONE line for Windows PowerShell 5.1.
    $lines = @(& docker.exe inspect $Container --format '{{range .Config.Env}}{{println .}}{{end}}')

    foreach ($line in $lines) {
        if ([string]$line -match ('^' + [regex]::Escape($Name) + '=(.*)$')) {
            return [string]$Matches[1]
        }
    }
    return $null
}

$PgUser = Get-ContainerEnv 'POSTGRES_USER'
$PgPass = Get-ContainerEnv 'POSTGRES_PASSWORD'
$PgDb   = Get-ContainerEnv 'POSTGRES_DB'

if ([string]::IsNullOrWhiteSpace($PgUser)) { $PgUser = 'postgres' }
if ([string]::IsNullOrWhiteSpace($PgDb))   { $PgDb = $PgUser }

if ([string]::IsNullOrWhiteSpace($PgPass)) {
    throw 'POSTGRES_PASSWORD not found in Clinical PostgreSQL container.'
}

# Keep docker port invocation on one physical line too.
$PortLines = @(& docker.exe port $Container '5432/tcp')
$HostPort = $null

foreach ($line in $PortLines) {
    if ([string]$line -match ':(\d+)$') {
        $HostPort = [string]$Matches[1]
        break
    }
}

if ([string]::IsNullOrWhiteSpace($HostPort)) {
    throw 'Clinical PostgreSQL host port not found.'
}

$Eu = [uri]::EscapeDataString($PgUser)
$Ep = [uri]::EscapeDataString($PgPass)
$Ed = [uri]::EscapeDataString($PgDb)

$env:CLINICAL_DATABASE_URL = "postgresql://${Eu}:${Ep}@127.0.0.1:${HostPort}/${Ed}"
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

$env:CLINICAL_DB_SSL_MODE = 'disable'
$env:CLINICAL_EDGE_TRUST_PROXY_CERT_HEADER = 'true'
$env:AUTOMATED_BP_MONITOR_ENDPOINT = 'http://127.0.0.1:18101'
$env:PORT = '8888'

Set-Location '__BACKEND_ROOT__'
$Host.UI.RawUI.WindowTitle = 'VDEV2 Main Backend :8888'

Write-Host ''
Write-Host '=============================================' -ForegroundColor Cyan
Write-Host ' VDEV2 MAIN BACKEND :8888' -ForegroundColor Cyan
Write-Host ' PowerShell process' -ForegroundColor DarkGray
Write-Host '=============================================' -ForegroundColor Cyan
Write-Host "Database container : $Container"
Write-Host "Database           : $PgDb"
Write-Host "Database user      : $PgUser"
Write-Host "PostgreSQL port    : $HostPort"
Write-Host "BP endpoint        : $env:AUTOMATED_BP_MONITOR_ENDPOINT"
Write-Host ''

& '__NPM_COMMAND__' run start:dev
'@

$backendTemplate = $backendTemplate.Replace('__CONTAINER__', $Container)
$backendTemplate = $backendTemplate.Replace('__BACKEND_ROOT__', $BackendRoot)
$backendTemplate = $backendTemplate.Replace('__NPM_COMMAND__', $NpmCommand)
Set-Content -LiteralPath $BackendLauncher -Value $backendTemplate -Encoding UTF8

# Parse generated backend launcher BEFORE executing it.
$parseErrors = $null
$parseTokens = $null
[void][System.Management.Automation.Language.Parser]::ParseFile(
    $BackendLauncher,
    [ref]$parseTokens,
    [ref]$parseErrors
)

if ($parseErrors -and $parseErrors.Count -gt 0) {
    Write-Host "[FAIL] Generated backend launcher has PowerShell parse errors:" -ForegroundColor Red
    foreach ($pe in $parseErrors) {
        Write-Host ("  " + $pe.Message) -ForegroundColor Red
    }
    throw "Generated backend launcher parse validation failed."
}

Write-Host "[PASS] Generated backend launcher PowerShell parse check" -ForegroundColor Green

$backendAlive = $false
try {
    $db = Invoke-RestMethod 'http://127.0.0.1:8888/health/clinical-db/ready' -TimeoutSec 2
    if ($db.status -eq 'ready') { $backendAlive = $true }
} catch {}

if (-not $backendAlive) {
    Write-Host "[INFO] Starting VDEV2 Backend in PowerShell..." -ForegroundColor Yellow
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoLogo',
        '-NoExit',
        '-NoProfile',
        '-ExecutionPolicy','Bypass',
        '-File', ('"{0}"' -f $BackendLauncher)
    ) -WindowStyle Normal

    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 1
        try {
            $db = Invoke-RestMethod 'http://127.0.0.1:8888/health/clinical-db/ready' -TimeoutSec 2
            if ($db.status -eq 'ready') {
                $backendAlive = $true
                break
            }
        } catch {}
    }
}

if (-not $backendAlive) {
    throw "VDEV2 Backend failed to become ready on port 8888."
}

Write-Host "[PASS] VDEV2 Backend ready :8888" -ForegroundColor Green

# ------------------------------------------------------------
# 5. BP Connector
# ------------------------------------------------------------

$bpConnected = $false

for ($i = 0; $i -lt 30; $i++) {
    try {
        $bp = Invoke-RestMethod 'http://127.0.0.1:8888/devices/automated-bp-monitor/status' -TimeoutSec 2

        if ($bp.endpointState -eq 'ONLINE' -and $bp.transportState -eq 'CONNECTED') {
            $bpConnected = $true
            break
        }
    } catch {}

    Start-Sleep -Seconds 1
}

if (-not $bpConnected) {
    throw "BP Connector did not reach ONLINE / CONNECTED."
}

Write-Host "[PASS] BP Connector ONLINE / CONNECTED" -ForegroundColor Green

# ------------------------------------------------------------
# 6. Generate Frontend launcher
# ------------------------------------------------------------

$FrontendLauncher = Join-Path $RunRoot '03-start-vdev2-frontend.ps1'

$frontendTemplate = @'
$ErrorActionPreference = 'Stop'
Set-Location '__FRONTEND_ROOT__'
$Host.UI.RawUI.WindowTitle = 'VDEV2 Frontend :5181'

Write-Host ''
Write-Host '=============================================' -ForegroundColor Cyan
Write-Host ' VDEV2 FRONTEND :5181' -ForegroundColor Cyan
Write-Host ' PowerShell process' -ForegroundColor DarkGray
Write-Host '=============================================' -ForegroundColor Cyan
Write-Host ''

& '__NPM_COMMAND__' run dev
'@

$frontendTemplate = $frontendTemplate.Replace('__FRONTEND_ROOT__', $FrontendRoot)
$frontendTemplate = $frontendTemplate.Replace('__NPM_COMMAND__', $NpmCommand)
Set-Content -LiteralPath $FrontendLauncher -Value $frontendTemplate -Encoding UTF8

$parseErrors = $null
$parseTokens = $null
[void][System.Management.Automation.Language.Parser]::ParseFile(
    $FrontendLauncher,
    [ref]$parseTokens,
    [ref]$parseErrors
)
if ($parseErrors -and $parseErrors.Count -gt 0) {
    foreach ($pe in $parseErrors) {
        Write-Host ("[FAIL] Frontend launcher parse: " + $pe.Message) -ForegroundColor Red
    }
    throw "Generated frontend launcher parse validation failed."
}

$frontendAlive = $false
try {
    $r = Invoke-WebRequest 'http://127.0.0.1:5181/vdev2/devices/automated-bp-monitor/' -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $frontendAlive = $true }
} catch {}

if (-not $frontendAlive) {
    Write-Host "[INFO] Starting VDEV2 Frontend in PowerShell..." -ForegroundColor Yellow
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoLogo',
        '-NoExit',
        '-NoProfile',
        '-ExecutionPolicy','Bypass',
        '-File', ('"{0}"' -f $FrontendLauncher)
    ) -WindowStyle Normal

    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 1
        try {
            $r = Invoke-WebRequest 'http://127.0.0.1:5181/vdev2/devices/automated-bp-monitor/' -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) {
                $frontendAlive = $true
                break
            }
        } catch {}
    }
}

if (-not $frontendAlive) {
    throw "VDEV2 Frontend failed to start on port 5181."
}

Write-Host "[PASS] VDEV2 Frontend ready :5181" -ForegroundColor Green

# ------------------------------------------------------------
# 7. NORMAL measurement reset
# ------------------------------------------------------------

try {
    Invoke-RestMethod 'http://127.0.0.1:18101/v1/control/connect' -Method Post -ContentType 'application/json' -Body '{}' | Out-Null
    Invoke-RestMethod 'http://127.0.0.1:18101/v1/control/measure' -Method Post -ContentType 'application/json' -Body '{"scenario":"NORMAL"}' | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "[PASS] NORMAL mmHg measurement generated" -ForegroundColor Green
}
catch {
    Write-Host "[WARN] NORMAL reset failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ------------------------------------------------------------
# 8. Final status
# ------------------------------------------------------------

$db = Invoke-RestMethod 'http://127.0.0.1:8888/health/clinical-db/ready'
$bp = Invoke-RestMethod 'http://127.0.0.1:8888/devices/automated-bp-monitor/status'

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " VDEV2 BP STACK READY - POWERSHELL ONLY V3" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Clinical DB : $($db.status)"
Write-Host "Backend     : http://127.0.0.1:8888"
Write-Host "BP Node     : http://127.0.0.1:18101"
Write-Host "Frontend    : http://127.0.0.1:5181"
Write-Host ""
Write-Host "BP endpoint : $($bp.endpointState)"
Write-Host "BP transport: $($bp.transportState)"
Write-Host "History     : $($bp.historyCount)"
Write-Host ""

# ------------------------------------------------------------
# 9. Open browser pages
# ------------------------------------------------------------

Start-Process 'http://127.0.0.1:18101/controller'
Start-Process 'http://127.0.0.1:5181/vdev2/devices/automated-bp-monitor/'

Write-Host "[PASS] Simulator Controller opened"
Write-Host "[PASS] BP Clinical UI opened"
Write-Host ""
Write-Host "모든 서비스 콘솔은 PowerShell로 실행됩니다." -ForegroundColor Cyan
