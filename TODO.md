# JobPilot AI — Readiness Status

## Current assessment

**Not ready for public launch yet.** JobPilot contains useful candidate workflow features, but the current production deployment is not a verified end-to-end service. It can help candidates organize a search, find selected ATS-hosted postings, compare roles with their profile, prepare application materials, and track applications. It cannot promise interviews or employment, and its current curated job-source coverage is too narrow to claim comprehensive job discovery.

## Completed locally

- Authentication, candidate profile/preferences, CV upload and parsing.
- Job-source adapters, normalization, deduplication, matching, and link verification.
- Application pipeline, document generation, interview preparation, recruiter contacts, notifications, and analytics.
- Playwright worker and ATS form automation with approval/permission controls.
- Recently improved: fair rotation of job-link verification, safe fallback for sites rejecting `HEAD`, account export and deletion behavior, ownership of new manual job imports, and explicit consent controls for automatic submission.
- Himalayas source handling now honors its documented 20-item page limit, excludes expired postings, and displays a visible source link on job cards and details.
- Local verification: 38 test files / 194 tests pass; TypeScript typecheck passes; targeted ESLint and `git diff --check` pass.

## Launch blockers to resolve

1. **Worker availability:** last read-only production health check returned HTTP 200 but reported `worker: offline`. A green health status must require the worker to be reachable, and production must pass a real queued-task round trip.
2. **Build/deployment:** these local changes have not been built or deployed. The local Next.js build could not start because Windows denied access while SWC canonicalized the checkout path. Re-run build and browser/API smoke checks in a supported checkout or CI before release.
3. **Production database:** migration `0005_manual_job_ownership.sql` is pending. Back up the production database and verify restore before applying it; do not deploy code relying on the new column until then.
4. **Account deletion:** new manual imports are owner-scoped. Legacy unowned manual job rows cannot safely be attributed or removed automatically; design a scoped cleanup before claiming complete erasure of every legacy import.
5. **Public access and domain:** production deployment protection is enabled and no custom domain was found. Decide and configure an intentional launch access model and domain before announcing the service.
6. **Job coverage and freshness:** current sources cover a curated list of company ATS boards plus selected remote boards. Measure stale links and useful-role coverage with real candidate searches; broaden or clearly describe coverage.
7. **Application safety:** validate the consent and approval flow on real supported ATS sites. Never claim automatic application success until each submission is confirmed by the destination site.

## Production restrictions still in force

Production data/schema changes, environment-variable changes, and deployments remain unperformed. No secrets are recorded here. Reconfirm a verified backup, migration review, and deployment plan before those operations.

## Latest external check

Read-only Vercel inspection found a READY production deployment, SSO protection enabled, and `/api/health` returning `database: ok`, `ai: configured`, `worker: offline`. This describes the deployment before the local uncommitted changes; it is not launch sign-off.
