# Architecture

## Layers

1. **Presentation**: Next.js App Router pages under `src/app/(app)` and `src/app/(auth)`.
2. **API**: Route handlers under `src/app/api`. All mutation routes check same-origin and session auth.
3. **Domain**: `src/lib` contains matching, normalization, permissions, automation, AI and document logic.
4. **Data**: SQLite via `node:sqlite` (`src/lib/db.ts`) for local development. Production schema and RLS live in `supabase/migrations`.
5. **Automation**: DB-backed task queue in `src/lib/automation.ts`, scheduler in `scripts/scheduler.mjs`, optional Playwright worker in `worker/`.

## Key decisions

- Local-first storage avoids native database dependencies and keeps the MVP runnable without external credentials.
- All user-owned queries are scoped by `user_id`.
- AI is optional and every AI feature has a deterministic fallback.
- Source adapters are modular and report unavailability instead of faking results.
- Application submission is permission-controlled and never claims success without verification or user confirmation.
- Job descriptions and external pages are treated as untrusted input and are sanitized before matching or AI use.

## Data flow

1. CV upload -> `src/lib/documents/parse.ts` -> `candidate_profiles` and `candidate_skills`.
2. Discovery -> source adapters -> `upsertJob` -> `job_matches` via `matchJob`.
3. Tailoring -> `tailorApplication` -> `resume_versions`, `application_documents`, `application_questions`, `email_messages`.
4. Submission -> permission checks -> external link, email, or browser task.
