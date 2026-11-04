# JobPilot AI — Design System

## Brand identity
Premium career-tech SaaS. Calm, editorial, trustworthy. Linear/Stripe refinement as quality reference — not template.

## Color tokens (light)
| Token | Value | Use |
|---|---|---|
| `--background` | `#F8F9FB` | Page background (cool ivory) |
| `--foreground` | `#171B25` | Primary text (deep charcoal) |
| `--card` | `#FFFFFF` | Cards, sheets |
| `--muted` | `#EEF1F5` | Subtle surfaces, hover fills |
| `--muted-foreground` | `#747D8C` | Secondary text (slate) |
| `--primary` | `#087F68` | Rich emerald — actions, active nav, brand |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--accent` | `#E8F5F0` | Subtle emerald tint surface |
| `--accent-foreground` | `#0B4A3E` | Text on accent surface |
| `--secondary` | `#EEF1F5` | Neutral secondary surface |
| `--destructive` | `#B42318` | Errors |
| `--border` | `#E5E8EE` | Hairline borders |
| `--input` | `#D9DDE5` | Input borders |
| `--ring` | `#087F68` | Focus ring |

## Color tokens (dark)
Deep navy family, not pure black: `--background #0B0E14`, `--card #11151C`, `--border #232936`, `--foreground #E7EAF0`, `--muted-foreground #8B93A3`, `--primary #2BC5A0` (on-dark emerald), `--accent #12241F` / `--accent-foreground #7DDFC4`.

## Typography
- **Inter** (variable) — all UI text, tight tracking on headings.
- **Serif display** (`.font-display`, Iowan/Palatino stack) — editorial headlines only (hero, section titles, big numerals). Negative tracking `-0.02em`–`-0.04em`.
- Scale: hero `text-4xl→6xl`, section `text-3xl→4xl`, page title `text-2xl→3xl`, card title `text-base/lg`, body `text-sm`, metadata `text-xs`.

## Shape & elevation
- Radii: inputs/buttons `rounded-xl` (0.75rem), cards `rounded-2xl`, feature panels `rounded-3xl` — never full-rounded rectangles of content.
- Shadows: near-invisible contact shadow + large soft ambient (`0 1px 2px …, 0 18px 40px -32px …`). Hover lifts ambient only.
- Borders over shadows where possible; one gradient surface max per screen.

## Components
- Button: cva variants default/secondary/outline/ghost/destructive/accent × default/sm/lg/icon. Disabled = muted, not faded primary. `active:scale-[0.98]`.
- Inputs: `h-11 sm:h-10`, 16px font on mobile (iOS zoom rule), ring focus.
- Badge: default/secondary/outline/success/warning/destructive/accent.
- Status colors share semantic mapping: success=emerald, warning=amber, destructive=red.
- Skeletons, empty states, toasts (Sonner) already standardized.

## Motion
- 140–220ms transitions, `cubic-bezier(0.16, 1, 0.3, 1)` for sheets/drawers.
- Scroll reveals via `Reveal` (framer-motion `whileInView`), respects `prefers-reduced-motion` (CSS kill-switch).
- No parallax, no floating blobs, no cursor effects.

## Rules
1. Max one decorative gradient per view.
2. Group navigation; never exceed ~9 top-level items.
3. All marketing demo panels are labeled "Illustrative preview" — never presented as real user data.
4. `overflow-x: clip` guardians stay; no horizontal scroll at 320px.
5. Focus-visible ring on every interactive element; ≥44px touch targets.
