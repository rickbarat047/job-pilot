# Oracle Cloud Always Free — worker hosting research (JP-022)

**Status: research only. No account, VM, paid upgrade, or deployment was created.**

## Why this was investigated

The free-first worker plan uses an existing Windows PC with native Node.js and
Windows Task Scheduler (₹0 additional spend). That depends on the PC being on
and logged in. Oracle Cloud's Always Free tier is a possible future 24/7 option
that also has no recurring charge, but only if it stays strictly inside the
Always Free allowances.

## Published Always Free limits (checked 2026-11-26)

| Resource | Always Free allowance |
| --- | --- |
| Ampere ARM `VM.Standard.A1.Flex` | 1,500 OCPU-hours + 9,000 GB-hours/month → **2 OCPU / 12 GB RAM** simultaneously |
| AMD `VM.Standard.E2.1.Micro` | Up to 2 instances (burstable) |
| Block + boot storage | 200 GB total |
| Outbound data | 10 TB/month |
| Instances left idle | Reclaimed if 7-day p95 CPU/network/memory < 20% |

The ARM allowance is currently documented as 2 OCPU / 12 GB (older material
still says 4 OCPU / 24 GB). Treat the official 2 OCPU / 12 GB figure as the
safe planning ceiling.

## Playwright on ARM — compatibility notes

- Use **linux/arm64** images and binaries. x86_64 binaries fail with
  `exec format error`.
- On Ubuntu 24.04 aarch64 install Chromium with
  `npx playwright install chromium` plus `npx playwright install-deps chromium`.
- Headless Chromium needs roughly 300–500 MB RAM per browser context; keep a
  single worker process and avoid parallel contexts on the 12 GB free VM.
- Launch flags for a restricted container/VM environment:
  `--no-sandbox --disable-dev-shm-usage`.
- Pin Playwright to the repository lockfile version (currently 1.65.1) rather
  than any separately installed version.

## Availability caveats

- ARM capacity is frequently unavailable ("out of host capacity"). Try another
  availability domain or wait. **Do not upgrade the account to PAYG** — that
  creates charge risk and violates the free-first constraint.
- The worker must generate non-idle activity (polling/heartbeats) to avoid the
  7-day low-utilisation reclamation rule.
- The home region must be used for Always Free resources.

## Decision

Do **not** provision Oracle Always Free as part of JP-022. Keep the native
Windows worker as the ₹0 target. Revisit only if the PC cannot stay online and
an operator explicitly approves a no-charge ARM instance, with the guardrail
that no PAYG upgrade is permitted.

No credentials, tenancy details, or paid-service settings are stored here.
