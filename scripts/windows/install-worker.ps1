#Requires -Version 5.1
<#
.SYNOPSIS
    Prepares (and, only with -Apply, registers) a per-user Windows Task Scheduler
    task for the persistent browser worker.

.DESCRIPTION
    DRY RUN BY DEFAULT. This script never registers or starts a task unless the
    explicit -Apply switch is supplied (and -WhatIf is not). Without -Apply it
    only resolves paths, validates the repo, and prints the exact plan.

    Secrets are supplied via masked prompts and stored as DPAPI-encrypted
    standard strings under a user-only ACL. No secret value is ever printed,
    echoed to a task definition, or placed on a command line.

.EXAMPLE
    .\install-worker.ps1
    Prints the plan; changes nothing.

.EXAMPLE
    .\install-worker.ps1 -Apply
    Prompts for APP_URL / WORKER_TOKEN, writes the encrypted config, and
    registers the logon + restart-on-failure task. Does NOT start the task.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    # Explicit opt-in. Without it the script is strictly read-only.
    [switch] $Apply,

    # Per-user state root. Keep outside the repo; no admin rights required.
    [string] $StateRoot = (Join-Path $env:LOCALAPPDATA 'JobPilotAI\worker'),

    # Defaults to a repo-specific name so different checkouts cannot collide.
    [string] $TaskName,

    # Force re-prompting for secrets even if an encrypted config already exists.
    [switch] $Reconfigure,

    # Log rotation policy used by the launcher.
    [ValidateRange(1, 104857600)]
    [int] $LogMaxBytes = 5242880,
    [ValidateRange(1, 365)]
    [int] $LogMaxAgeDays = 7,
    [ValidateRange(1, 50)]
    [int] $LogKeep = 5,

    [ValidateRange(1, 10)]
    [int] $RestartCount = 3,
    [ValidateRange(1, 60)]
    [int] $RestartIntervalMinutes = 1,
    [ValidateRange(1, 3600)]
    [int] $GraceSeconds = 30,

    # Optional explicit path to node.exe when it is not on the task's PATH.
    [string] $NodeExe
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Path / identity helpers
# ---------------------------------------------------------------------------
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$workerScript = Join-Path $repoRoot 'scripts\persistent-worker.mjs'
$launcherScript = Join-Path $PSScriptRoot 'start-worker.ps1'
$packageJson = Join-Path $repoRoot 'package.json'

foreach ($required in @($workerScript, $launcherScript, $packageJson)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Required file not found: $required"
    }
}

$stateRootFull = [System.IO.Path]::GetFullPath($StateRoot)
$configDir = Join-Path $stateRootFull 'config'
$configPath = Join-Path $configDir 'worker.env.enc'
$logDir = Join-Path $stateRootFull 'logs'
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
$psExe = (Get-Command powershell.exe -ErrorAction Stop).Source
$actionArgs = '-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -Run -Apply -StateRoot "{1}" -GraceSeconds {2} -LogMaxBytes {3} -LogMaxAgeDays {4} -LogKeep {5}' -f `
    $launcherScript, $stateRootFull, $GraceSeconds, $LogMaxBytes, $LogMaxAgeDays, $LogKeep
if (-not [string]::IsNullOrWhiteSpace($NodeExe)) {
    $nodeFull = [System.IO.Path]::GetFullPath($NodeExe)
    $actionArgs += ' -NodeExe "{0}"' -f $nodeFull
}

# Construct (but do not register) the task objects. This validates parameter
# values while remaining completely inert on the local machine.
$action = New-ScheduledTaskAction -Execute $psExe -Argument $actionArgs -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -RestartCount $RestartCount `
    -RestartInterval (New-TimeSpan -Minutes $RestartIntervalMinutes) `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------
function Set-UserOnlyAcl {
    param([Parameter(Mandatory)][string] $Path)
    $acl = Get-Acl -LiteralPath $Path
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) {
        try { $acl.RemoveAccessRule($rule) | Out-Null } catch { }
    }
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $currentSid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Get-EncryptedValue {
    param([Parameter(Mandatory)][System.Security.SecureString] $Secure)
    # ConvertFrom-SecureString without -Key uses Windows DPAPI (CurrentUser).
    ConvertFrom-SecureString -SecureString $Secure
}

# ---------------------------------------------------------------------------
# Plan (always printed, never contains secret values)
# ---------------------------------------------------------------------------
$lines = @(
    'JP-022 Windows worker install - DRY RUN (no task registered, nothing written)',
    ('  Repo:            {0}' -f $repoRoot),
    ('  Worker script:   {0}' -f $workerScript),
    ('  Launcher:        {0}' -f $launcherScript),
    ('  State root:      {0}' -f $stateRootFull),
    ('  Config:          {0} (DPAPI-encrypted, user-only ACL)' -f $configPath),
    ('  Logs:            {0} (per-run files, prune to {1}; rotate launcher log at {2} bytes / {3} days)' -f $logDir, $LogKeep, $LogMaxBytes, $LogMaxAgeDays),
    ('  Task name:       {0}' -f $TaskName),
    ('  Task state:      {0}' -f $(if ($existingTask) { 'ALREADY EXISTS (would be replaced with -Force)' } else { 'absent' })),
    ('  Trigger:         At logon of {0}' -f $currentUser),
    ('  Principal:       {0}; LogonType=Interactive; RunLevel=Limited' -f $currentUser),
    ('  Action:          {0}' -f $actionArgs),
    ('  Settings:        MultipleInstances=IgnoreNew; RestartCount={0}; RestartInterval={1}m; ExecutionTimeLimit=none' -f $RestartCount, $RestartIntervalMinutes),
    ('  Singleton:       named mutex {0} held by launcher for its lifetime' -f $mutexName),
    ('  Config state:    {0}' -f $(if (Test-Path -LiteralPath $configPath) { 'exists (kept unless -Reconfigure)' } else { 'missing (would prompt with masked input)' })),
    '  Secrets:         APP_URL / WORKER_TOKEN values are never printed, never in task XML or argv.',
    ('  Node version:    {0}' -f $(try { & node --version 2>$null } catch { 'node.exe not found on PATH' })),
    '  To make changes, re-run with -Apply. To preview with cmdlets, add -WhatIf.'
)
$lines | ForEach-Object { Write-Host $_ }

if (-not $Apply) { return }

# ---------------------------------------------------------------------------
# Apply phase (explicit opt-in only)
# ---------------------------------------------------------------------------
$doWriteConfig = $false
if ($PSCmdlet.ShouldProcess($configPath, 'Create/refresh DPAPI-encrypted local worker config')) {
    $doWriteConfig = $true
}

if ($doWriteConfig) {
    if (-not (Test-Path -LiteralPath $configDir -PathType Container)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    Set-UserOnlyAcl -Path $configDir

    if ((-not (Test-Path -LiteralPath $configPath -PathType Leaf)) -or $Reconfigure) {
        $appUrl = Read-Host -Prompt 'APP_URL (local/staging app base URL, http or https)'
        $uri = $null
        if (-not [Uri]::TryCreate($appUrl, [UriKind]::Absolute, [ref] $uri) -or $uri.Scheme -notin @('http', 'https')) {
            throw 'APP_URL must be an absolute http(s) URL.'
        }
        $tokenSecure = Read-Host -Prompt 'WORKER_TOKEN (masked; local/staging token only)' -AsSecureString
        if ($tokenSecure.Length -eq 0) { throw 'WORKER_TOKEN must not be empty.' }

        $appUrlSecure = ConvertTo-SecureString -String $appUrl -AsPlainText -Force
        $entries = @(
            'APP_URL=' + (Get-EncryptedValue -Secure $appUrlSecure),
            'WORKER_TOKEN=' + (Get-EncryptedValue -Secure $tokenSecure)
        )
        [System.IO.File]::WriteAllLines($configPath, $entries, (New-Object System.Text.UTF8Encoding($false)))
        Set-UserOnlyAcl -Path $configPath
        $appUrlSecure.Dispose()
        $tokenSecure.Dispose()
        Write-Host 'Encrypted config written. Values were not displayed.'
    } else {
        Write-Host 'Existing encrypted config preserved (use -Reconfigure to replace it).'
    }

    if (-not (Test-Path -LiteralPath $logDir -PathType Container)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    Set-UserOnlyAcl -Path $logDir
}

$doRegister = $false
if ($PSCmdlet.ShouldProcess($TaskName, 'Register the logon/restart scheduled task')) {
    $doRegister = $true
}

if ($doRegister) {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description 'JobPilot AI persistent browser worker (per-user, logon trigger, restart on failure). No credentials in task definition.' `
        -Force | Out-Null
    Write-Host ('Registered task {0}. It was NOT started; use start-worker.ps1 -Apply to start it manually.' -f $TaskName)
} else {
    Write-Host 'Task registration skipped (WhatIf/ShouldProcess declined).'
}

Write-Host ('Prepare-only paths (no secrets): state={0}; stop-sentinel={1}; pid={2}' -f $stateRootFull, $stopRequestPath, $pidPath)
