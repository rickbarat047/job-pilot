# Auto-Apply Roadmap (Browser Worker)

## Current state (as of 2026-11-05)
The browser worker (`scripts/browser-worker.mjs`) is **scaffold-level**:
- Generic heuristic form-filling (matches input name/placeholder/label to candidate fields).
- Uploads the first resume-like document to `input[type=file]`.
- Clicks the first submit/apply/send/continue button.
- Reports `applied` on a heuristic success signal, `manual_required` otherwise.
- Reports `failed` on exception (with screenshot + retry backoff).

It does **not** reliably submit to real ATS forms. Multi-step flows, account creation, CAPTCHAs, custom screening questions, and file-format constraints are not handled.

## Goal
Make auto-apply genuinely reliable for the top ATS platforms used by Indian employers and global remote roles, while staying approval-first and CV-true.

## Phases

### Phase 1 — ATS detection + adapter routing (1 week)
- Detect ATS from `applicationUrl` hostname/path.
- Route to a dedicated adapter; fall back to generic heuristic.
- Adapters: Greenhouse, Lever, Ashby, SmartRecruiters, Workday, generic.
- Status: **scaffolded** (detection + routing added; adapters best-effort).

### Phase 2 — Greenhouse + Lever + Ashby adapters (2 weeks)
- Greenhouse: multi-step form, EEO questions, resume upload, submit, success text.
- Lever: single-page form, custom questions, resume, submit.
- Ashby: multi-step, screening questions, resume, submit.
- Add per-adapter selectors, retry on transient failures, screenshot on every step.
- Validate against 20+ real job postings per ATS.

### Phase 3 — Workday + SmartRecruiters (2 weeks)
- Workday: account creation/login flow, multi-step wizard, resume parse, submit.
- SmartRecruiters: apply form, screening, submit.

### Phase 4 — Reliability & safety (1 week)
- CAPTCHA detection → report `manual_required` (never attempt to bypass).
- Success detection per ATS (URL change, success text, confirmation email).
- Idempotency: don't double-submit if a partial submit happened.
- Per-user rate limits (max N applications/day).
- Audit log of every field filled + screenshot.

### Phase 5 — Polish (1 week)
- Per-ATS question answering from the user's saved answers (already in payload).
- Resume format conversion (PDF/DOCX) per ATS requirements.
- Notifications on success/failure with screenshot link.

## Effort estimate
- Phase 1: 1 week (scaffolded)
- Phase 2: 2 weeks
- Phase 3: 2 weeks
- Phase 4: 1 week
- Phase 5: 1 week
- **Total: ~7 weeks** for reliable auto-apply across top 5 ATS.

## What's already in place
- Worker contract (claim / payload / result / documents) — solid.
- Heartbeat + stale-lock recovery.
- Retry backoff (exponential, capped at 30 min).
- Screenshot capture + result reporting.
- `manual_required` status for ambiguous outcomes (honest, no false "applied").
- GitHub Actions free hosting (ONE_SHOT, drains 3/run).

## Risks
- ATS DOM changes frequently → selectors break → need monitoring + alerts.
- CAPTCHAs / bot protection → may block automation entirely on some boards.
- Terms of service of job boards may prohibit automation.
- Account-creation flows (Workday) require email verification → can't be fully autonomous.

## Recommendation
Launch with the **copilot + approval-first** positioning (current). Build Phase 2 (Greenhouse + Lever + Ashby) first since those cover ~60% of Indian/global remote postings, then iterate based on real user feedback. Don't promise "fully autonomous apply" until Phase 4 ships.