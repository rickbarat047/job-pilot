# JobPilot AI — Readiness Status

## Current assessment

**Not ready for public launch yet.** JobPilot contains useful candidate workflow features, but the current production deployment is not a verified end-to-end service. It can help candidates organize a search, find selected ATS-hosted postings, compare roles with their profile, prepare application materials, and track applications. It cannot promise interviews or employment, and its current curated job-source coverage is too narrow to claim comprehensive job discovery.

## Completed locally

- Authentication, candidate profile/preferences, CV upload and parsing.
- Job-source adapters, normalization, deduplication, matching, and link verification.
- Application pipeline, document generation, interview preparation, recruiter contacts, notifications, and analytics.
- Playwright worker and ATS form automation with approval/permission controls.
- Recently improved: fair rotation of job-link verification, safe fallback for sites rejecting `HEAD`, account export and deletion behavior, ownership of new manual job imports, and explicit consent controls for automatic submission.
- Himalayas source handling now honors its documented 20-item page limit, follows up to five cursor pages per discovery, excludes expired postings, and displays a visible source link on job cards and details.
- Browser submission success callbacks now use an atomic state transition and safely return the recorded result on retries, preventing duplicate application history and notifications.
- Match scores for postings with no skill evidence are capped at 60, described as uncertain, and no longer count a placeholder as a candidate strength.
- Monthly INR salary amounts are normalized to annual LPA before salary-fit scoring; explicit LPA values remain unchanged.
- Application approval now enforces same-origin requests and records the state transition plus audit event atomically, with a concurrent-state check.
- Health readiness now returns HTTP 503 when the database, AI provider, or browser worker is unavailable, with component details in the response body.
- All cookie-authenticated application mutations now enforce same-origin requests; withdraw/reject/retry also save status and timeline events atomically with state-change checks.
- Browser worker success, manual-intervention, retry, and failure callbacks now claim tasks and write related application history atomically to prevent duplicate events after concurrent callbacks.
- Application-answer drafts now only describe matched profile skills as candidate strengths; education and location fit signals are not mislabeled as skills, and uncertain relevance is stated for the candidate to review.
- Account deletion removes legacy unowned manual imports only when they are referenced by that account and no other account; shared and unreferenced rows are preserved.
- Local verification: 40 test files / 213 tests pass; TypeScript typecheck passes; targeted ESLint and `git diff --check` pass.

## Launch blockers to resolve

1. **Worker availability:** latest read-only production health check (2026-11-14 17:05:19 UTC) returned HTTP 200 but reported `worker: offline`. The local health route now returns HTTP 503 for that state, but the fix is not deployed; production must pass a real queued-task round trip. Historical run logs record a mismatch between the GitHub Actions and Vercel `WORKER_TOKEN` secrets; both must be aligned, then a successful heartbeat and real queued-task round trip verified.
2. **Build/deployment:** these local changes have not been built or deployed. The local Next.js build could not start because Windows denied access while SWC canonicalized the checkout path. Re-run build and browser/API smoke checks in a supported checkout or CI before release.
3. **Production database:** migration `0005_manual_job_ownership.sql` is pending. Back up the production database and verify restore before applying it; do not deploy code relying on the new column until then.
4. **Account deletion:** new manual imports are owner-scoped. Deletion now also removes legacy manual jobs only when the account references them and no other account does. Unreferenced or shared legacy rows remain because their owner cannot be proven.
5. **Public access and domain:** production deployment protection is enabled and no custom domain was found. Decide and configure an intentional launch access model and domain before announcing the service.
6. **Job coverage and freshness:** current sources cover a curated list of company ATS boards plus selected remote boards. Measure stale links and useful-role coverage with real candidate searches; broaden or clearly describe coverage.
7. **Application safety:** validate the consent and approval flow on real supported ATS sites. Never claim automatic application success until each submission is confirmed by the destination site.

## Production restrictions still in force

Production data/schema changes, environment-variable changes, and deployments remain unperformed. No secrets are recorded here. Reconfirm a verified backup, migration review, and deployment plan before those operations.

## Latest external check

Read-only Vercel inspection on 2026-11-14 found READY production deployment `dpl_EqRRHTwAGmMcb6z9vFaT4s6rQKgz` (commit `6c94643744b652194e59950290a4bbbd465aa435`), project `live: false`, SSO protection enabled, and no custom domain attached. Its `/api/health` response was HTTP 200 with `database: ok`, `ai: configured`, `worker: offline`, timestamp `2026-11-14T17:05:19.292Z`. The latest local candidate-materials change is not deployed; this is not launch sign-off.
