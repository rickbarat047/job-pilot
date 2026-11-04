# JobPilot AI — Design Audit

## Stack
- Next.js 16 (App Router), React 19, Tailwind CSS v4 (token-driven via `@theme inline` in `src/app/globals.css`), TypeScript.
- Components: cva-based primitives in `src/components/ui/*` (button, card, badge, form-controls, job-card, data-card, modal, drawer, tabs, table, status-badge, tooltip, timeline, dropdown, filter-panel, match-score…).
- Auth: cookie session (`/api/auth/*`), `getSessionUser()` in `(app)/layout.tsx` with redirect. Dashboard is a client component fetching `/api/auth/me` + `/api/dashboard`.
- Fonts: Inter (variable) + serif display stack (`.font-display`). Theme via next-themes (light/dark). Sonner toasts. framer-motion available.

## State of the product (pre-redesign)
Auth, API routes, DB repositories, job discovery, application tracking, CV builder, automation and interview pages all function and were recently perf-optimized (cold dashboard 27s → ~2s). Data layers must not be touched.

## Findings
1. **Palette identity mismatch** — `:root` uses warm cream `#f4f1ea`, forest green `#1f6f4a`, lime `#d8f34a`. Feels organic/earthy, not premium SaaS. Tokens are centralized, so a palette shift propagates app-wide.
2. **Landing page is generic** — one hero + icon-card grids; no editorial composition, no product preview, no trust/showcase/privacy sections, no working privacy/terms links.
3. **Broken links**: `/privacy` and `/terms` do not exist (404) but are linked from the landing footer.
4. **Auth screens are plain centered forms** — no brand presence, no password visibility toggle, no inline validation, no live password requirements.
5. **Navigation lacks hierarchy** — sidebar flat list of 9 items, no grouping labels; topbar has no user identity affordance.
6. **`--accent` (lime) doubles as "highlight" token** — used in selection, badges and tinted gradients; needs a calmer value.
7. Legacy decorative gradients (`from-primary/[0.09] … to-accent/25`) will read differently under the new palette; keep if subtle after swap.

## Constraints carried forward
- No mock data anywhere except clearly-labeled illustrative marketing previews.
- Performance budgets remain (login <100ms feedback, route <200ms, shell <500ms, content <1.5s).
- Mobile-first: no horizontal overflow, `touch-action: manipulation`, 16px inputs, ViewportGuard stays.
- Deployments happen from the working tree via `vercel --prod --yes`.
