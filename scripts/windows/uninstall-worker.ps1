#Requires -Version 5.1
<#
.SYNOPSIS
    Removes the per-user worker scheduled task (only with -Apply).

.DESCRIPTION
    DRY RUN BY DEFAULT. Without -Apply this script only reports what it would do.

    With -Apply it first requests a cooperative stop, waits briefly, unregisters
    the scheduled task, and removes the stop sentinel. Local encrypted config
    and logs are KEPT by default; add -RemoveState to delete them (the encrypted
    config is overwritten before deletion).

.EXAMPLE
    .\uninstall-worker.ps1
    Prints the uninstall plan; changes nothing.

.EXAMPLE
    .\uninstall-worker.ps1 -Apply -RemoveState
    Stops, unregisters the task, and deletes the local state directory.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch] $Apply,
    [string] $StateRoot = (Join-Path $env:LOCALAPPDATA 'JobPilotAI\worker'),
    [string] $TaskName,
    [ValidateRange(1, 3600)]
    [int] $WaitSeconds = 30,
    # Opt-in destruction of the local encrypted config and logs.
    [switch] $RemoveState
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$stateRootFull = [System.IO.Path]::GetFullPath($StateRoot)
$configPath = Join-Path (Join-Path $stateRootFull 'config') 'worker.env.enc'
$stopRequestPath = Join-Path $stateRootFull 'stop.request'

function Get-Tag {
    param([Parameter(Mandatory)][string] $Value)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value.ToLowerInvariant())
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash($bytes) } finally { $sha.Dispose() }
    -join ($hash[0..3] | ForEach-Object { $_.ToString('x2') })
}

$repoTag = Get-Tag -Value $repoRoot
if ([string]::IsNullOrWhiteSpace($TaskName)) { $TaskName = "JobPilotAI-Worker-$repoTag" }
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$taskState = if ($existingTask) { [string] $existingTask.State } else { 'not registered' }

Write-Host 'JP-022 Windows worker uninstall - DRY RUN (nothing removed)'
Write-Host ('  Repo:            {0}' -f $repoRoot)
Write-Host ('  Task:            {0} ({1})' -f $TaskName, $taskState)
Write-Host ('  State root:      {0}' -f $stateRootFull)
Write-Host ('  Encrypted config:{0}' -f $(if (Test-Path -LiteralPath $configPath) { ' present (never printed)' } else { ' absent' }))
Write-Host ('  Remove state:    {0}' -f $(if ($RemoveState) { 'yes (-RemoveState)' } else { 'no (config and logs kept)' }))
Write-Host '  Re-run with -Apply to execute.'

if (-not $Apply) { exit 0 }

if (-not $PSCmdlet.ShouldProcess($TaskName, 'Unregister scheduled task')) { exit 0 }

$sentinelWritten = $false
try {
    if (Test-Path -LiteralPath $stateRootFull -PathType Container) {
        [System.IO.File]::WriteAllText($stopRequestPath, (Get-Date -Format 'o'))
        $sentinelWritten = $true
        $deadline = (Get-Date).AddSeconds($WaitSeconds)
        while ((Get-Date) -lt $deadline) {
            $taskNow = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            if (-not $taskNow -or $taskNow.State -ne 'Running') { break }
            Start-Sleep -Seconds 2
        }
    }

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
        Write-Host ('Unregistered task {0}.' -f $TaskName)
    } else {
        Write-Host ('Task {0} was not registered.' -f $TaskName)
    }

    if ($RemoveState -and (Test-Path -LiteralPath $stateRootFull -PathType Container)) {
        if (Test-Path -LiteralPath $configPath -PathType Leaf) {
            # Best-effort overwrite before delete; on SSDs deletion is the
            # stronger guarantee, but this reduces casual recovery.
            try {
                [System.IO.File]::WriteAllBytes($configPath, [byte[]]::new(4096))
            } catch { }
        }
        Remove-Item -LiteralPath $stateRootFull -Recurse -Force -ErrorAction Stop
        Write-Host 'Local state directory removed.'
    } elseif (-not $RemoveState) {
        Write-Host ('Local encrypted config and logs were kept at {0}.' -f $stateRootFull)
    }
} finally {
    if ($sentinelWritten) {
        Remove-Item -LiteralPath $stopRequestPath -Force -ErrorAction SilentlyContinue
    }
}
