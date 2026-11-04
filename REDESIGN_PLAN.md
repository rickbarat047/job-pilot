# JobPilot AI — Redesign Plan

Direction: premium cool-neutral SaaS (Linear / Stripe / Vercel quality bar, not a copy) — ivory background, charcoal text, rich emerald accent. Serif display kept for editorial headlines to keep a distinctive identity; everything else Inter.

## Phases

### Phase 1 — Audit ✅
See `DESIGN_AUDIT.md`. Docs: DESIGN_AUDIT.md / REDESIGN_PLAN.md / DESIGN_SYSTEM.md.

### Phase 2 — Design system tokens ✅
- Rewrite `:root` / `.dark` tokens in `globals.css`: ivory `#F8F9FB`, charcoal `#171B25`, muted `#747D8C`, emerald `#087F68`, accent surface `#E8F5F0`. Dark mode = deep navy family `#0B0E14` with emerald `#2BC5A0`.
- Update viewport `themeColor`, checkbox stroke selection colors, body decorative gradient (subtle), radii and shadow language.
- Docs recorded in `DESIGN_SYSTEM.md`.

### Phase 3 — Landing page ✅
- Rewrite `src/app/page.tsx`: sticky marketing nav (client component for scroll treatment), editorial hero ("Your next opportunity. Already in motion.") with clearly-labeled illustrative product preview, trust strip, 4-step connected timeline, varied capabilities layout, product showcase panels, dark-navy privacy section, final CTA + complete footer.
- New components: `marketing-nav.tsx`, `reveal.tsx` (scroll reveal, reduced-motion safe).
- New pages: `/privacy`, `/terms` (honest, minimal, no overclaiming).

### Phase 4 — Auth screens ✅
- Split-screen composition (brand panel on desktop, single column on mobile) for `/login` and `/register`.
- Password visibility toggles, inline validation, live password-requirements checklist on register, proper loading/error states. Authentication logic untouched.

### Phase 5 — Application shell ✅
- Sidebar: grouped navigation (Overview / Workflow / Workspace), refined active states, polished user footer.
- Topbar: refined spacing/surfaces, user identity affordance, focus-visible ring discipline.
- Page-header pattern applied consistently to primary authenticated pages.

### Phase 6 — QA & deploy ✅
typecheck → vitest → build → `vercel --prod --yes` → verify Ready + alias → mobile overflow smoke check.

## Phase 7 — Full visual + functional QA pass ✅

### What was inspected
All 17 routes rendered on real Chrome at 320 / 360 / 375 / 390 / 414 px (mobile) and 1024 / 1440 px (desktop), authenticated (demo account) and unauthenticated: landing, login, register, privacy, terms, onboarding, dashboard, jobs, job detail, applications, application detail, profile, CV builder, automation, companies, interviews, settings. Checks per route: console errors, failed network requests, horizontal overflow, tap-target sizes, empty states (via a freshly registered throwaway account), keyboard focus indicators (Tab sequence), dark mode, and full-page screenshots reviewed visually on both breakpoints.

### Problems found
1. **CRITICAL — landing page mostly invisible in production**: framer-motion `whileInView` never fired its IntersectionObserver; every `Reveal`-wrapped block stayed at `opacity: 0` (hero, trust, timeline, capabilities, CTA all blank; only the nav rendered).
2. **Tap targets too small**: Companies "Careers/Website" links (16px), job card title links (22px), application card titles (24px), dashboard "View all" (20px), CV-builder back link, auth "Create one / Sign in" links, "← Back to home" links, landing inline links.
3. **favicon.ico 404** on every load.
4. **Meaningless trend badges**: zero-value stat cards showed "0 ↓ Down" (Applications/Interviews/Jobs discovered on a fresh account) and "0 Up" (Strong matches), plus a "Response rate: 0%" secondary metric on two cards that had no meaningful data.
5. **Automation page said "Automation center" three times** (pill + h1 + repeated section).
6. **"View all" wrapped to two lines** ("View / all") in the dashboard Top matches header.

### Fixed
1. Rewrote `Reveal` as a dependency-free IntersectionObserver + CSS transitions (`globals.css [data-reveal]` states). Hidden initial state applies **only** under `@media (scripting: enabled)`, so content is always visible if JS fails; guarded by `prefers-reduced-motion` (always visible) and a 2.5s reveal fallback timer. Verified live: all sections reveal at rest and on scroll; landing text 3,712 chars rendered on mobile.
2. Padded all small offenders to ≥36px effective touch targets (inline padding/border-radius chips; Companies "Careers/Website" restyled as 32px secondary chips).
3. Added `src/app/icon.svg` (emerald rounded square + white serif "J") — Next auto-wires the favicon link.
4. Trend badge renders only when `value > 0`; "Strong matches" trend no longer hardcoded true; Interviews/Jobs-discovered secondary metrics fall back to meaningful hint copy on empty data.
5. Pill renamed to "Automated workflows".
6. `whitespace-nowrap` + `shrink-0` on the View all link.

### Verified after fixes (real runs, latest deploy `jobpilot-ed7j8sw1f-rick-e181` → alias Ready)
- 44/44 route × width overflow checks pass (320–1440px), zero empty-ish pages, zero console errors in sweep, no 404s including favicon.
- Empty states render honestly on all routes for a brand-new real account (dashboard/jobs/applications/interviews all show guidance + actions, not blanks).
- Keyboard focus: Tab sequence shows visible focus ring (box-shadow ring or UA outline) on every focusable sample; account menu closes on Escape.
- Job expandable card (Direction 1) opens/closes on mobile; mobile "More" bottom sheet; topbar user menu functional.
- Dark mode renders correctly on dashboard + jobs (navy tokens, emerald accents).
- Job detail, application detail, profile, settings, automation, interviews, companies all render real backend data with consistent styling; no mock data introduced.
- typecheck clean, 32/32 tests pass, production build compiles.

### Known acceptable observations (not defects)
- `net::ERR_ABORTED` on `?_rsc=` prefetch requests = normal Next.js client-router prefetch cancellation noise.
- Applications kanban has generous whitespace when the user has few applications (real data volume, not a layout bug).
- Automation hero decorative blur blobs intentionally bleed past their card edge; clipped by `overflow-hidden` on the parent section.
