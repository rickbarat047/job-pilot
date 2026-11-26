# Windows worker setup (JP-022, free-only)

This document describes the **local Windows** deployment option for
`scripts/persistent-worker.mjs`. It complements — and does not change —
[`WORKER_DEPLOYMENT.md`](./WORKER_DEPLOYMENT.md). No Vercel configuration,
application code, database migration (including `0005`), production credential,
real job application, or email is involved.

## Scope and hard limits

- **₹0 additional spend.** No Fly.io, Railway, paid Render, VPS, Docker hosting,
  WSL, or Docker Desktop. The worker runs on an existing Windows PC.
- The PC runs the app it can reach at `APP_URL` (normally a local or staging
  instance). It never needs production data or production credentials.
- Task Scheduler is used only as a local process supervisor: logon trigger plus
  bounded restart-on-failure. No cloud scheduler, no remote agent.
- Every script is **dry-run by default**. Nothing is registered, started,
  stopped, or written unless the operator passes `-Apply` (and, for the
  scheduled-task path, `-WhatIf` is not in effect).

## Prerequisites

- Windows 10/11, Windows PowerShell 5.1 or later (no admin rights required).
- Node.js **>= 24** on PATH, or an explicit `-NodeExe` path.
- Playwright's Chromium available locally (`npx playwright install chromium`).
  This is a one-time local download, not hosting spend.
- A local/staging `WORKER_TOKEN` that matches the app's environment. Never use
  a production token here.
- A writable per-user state directory, by default
  `%LOCALAPPDATA%\JobPilotAI\worker`. Keep it outside the repository.

## Files

| File | Purpose |
|------|---------|
| `scripts/windows/install-worker.ps1` | Validates the repo, prints the plan, and (with `-Apply`) writes encrypted config + registers the task. Does not start it. |
| `scripts/windows/start-worker.ps1` | Manual start helper; with `-Run -Apply` it is the long-lived launcher used by the task. |
| `scripts/windows/stop-worker.ps1` | Requests a cooperative stop; with `-Apply` writes the sentinel and waits, with a guarded fallback. |
| `scripts/windows/uninstall-worker.ps1` | Removes the task; optionally removes local state with `-RemoveState`. |
| `scripts/windows/worker.env.example` | Placeholder-only reference for config keys/defaults. Never filled in or committed with real values. |

## Secret handling

- `APP_URL` and `WORKER_TOKEN` are entered at masked prompts and stored as
  **DPAPI-encrypted standard strings** (`ConvertFrom-SecureString`, CurrentUser
  scope) in `config\worker.env.enc`.
- The config directory, file, and log directory are ACL'd to the **current user
  only** (inheritance disabled, all other ACEs removed).
- The launcher decrypts values into its own process environment, starts `node`,
  then clears them from the launcher environment. Secrets are never printed,
  written to plaintext on disk, put in the scheduled-task XML, or passed as
  command-line arguments.
- Logs receive only launcher status lines plus the worker's own redacted
  output. The worker sends the token in the `x-worker-token` header and never
  logs it; applicant data is not written by these scripts.
- A task name and named mutex include an 8-hex-digit hash of the repo path so
  two checkouts cannot collide. No secret is included in either name.

## Step 1 — always dry-run first (safe on any PC)

From the repository root:

```powershell
.\scripts\windows\install-worker.ps1
.\scripts\windows\start-worker.ps1
.\scripts\windows\stop-worker.ps1
.\scripts\windows\uninstall-worker.ps1
```

Each command prints a plan prefixed with `DRY RUN` and exits without writing
files, prompting for secrets, or touching Task Scheduler. `Get-ScheduledTask`
read-only checks may report whether the task already exists. Node absence is
reported as a warning in the install plan; it is not an error in dry-run mode.

To additionally exercise the PowerShell `ShouldProcess` plumbing without any
change, append `-WhatIf` to any command. `-Apply -WhatIf` still changes nothing.

## Step 2 — install (operator's own PC, explicit opt-in)

```powershell
.\scripts\windows\install-worker.ps1 -Apply
```

The operator is prompted for `APP_URL` and `WORKER_TOKEN` (masked). The script
then creates the ACL'd config/log directories, writes the encrypted config, and
registers a task with:

- **Trigger:** at logon of the current user.
- **Principal:** current user, `LogonType=Interactive`, `RunLevel=Limited`
  (least privilege; no elevation).
- **Action:** `powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle
  Hidden -ExecutionPolicy Bypass -File <launcher> -Run -Apply -StateRoot ...`
- **Settings:** `MultipleInstances=IgnoreNew`, `RestartCount=3`,
  `RestartInterval=1 minute`, no execution time limit, start-if-missed,
  allowed on batteries.

The task is **not started** by install. Use `-Reconfigure` to replace an
existing encrypted config (for example after rotating a staging token), and
`-NodeExe "C:\Program Files\nodejs\node.exe"` if Node is not on the task's PATH.

Optional tuning keys can be added to the encrypted config by the operator; see
`worker.env.example` for the key names and defaults. Example for a non-secret
value:

```powershell
$config = Join-Path $env:LOCALAPPDATA 'JobPilotAI\worker\config\worker.env.enc'
$enc = ConvertFrom-SecureString -SecureString (ConvertTo-SecureString '5000' -AsPlainText -Force)
Add-Content -LiteralPath $config -Value "POLL_INTERVAL_MS=$enc"
```

## Manual start, foreground debugging, and stop

```powershell
# Start the registered task (no duplicate if it is already Running).
.\scripts\windows\start-worker.ps1 -Apply

# Foreground launcher for debugging: same singleton + config + logging path.
.\scripts\windows\start-worker.ps1 -Run -Apply
# Press Ctrl+C in this window to stop; the launcher removes its PID file and
# releases the singleton mutex on exit.

# Cooperative stop of the task-launched worker.
.\scripts\windows\stop-worker.ps1 -Apply
```

`stop-worker.ps1 -Apply` writes a timestamp-only sentinel. The launcher polls
for it every 2 seconds, asks the child to terminate, waits `-GraceSeconds`
(default 30), then forces termination. It exits with code `0` on an intentional
stop so restart-on-failure does not fight the operator. If the launcher does not
finish within `-WaitSeconds` (default 60), the script falls back to
`Stop-ScheduledTask` and, as a last resort, stops the PID **only after**
verifying its command line contains `persistent-worker.mjs`.

### Singleton / duplicate-process protection

1. Task Scheduler setting `MultipleInstances=IgnoreNew` prevents two instances
   of the task from running at once.
2. The launcher holds a named mutex (`Local\JobPilotAI-Worker-<hash>`) for its
   whole lifetime, so a foreground launch or a second task definition cannot
   start a second `node` process. A second launcher logs a one-line message and
   exits `0` without spawning anything.
3. `worker.pid` is written after spawn and removed in a `finally` block. Stop
   logic verifies the PID's command line before acting, so a reused PID cannot
   cause an unrelated process to be killed.

### Logs and rotation

- `%LOCALAPPDATA%\JobPilotAI\worker\logs\launcher.log` — launcher status only;
  rotated when it exceeds 5 MiB or 7 days, keeping 5 archives.
- `worker.out-<timestamp>.log` / `worker.err-<timestamp>.log` — a fresh pair per
  launch, so nothing is truncated while the child has a file open. The newest 5
  pairs are retained; older ones are pruned on each launch.
- Paths and retention can be changed with `-StateRoot`, `-LogMaxBytes`,
  `-LogMaxAgeDays`, and `-LogKeep` (mirrored from install into the task action).
- `worker.env.enc`, PID files, and the stop sentinel contain no loggable secret
  values. The sentinel holds only an ISO timestamp.

## Uninstall

```powershell
.\scripts\windows\uninstall-worker.ps1            # dry run
.\scripts\windows\uninstall-worker.ps1 -Apply      # stop, unregister, keep config/logs
.\scripts\windows\uninstall-worker.ps1 -Apply -RemoveState   # also delete local state
```

`-RemoveState` overwrites the encrypted config with zeros before deletion and
removes the whole state directory. Omitting it preserves the encrypted config
and logs for a future reinstall.

## Verification checklist (local/staging only)

- All four dry-run commands print a plan and leave Task Scheduler unchanged.
- After `-Apply`, the task exists with the logon trigger, `IgnoreNew`, restart
  count/interval, and least-privilege principal described above.
- The task definition contains no `APP_URL`, `WORKER_TOKEN`, or other secret.
- `Get-Process node` shows at most one worker process; a second launcher exits
  immediately.
- `launcher.log` and worker logs contain no token values and no applicant PII.
- A cooperative stop leaves no `worker.pid` or `stop.request` behind and does
  not trigger a restart.
- `npm run typecheck` and `npx vitest run src/lib/persistent-worker.test.ts`
  remain unchanged and passing (these scripts do not touch them).

## Residual risks

- **Graceful stop is best-effort on Windows.** Task Scheduler sessions cannot
  reliably deliver POSIX `SIGTERM` to a console process, and `taskkill` without
  `/F` does not guarantee a console Ctrl event. The worker's drain/offline
  heartbeat is therefore not guaranteed on a forced stop. The app's stale-lock
  recovery and idempotent result API still prevent duplicate recording; for a
  guaranteed drain, run in the foreground and press Ctrl+C.
- **Log growth within one long run.** Per-run files avoid truncation but a
  single uninterrupted run can exceed `-LogMaxBytes` before the next launch
  prunes. Use a bounded `MAX_TASKS` in the encrypted config if rolling restarts
  are desired.
- **DPAPI is tied to the Windows user profile.** Another user, a roaming
  profile mismatch, or a rebuilt profile cannot decrypt the config; re-run
  `install-worker.ps1 -Reconfigure`. There is no recovery of a lost token.
- **Mutex scope.** `Local\` scopes the mutex to a logon session; two interactive
  sessions for the same user are still guarded by Task Scheduler's `IgnoreNew`
  setting, but a manually launched process in a different session is outside
  that mutex. Keep one active launcher per user.
- **At-logon trigger only.** If the user never logs on, the worker does not
  run. An app-side `offline` state during logoff/sleep is honest behaviour.
- **No remote management or auto-update.** Token rotation, Node/Playwright
  upgrades, and repo moves require a manual `-Reconfigure` / reinstall.

## Authoring note

These scripts were authored and validated in **dry-run mode only**. No Task
Scheduler task was registered or started on the authoring PC, no production
system was contacted, no real token was used, and no commit or push was made.
