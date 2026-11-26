#Requires -Version 5.1
<#
.SYNOPSIS
    Manual start helper, and the internal launcher used by the scheduled task.

.DESCRIPTION
    DRY RUN BY DEFAULT. With no -Apply this script only prints what it would do.

    Two modes:
      * default          - operator-facing "start the scheduled task" helper.
      * -Run             - long-lived launcher: acquires a named mutex (singleton),
                           decrypts the local config into its process environment,
                           rotates logs, starts node, waits, handles a stop request,
                           and exits. The scheduled task action always uses -Run -Apply.

    Secrets are decrypted from a DPAPI-protected file into the launcher process
    environment only. They are never printed, written to disk in plaintext, or
    passed on a command line.

.EXAMPLE
    .\start-worker.ps1
    Prints the manual-start plan; changes nothing.

.EXAMPLE
    .\start-worker.ps1 -Apply
    Starts the registered scheduled task.

.EXAMPLE
    .\start-worker.ps1 -Run -Apply
    Foreground launch for debugging (still no prompts); Ctrl+C to stop.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch] $Run,
    [switch] $Apply,
    [string] $StateRoot = (Join-Path $env:LOCALAPPDATA 'JobPilotAI\worker'),
    [string] $TaskName,
    [string] $NodeExe,
    [ValidateRange(1, 3600)]
    [int] $GraceSeconds = 30,
    [ValidateRange(1, 104857600)]
    [int] $LogMaxBytes = 5242880,
    [ValidateRange(1, 365)]
    [int] $LogMaxAgeDays = 7,
    [ValidateRange(1, 50)]
    [int] $LogKeep = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$workerScript = Join-Path $repoRoot 'scripts\persistent-worker.mjs'
if (-not (Test-Path -LiteralPath $workerScript -PathType Leaf)) {
    throw "Required file not found: $workerScript"
}

$stateRootFull = [System.IO.Path]::GetFullPath($StateRoot)
$configPath = Join-Path (Join-Path $stateRootFull 'config') 'worker.env.enc'
$logDir = Join-Path $stateRootFull 'logs'
$launcherLog = Join-Path $logDir 'launcher.log'
# Per-run worker logs are never truncated: each launch gets a fresh pair and
# old pairs are pruned. This avoids renaming files the child has open.
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outLog = Join-Path $logDir "worker.out-$runStamp.log"
$errLog = Join-Path $logDir "worker.err-$runStamp.log"
$stopRequestPath = Join-Path $stateRootFull 'stop.request'
$pidPath = Join-Path $stateRootFull 'worker.pid'

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$currentUser = $identity.Name
$currentSid = $identity.User

function Get-Tag {
    param([Parameter(Mandatory)][string] $Value)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value.ToLowerInvariant())
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash($bytes) } finally { $sha.Dispose() }
    -join ($hash[0..3] | ForEach-Object { $_.ToString('x2') })
}

$repoTag = Get-Tag -Value $repoRoot
if ([string]::IsNullOrWhiteSpace($TaskName)) { $TaskName = "JobPilotAI-Worker-$repoTag" }
$mutexName = "Local\JobPilotAI-Worker-$repoTag"

function Write-LauncherLog {
    param([Parameter(Mandatory)][string] $Message)
    # Only caller-controlled status strings reach this sink. Never pass a
    # decrypted environment value here.
    $line = '{0} [pid={1}] {2}' -f (Get-Date -Format 'o'), $PID, $Message
    try { Add-Content -LiteralPath $launcherLog -Value $line -Encoding UTF8 -ErrorAction Stop }
    catch { }
}

function Rotate-TextLog {
    param(
        [Parameter(Mandatory)][string] $Path,
        [Parameter(Mandatory)][int] $MaxBytes,
        [Parameter(Mandatory)][int] $MaxAgeDays,
        [Parameter(Mandatory)][int] $Keep
    )
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
    $item = Get-Item -LiteralPath $Path
    if ($item.Length -le $MaxBytes -and $item.LastWriteTime -ge (Get-Date).AddDays(-$MaxAgeDays)) { return }
    $archive = '{0}.{1}.log' -f $Path, (Get-Date -Format 'yyyyMMdd-HHmmss')
    try {
        Move-Item -LiteralPath $Path -Destination $archive -Force -ErrorAction Stop
        Get-ChildItem -LiteralPath (Split-Path -Parent $Path) -Filter "$(Split-Path -Leaf $Path).*.log" -File |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip $Keep |
            Remove-Item -Force -ErrorAction SilentlyContinue
        Write-LauncherLog ('rotated log {0}' -f (Split-Path -Leaf $Path))
    } catch {
        Write-LauncherLog ('log rotation failed for {0}' -f (Split-Path -Leaf $Path))
    }
}

function Prune-RunLogs {
    param(
        [Parameter(Mandatory)][string] $Directory,
        [Parameter(Mandatory)][int] $Keep
    )
    # Keep the newest N out/err pairs; remove both streams of older runs.
    foreach ($stream in @('worker.out-', 'worker.err-')) {
        Get-ChildItem -LiteralPath $Directory -Filter "$stream*.log" -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip $Keep |
            Remove-Item -Force -ErrorAction SilentlyContinue
    }
}

function Read-EncryptedValue {
    param(
        [Parameter(Mandatory)][string] $Key,
        [Parameter(Mandatory)][string] $Value
    )
    try {
        $secure = ConvertTo-SecureString -String $Value -ErrorAction Stop
        return [System.Net.NetworkCredential]::new([string]::Empty, $secure).Password
    } catch {
        # Deliberately do not include the raw value in the error message.
        throw "Config value for $Key is not a valid DPAPI-encrypted string for this user. Re-run install-worker.ps1 -Reconfigure."
    }
}

function Import-WorkerConfig {
    param([Parameter(Mandatory)][string] $Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Encrypted config not found: $Path. Run install-worker.ps1 -Apply first."
    }
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { throw 'Invalid line in encrypted config (missing =).' }
        $key = $line.Substring(0, $idx).Trim()
        if ($key -notmatch '^[A-Z][A-Z0-9_]*$') { throw 'Invalid key in encrypted config.' }
        $plain = Read-EncryptedValue -Key $key -Value $line.Substring($idx + 1).Trim()
        [System.Environment]::SetEnvironmentVariable($key, $plain, 'Process')
    }
    foreach ($required in @('APP_URL', 'WORKER_TOKEN')) {
        if ([string]::IsNullOrWhiteSpace([System.Environment]::GetEnvironmentVariable($required, 'Process'))) {
            throw "$required is missing from the encrypted config."
        }
    }
}

function Stop-WorkerProcess {
    param(
        [Parameter(Mandatory)][System.Diagnostics.Process] $Process,
        [Parameter(Mandatory)][int] $GraceSeconds
    )
    # Best effort: a non-forced taskkill asks a Windows process to terminate.
    # Windows does not reliably deliver SIGTERM to a console process, so the
    # worker's graceful drain cannot be guaranteed here (see setup doc).
    try { & taskkill.exe /PID $Process.Id 2>$null | Out-Null } catch { }
    if (-not $Process.WaitForExit($GraceSeconds * 1000)) {
        Write-LauncherLog 'grace period elapsed; forcing worker termination'
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        $Process.WaitForExit(5000) | Out-Null
    } else {
        Write-LauncherLog 'worker exited inside the grace period'
    }
}

function Invoke-Launcher {
    # Keep -WhatIf completely inert: no directories, logs, mutex, or process.
    if (-not $PSCmdlet.ShouldProcess($workerScript, 'Start the local persistent worker process')) {
        return 0
    }
    if (-not (Test-Path -LiteralPath $logDir -PathType Container)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }

    $createdNew = $false
    $mutex = $null
    $proc = $null
    $exitCode = 0

    try {
        $mutex = [System.Threading.Mutex]::new($false, $mutexName, [ref] $createdNew)
        try {
            $gotMutex = $mutex.WaitOne(0)
        } catch [System.Threading.AbandonedMutexException] {
            # An abandoned mutex is acquired by the waiter.
            $gotMutex = $true
        }
        if (-not $gotMutex) {
            Write-LauncherLog 'another instance holds the singleton mutex; exiting without starting a second worker'
            return 0
        }

        # A stop request left over from a previous run must not kill this one.
        if (Test-Path -LiteralPath $stopRequestPath -PathType Leaf) {
            Remove-Item -LiteralPath $stopRequestPath -Force -ErrorAction SilentlyContinue
        }

        Import-WorkerConfig -Path $configPath
        Write-LauncherLog 'config decrypted into process environment; no values logged'

        Rotate-TextLog -Path $launcherLog -MaxBytes $LogMaxBytes -MaxAgeDays $LogMaxAgeDays -Keep $LogKeep
        Prune-RunLogs -Directory $logDir -Keep $LogKeep

        if ([string]::IsNullOrWhiteSpace($NodeExe)) {
            $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
        } else {
            $nodeExe = [System.IO.Path]::GetFullPath($NodeExe)
            if (-not (Test-Path -LiteralPath $nodeExe -PathType Leaf)) {
                throw 'NodeExe does not point to an executable file.'
            }
        }
        $proc = Start-Process -FilePath $nodeExe `
            -ArgumentList @("`"$workerScript`"") `
            -WorkingDirectory $repoRoot `
            -RedirectStandardOutput $outLog `
            -RedirectStandardError $errLog `
            -PassThru `
            -WindowStyle Hidden

        # Child inherits the environment at spawn time; drop it from the
        # long-lived launcher afterwards to shrink the exposure window.
        foreach ($key in @('APP_URL', 'WORKER_TOKEN')) {
            [System.Environment]::SetEnvironmentVariable($key, $null, 'Process')
        }

        $pidTmp = "$pidPath.tmp"
        [System.IO.File]::WriteAllText($pidTmp, [string] $proc.Id)
        Move-Item -LiteralPath $pidTmp -Destination $pidPath -Force
        Write-LauncherLog ('worker started with pid {0}' -f $proc.Id)

        $stopRequested = $false
        while (-not $proc.HasExited) {
            if (Test-Path -LiteralPath $stopRequestPath -PathType Leaf) {
                $stopRequested = $true
                break
            }
            Start-Sleep -Seconds 2
        }

        if ($stopRequested) {
            Write-LauncherLog 'stop request observed; draining worker'
            Stop-WorkerProcess -Process $proc -GraceSeconds $GraceSeconds
            $exitCode = 0  # intentional stop: do not trigger restart-on-failure
            Write-LauncherLog 'worker stopped by request'
        } else {
            $proc.WaitForExit() | Out-Null
            $exitCode = $proc.ExitCode
            Write-LauncherLog ('worker exited with code {0}' -f $exitCode)
        }
    } catch {
        Write-LauncherLog ('launcher error: {0}' -f $_.Exception.Message)
        $exitCode = 1
    } finally {
        if ($proc -and -not $proc.HasExited) {
            try { $proc.Kill() } catch { }
        }
        foreach ($key in @('APP_URL', 'WORKER_TOKEN')) {
            [System.Environment]::SetEnvironmentVariable($key, $null, 'Process')
        }
        Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $stopRequestPath -Force -ErrorAction SilentlyContinue
        if ($mutex) {
            try { $mutex.ReleaseMutex() } catch { }
            $mutex.Dispose()
        }
    }
    return $exitCode
}

# ---------------------------------------------------------------------------
# Plan (always printed; no secret values)
# ---------------------------------------------------------------------------
Write-Host 'JP-022 Windows worker start - DRY RUN (nothing started)'
Write-Host ('  Mode:            {0}' -f $(if ($Run) { 'launcher (-Run)' } else { 'manual task start' }))
Write-Host ('  Repo:            {0}' -f $repoRoot)
Write-Host ('  Worker script:   {0}' -f $workerScript)
Write-Host ('  State root:      {0}' -f $stateRootFull)
Write-Host ('  Config:          {0} (decrypted into process environment only)' -f $configPath)
Write-Host ('  Logs:            {0} (per-run worker.out-*/worker.err-*; keep {1})' -f $logDir, $LogKeep)
Write-Host ('  Singleton:       {0}' -f $mutexName)
Write-Host ('  Task name:       {0}' -f $TaskName)
if ($Run) {
    Write-Host ('  Node command:    {0} "{1}"' -f $(if ($NodeExe) { $NodeExe } else { 'node (PATH)' }), $workerScript)
    Write-Host ('  Stop sentinel:   {0}' -f $stopRequestPath)
    Write-Host ('  Grace period:    {0}s before forced termination' -f $GraceSeconds)
    Write-Host '  Secrets:         no values printed; never passed as command-line arguments.'
} else {
    Write-Host ('  Would call:      Start-ScheduledTask -TaskName "{0}"' -f $TaskName)
}
Write-Host '  Re-run with -Apply (and -Run for the launcher) to execute.'

if (-not $Apply) { exit 0 }

if ($Run) {
    $code = Invoke-Launcher
    exit $code
}

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $existingTask) {
    throw "Task '$TaskName' is not registered. Run install-worker.ps1 -Apply first."
}
if ($PSCmdlet.ShouldProcess($TaskName, 'Start scheduled task')) {
    if ($existingTask.State -eq 'Running') {
        Write-Host ('Task {0} is already running (no duplicate start).' -f $TaskName)
    } else {
        Start-ScheduledTask -TaskName $TaskName
        Write-Host ('Start requested for task {0}.' -f $TaskName)
    }
}
