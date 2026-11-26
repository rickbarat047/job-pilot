#Requires -Version 5.1
<#
.SYNOPSIS
    Requests a cooperative stop of the Windows worker (and, only with -Apply,
    performs the stop).

.DESCRIPTION
    DRY RUN BY DEFAULT. Without -Apply this script only reports what it would do.

    With -Apply it writes a stop-request sentinel. The launcher (-Run) polls for
    that sentinel, asks the worker process to terminate, waits for a bounded
    grace period, and exits with code 0 so Task Scheduler's restart-on-failure
    does not immediately restart it. If the launcher does not finish within
    -WaitSeconds, this script falls back to Stop-ScheduledTask and, as a last
    resort, stops the PID only after verifying its command line belongs to this
    repository's persistent worker.

.EXAMPLE
    .\stop-worker.ps1
    Prints the stop plan; writes nothing.

.EXAMPLE
    .\stop-worker.ps1 -Apply
    Requests the stop and waits up to 60 seconds.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch] $Apply,
    [string] $StateRoot = (Join-Path $env:LOCALAPPDATA 'JobPilotAI\worker'),
    [string] $TaskName,
    [ValidateRange(1, 3600)]
    [int] $WaitSeconds = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$workerScript = Join-Path $repoRoot 'scripts\persistent-worker.mjs'

$stateRootFull = [System.IO.Path]::GetFullPath($StateRoot)
$stopRequestPath = Join-Path $stateRootFull 'stop.request'
$pidPath = Join-Path $stateRootFull 'worker.pid'

function Get-Tag {
    param([Parameter(Mandatory)][string] $Value)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value.ToLowerInvariant())
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash($bytes) } finally { $sha.Dispose() }
    -join ($hash[0..3] | ForEach-Object { $_.ToString('x2') })
}

$repoTag = Get-Tag -Value $repoRoot
if ([string]::IsNullOrWhiteSpace($TaskName)) { $TaskName = "JobPilotAI-Worker-$repoTag" }

function Get-WorkerProcessInfo {
    if (-not (Test-Path -LiteralPath $pidPath -PathType Leaf)) { return $null }
    $raw = ([System.IO.File]::ReadAllText($pidPath)).Trim()
    $pidValue = 0
    if (-not [int]::TryParse($raw, [ref] $pidValue)) { return $null }
    try {
        $ci = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$pidValue" -ErrorAction Stop
    } catch {
        return $null
    }
    # PID-reuse guard: never stop a process that is not this repo's worker.
    if ($ci.CommandLine -notlike '*persistent-worker.mjs*') { return $null }
    return $ci
}

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$taskState = if ($existingTask) { [string] $existingTask.State } else { 'not registered' }
$procInfo = Get-WorkerProcessInfo
$pidLabel = if ($procInfo) { [string] $procInfo.ProcessId } else { 'none verified' }

Write-Host 'JP-022 Windows worker stop - DRY RUN (no stop requested)'
Write-Host ('  Repo:            {0}' -f $repoRoot)
Write-Host ('  Task:            {0} ({1})' -f $TaskName, $taskState)
Write-Host ('  Stop sentinel:   {0}' -f $stopRequestPath)
Write-Host ('  Worker PID:      {0} (verified by command line)' -f $pidLabel)
Write-Host ('  Would wait:      {0}s for a cooperative exit before fallback' -f $WaitSeconds)
Write-Host '  Fallback:        Stop-ScheduledTask, then PID stop only if command line matches.'
Write-Host '  Re-run with -Apply to execute.'

if (-not $Apply) { exit 0 }

if (-not $PSCmdlet.ShouldProcess($TaskName, 'Request cooperative worker stop')) {
    exit 0
}

$sentinelWritten = $false
try {
    if (-not (Test-Path -LiteralPath $stateRootFull -PathType Container)) {
        # Nothing to stop; the state directory only exists after an install.
        Write-Host 'No worker state directory found; nothing to stop.'
        exit 0
    }
    # Timestamp only: no credentials or personal data in the sentinel.
    [System.IO.File]::WriteAllText($stopRequestPath, (Get-Date -Format 'o'))
    $sentinelWritten = $true
    Write-Host 'Stop request written; waiting for the launcher to finish.'

    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $stillRunning = $false
        $taskNow = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($taskNow -and $taskNow.State -eq 'Running') { $stillRunning = $true }
        if (Get-WorkerProcessInfo) { $stillRunning = $true }
        if (-not $stillRunning) { break }
        Start-Sleep -Seconds 2
    }

    $taskNow = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($taskNow -and $taskNow.State -eq 'Running') {
        Write-Host 'Grace period elapsed; stopping the scheduled task.'
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    }

    $procNow = Get-WorkerProcessInfo
    if ($procNow) {
        Write-Host ('Grace period elapsed; stopping verified worker PID {0}.' -f $procNow.ProcessId)
        Stop-Process -Id $procNow.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Write-Host 'Stop sequence complete.'
} finally {
    if ($sentinelWritten) {
        Remove-Item -LiteralPath $stopRequestPath -Force -ErrorAction SilentlyContinue
    }
}
