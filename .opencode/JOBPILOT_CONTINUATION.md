# JobPilot continuation checkpoint

Updated: 2026-11-14

## Objective

Improve and verify the real candidate journey: relevant and current jobs, truthful candidate-specific materials, clear consent and approvals, and dependable application tracking. Never promise employment outcomes.

## Verified checkout state

- Repository: `job-pilot`
- Branch: `fix/candidate-application-safety`
- HEAD before the current uncommitted search/checkpoint changes: `65a1cc8` (`Add JobPilot planning and verification workflow`)
- The branch's last remotely confirmed SHA is `06a3666f16c761a78125b4aa5c60c4c31adb58d6`. Commits `1a3e0ce` and `65a1cc8` are local and have not been pushed.
- The latest push attempt could resolve GitHub but failed because Git Credential Manager/MSYS could not start (`NtCreateDirectoryObject ... 0xC0000022`); Git then had no username available. Do not rewrite history. Retry only through a working authenticated Git path.
- OpenCode project guidance and `/jobpilot-plan` and `/jobpilot-verify` commands are committed at `65a1cc8`.

## Current work in progress

The production database uses PostgreSQL while local development uses SQLite. A user-facing job search issue was found: repository filters used case-sensitive PostgreSQL `LIKE` while SQLite `LIKE` is case-insensitive. The current uncommitted fix changes title/company/description/location matching to portable `LOWER(...) LIKE ... ESCAPE` and escapes literal `%`, `_`, and backslashes. Regression test: `src/lib/repositories.jobs.test.ts`.

Checks run against this working change:

- Focused test: passed (1 test).
- Full suite: passed (41 files, 217 tests).
- Typecheck: passed.
- Lint: passed with 0 errors and 20 existing warnings.
- `git diff --check`: passed.
- SQLite expression was exercised directly and matched mixed-case input containing escaped wildcard characters.
- Build: blocked by Next.js/SWC on Windows failing to canonicalize the checkout path (`Access is denied`, OS error 5); this is the same environment-specific build failure recorded earlier.
- This checkpoint and the `/continue` command are new uncommitted OpenCode handoff setup.

## Next concrete action

1. Inspect the current diff and ensure the checkpoint still matches the actual worktree.
2. If the current diff and checks remain correct, commit the search fix and OpenCode continuation setup on `fix/candidate-application-safety`.
3. Retry publishing the feature branch only through an authenticated path that works; verify the remote SHA. Do not alter production.
4. Continue the candidate-journey audit from the highest priority incomplete item in `TODO.md`; seek a supported CI/preview build path since local Next build is blocked by this Windows path error.

## Production readiness evidence and blockers

- Production is unchanged. The current production deployment is on `main` and has not been signed off as ready.
- Migration `0005_manual_job_ownership.sql` is pending. Do not apply it without an outside-repository backup verified by `pg_restore --list`.
- The Supabase project is on the Free plan; the dashboard confirms scheduled database backups are not included. Do not upgrade or make a paid commitment.
- Production health previously showed database and AI available, but worker offline. The repository README clarifies the GitHub Actions worker may appear offline between scheduled runs; an actual safe queued-task round trip still needs verification.
- Vercel preview exists and is SSO-protected. Keep protection enabled; do not claim preview behavior is verified until authenticated end-to-end checks run.
- No production migration, schema/data change, hosted environment-variable change, protection change, or production deployment is authorized by the current restrictions.
- A credential was exposed in conversation. Treat it as compromised; do not use or repeat it, and advise its owner to rotate it.
