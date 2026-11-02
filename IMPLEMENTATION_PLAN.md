# Implementation Plan

## Completed

- Authentication, sessions, password hashing.
- CV upload and deterministic extraction.
- Candidate profile and preferences.
- Permission model and autonomy levels.
- Database schema and bootstrap data.
- Modular job sources: Greenhouse, Lever, Ashby, SmartRecruiters, remote boards, manual import, plus documented unavailable Indian portals.
- Job normalization, deduplication and matching.
- Career analysis.
- Tailored resume, cover letter, recruiter email and application questions.
- PDF and DOCX generation.
- Application lifecycle, approval queue, submission flows, manual confirmation.
- Notifications, automation tasks, scheduler, worker heartbeat.
- Company explorer and career-page checks.
- Interview prep and follow-up email drafts.
- Settings, data export and account deletion.
- Dashboard and responsive UI pages.
- Tests and Docker support.

## Remaining production work

- Supabase repository adapter and RLS deployment.
- Full Playwright form automation with site-specific adapters.
- OCR for scanned PDFs.
- Email parsing for reply tracking.
- Advanced analytics and model evaluation.
