# Dependency audit & account-data cleanup review (JP-019)

Baseline: `b5bc03c`. Review performed read-only against production: no production DB, secrets, deployments, real accounts or emails were touched.

## 1. Dependency security audit

Fresh `npm audit --json` at the start of the task (Node 26.13.1, npm 11.20.0):

| Severity | Count |
| --- | --- |
| info | 0 |
| low | 0 |
| moderate | 7 |
| high | 1 |
| critical | 0 |
| **total** | **8** |

All 8 findings were in **dev-only** packages (the direct `playwright` devDependency and the `eslint-config-next` → `typescript-eslint` toolchain). Zero production-runtime vulnerabilities were found.

### Findings and root causes

| Package(s) | Sev | Prod/Dev | Direct? | Advisory / root cause | Vulnerable range |
| --- | --- | --- | --- | --- | --- |
| `playwright`, `playwright-core` | high | dev | yes (declared in `package.json`) | GHSA-7mvr-c777-76hp — browsers downloaded/installed without verifying SSL certificate authenticity (CWE-347) | `< 1.55.1` |
| `minimatch` (nested under `@typescript-eslint/typescript-estree`) | moderate | dev | no | GHSA-g3hv-75wg-m249 — DoS via globparts amplification (CWE-405) | `>=7.0.0 <11.0.1` |
| `typescript-eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils` | moderate (6) | dev | no | Transitive propagation of the vulnerable nested `minimatch` | `6.16.0–8.72.2` / `<=8.72.2` |

Dependency chain for the moderate cluster: `eslint-config-next@16.4.6` → `typescript-eslint@8.72.2` → `@typescript-eslint/typescript-estree@8.72.2` → nested `minimatch@10.2.6`. `typescript-estree@8.73.0+` declares `minimatch@^11.0.1`, which clears the advisory.

### Fix applied (minimal, compatible)

- `package.json`: direct devDependency floor raised `"playwright": "^1.49.0"` → `"^1.55.1"` (the advisory's fixed version; same major).
- `package-lock.json`: regenerated with **`npm audit fix --package-lock-only`** (no `--force`; no new dependencies; no major upgrades). Resulting resolved versions: `playwright`/`playwright-core` `1.49.0 → 1.65.1`, `typescript-eslint` and all `@typescript-eslint/*` `8.72.2 → 8.74.0`, nested vulnerable `minimatch@10.2.6` removed, nested `ignore` `7.0.14 → 7.0.17`. All are same-major compatible updates selected by npm.
- `node_modules` was synced locally with `npm install --ignore-scripts --no-audit --no-fund` so a plain audit reflects the lockfile. The npm 11 re-resolution also normalised optional bundled metadata for `@tailwindcss/oxide-wasm32-wasi` in the lockfile; no additional package versions changed.

### Audit results

| | info | low | moderate | high | critical | total |
| --- | --- | --- | --- | --- | --- | --- |
| Before (`npm audit --json`) | 0 | 0 | 7 | 1 | 0 | **8** |
| After (`npm audit --json`, node_modules synced) | 0 | 0 | 0 | 0 | 0 | **0** |
| After (`npm audit --package-lock-only --json`) | 0 | 0 | 0 | 0 | 0 | **0** |

### Residual risk / manual operator steps

- The 8 original findings were **dev-only**. The high-severity Playwright advisory concerns browser download integrity on install/build machines, not the deployed app. Operators installing the browser worker should run `npx playwright install chromium` (plus `--with-deps` on Linux) in their own controlled environment; browser binaries were deliberately not downloaded during this read-only review (`--ignore-scripts`).
- The toolchain fix is lockfile-based. If a maintainer regenerates the lockfile from scratch without `eslint-config-next`'s transitive resolution, re-run `npm audit` in CI to confirm the `typescript-eslint`/`minimatch` cluster stays clean.
- `tesseract.js@7.0.0` still has an unreviewed `postinstall` script (npm 11 warning). It is unrelated to the 8 advisories and was left unchanged.

## 2. Account-data cleanup audit

### User-owned files (storage, relative to `STORAGE_DIR` / Supabase bucket)

| Path pattern | Written by | DB reference | Delete on account deletion? |
| --- | --- | --- | --- |
| `users/<id>/cv/<cvId>-<filename>` | `src/app/api/profile/route.ts` POST | `uploaded_resumes.storage_path` | **Yes** — uploaded CV, raw PII |
| `users/<id>/applications/<appId>/resume/<slug>.pdf` / `.docx` | `src/lib/documents/generate.ts` via `api/jobs/[id]/tailor` | `resume_versions.file_pdf_path` / `file_docx_path`, `application_documents.path` | **Yes** — generated resume, PII |
| `users/<id>/applications/<appId>/cover-letter/<slug>.pdf` / `.docx` | same | same | **Yes** — generated cover letter, PII |

All paths live under `users/<userId>/`; cleanup is scoped by an exact `users/<id>/` prefix after POSIX normalisation, with rejection of absolute paths, backslashes, NUL bytes, `..` segments and prefix-confusion ids (e.g. `usr_1x`). Paths are de-duplicated before deletion.

### DB rows

| Table / column | Action | Reason |
| --- | --- | --- |
| `uploaded_resumes` (`storage_path`, `parsed_text`) | **Delete rows for user** | Storage metadata + parsed CV PII |
| `resume_versions` (`file_pdf_path`, `file_docx_path`, `content_json`) | **Delete rows for user** | Storage metadata + tailored-document PII |
| `application_documents` (`path`) | **Delete rows for user** (scoped through `applications.user_id`) | Storage metadata for attachments |
| `users` (`deleted_at`, `updated_at`) | **Soft-delete only** | Tombstone: `getSessionUser()` filters `deleted_at IS NULL`, invalidating all outstanding sessions; preserves email uniqueness and an audit record of the deletion |
| `audit_logs` | **Retain** | Security/legal audit trail (including the account-deletion event). PII minimisation at write time is a separate concern |
| `applications`, `application_events`, `email_messages` with `provider_id`/`sent_at` | **Retain** | Evidence of applications actually submitted and emails actually sent (legal/business record). Contains PII — needs a formal retention-policy/legal decision before any purge |
| `sessions` | **Retain until expiry** | `destroySession()` deletes the current session; other rows become unusable immediately via the `deleted_at` filter and are expired by the existing cleanup job |
| `companies`, `jobs`, `job_sources`, `company_career_pages`, `company_contacts`, `worker_status` | **Never delete** | Shared reference data; not user-owned (no `user_id`) |
| All other `user_id`-scoped tables (`candidate_profiles`, `job_matches`, `saved_jobs`, `notifications`, `interview_sessions`, `recruiter_contacts`, `user_permissions`, `email_integrations`, `career_analyses`, `company_targets`, `push_subscriptions`, `automation_*`, `scheduled_searches`, `application_questions`, `company_reviews`) | **Retained by soft delete** | Existing design; would be removed only by a future hard-delete/retention job. Flagged here as a residual PII-retention gap, not changed in this phase |

### Implementation behaviour

- File deletion failures are caught per file; failed paths are collected and reported server-side via `console.error("[account-cleanup] storage deletion failed", { userId, failedPaths })`. No raw exception message (which could contain secrets) is logged or returned.
- A partial or total storage failure does **not** abort the deletion: metadata rows are still deleted, the user is still soft-deleted, and the session is still destroyed. The client receives the same generic `{ ok: true }` response; no auth/approval rule was changed.
- Cross-user paths discovered in DB rows are skipped, so a corrupted/crafted row can never delete another user's file.

### Residual risks / manual steps

- Orphaned objects from failed storage deletes must be cleaned up by an operator using the server-side `failedPaths` log entries; there is no automatic retry queue.
- The retained tables listed above still hold PII after soft deletion. A separate legal-approved retention/hard-delete policy is required (out of scope for this phase).
- Supabase bucket deletion is a hard delete; ensure bucket lifecycle/versioning settings do not keep recoverable copies longer than the retention policy allows (operator check, no production changes made here).
