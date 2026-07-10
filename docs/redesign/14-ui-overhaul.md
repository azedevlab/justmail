# 14 — UI overhaul (v1.1 "Aurora")

Full visual redesign of the admin console and webmail. Goal: the product must
read as a premium, keyboard-first control plane in the class of Linear,
Vercel, and Stripe — not a generic dark dashboard.

## Diagnosis of the v1.0 UI

1. **No surface layering.** Everything sits on near-identical dark greys with
   1px borders; nothing recedes, nothing lifts. Result: flat and cheap.
2. **Sidebar overload.** 16 ungrouped items with mixed icon metaphors; a
   native `<select>` for the org switcher breaks the visual language.
3. **No top chrome.** A single floating bell button; no breadcrumbs, no
   persistent search affordance, no user menu in the content area.
4. **Buttons and inputs are flat fills** with `hover:brightness` — no depth,
   no inner highlight, no pressed state.
5. **Typography has no voice.** Uniform 13–14px, default letter-spacing,
   weak heading hierarchy.
6. **Login screens are placeholders** — plain vertical gradient + bare card.
7. **Webmail wears admin chrome.** A mail client needs its own layout: folder
   rail, dense message list with read/unread rhythm, reading pane.

## Design language: "Aurora"

Dark-first. Reference points: Linear (surface layering, keyboard-first,
compact type), Vercel (hairline borders, geist-style neutrals), Stripe
(gradient accent discipline), Superhuman (mail density and rhythm).

### Foundations

- **Layered surfaces** (new tokens):
  - `--color-bg` `#08090C` — app canvas
  - `--color-surface-1` `#0D0F13` — sidebar, cards
  - `--color-surface-2` `#13161C` — inputs, hover, nested panels
  - `--color-surface-3` `#1A1E26` — popovers, modals
  - Hairlines: `rgba(255,255,255,0.07)` default, `0.13` strong.
- **Accent**: keep the violet ramp; primary actions use a
  `brand-500 → brand-400` vertical gradient with
  `inset 0 1px 0 rgba(255,255,255,0.18)` top highlight and a soft
  brand-tinted shadow. Accent is *rationed*: one primary action per view.
- **Aurora backdrop** for auth/empty hero surfaces: two radial brand glows
  (violet + indigo) at low opacity over a dot grid, masked to fade.
- **Typography**: Inter, `-0.011em` body tracking; headings 600 weight with
  `-0.02em`; 13px UI base; tabular-nums for counts; uppercase 11px/`0.08em`
  section labels.
- **Depth**: every raised surface = hairline border + `inset 0 1px 0
  rgba(255,255,255,0.04)` + elevation shadow. Focus = 2px brand ring at 55%.
- **Motion**: 120ms `cubic-bezier(0.16,1,0.3,1)`; hover lifts limited to
  popovers/cards, never nav items.

### Component work (`packages/shared-ui`)

| Component | Change |
|---|---|
| Button | gradient primary w/ inner highlight + pressed translate; surface-2 secondary; refined ghost/danger |
| Card | surface-1 + hairline + inner top highlight; optional `CardHeader` divider |
| Input/Textarea | surface-2, inset shadow, brand focus ring, subtle placeholder |
| Table | 12px uppercase sticky header, 44px rows, row hover surface-2, first-col emphasis |
| Badge/StatusBadge | tinted background + matching hairline (Linear-style chips) |
| Modal | surface-3, backdrop blur(8px) + 60% scrim, scale-in |
| CommandPalette | surface-3, blurred scrim, section labels, footer key hints |
| Tabs | underline-style with animated indicator |
| Toast | surface-3, tone hairline, icon, bottom-right |
| Tooltip | surface-3 mini, 11px |
| **New** `Kbd` | bordered keycap chip (replaces ad-hoc shortcut spans) |
| **New** `Topbar` | breadcrumbs + search pill (⌘K) + slot for actions |
| **New** `Stat` | overview metric card: label, value, delta, tone |
| **New** `AuroraBackdrop` | shared auth/hero background |

### Admin console

- **Sidebar (240px, surface-1)**: logo row → org switcher as a proper
  DropdownMenu (avatar, name, role) → grouped nav:
  - *(root)* Overview
  - **Mail** — Domains, Mailboxes, Aliases, Queue, Deliverability
  - **Protect** — Security, Backups, Audit log
  - **Extend** — Webhooks, API keys, Plugins, Themes, Developers
  - **Organization** — Team, Settings
  Items: 32px, icon + label, active = brand-tinted surface + bright text
  (no border box). Group labels: 11px uppercase muted.
- **Topbar (48px)**: breadcrumb (org / section), center-right search pill
  ("Search… ⌘K"), bell, avatar menu (profile, sign out).
- **Overview**: `Stat` row (domains, mailboxes, queue depth, delivery rate)
  + recent activity + quick actions.
- **All pages** keep `PageShell` so restyled primitives propagate; sweep for
  raw hex/off-token styles.

### Webmail

- **Login/picker**: AuroraBackdrop + glass card, product wordmark.
- **Mail shell**: 3 panes — folder rail (200px, surface-1, counts), message
  list (360px: bold-sender unread rows, dim read rows, time right-aligned,
  star on hover), reading pane (message header card, actions row, body).
- Compose stays modal but styled as surface-3 sheet w/ recipient chips row.
- Keyboard hints in footer strip (`c` compose, `s` star, `#` delete).

### Explicitly out of scope

Light theme polish beyond token parity, marketing/landing app, mobile
layouts (responsive down to 1024px only), new features.

## Execution order

1. `design-tokens`: surface ramp, refreshed neutrals, shadows w/ highlight,
   tracking values; update `emit-css.mjs` (adds `--color-surface-{1,2,3}`,
   keeps `--color-surface`/`-2` aliases so nothing breaks mid-migration).
2. `shared-ui`: restyle all primitives + add Kbd, Topbar, Stat,
   AuroraBackdrop.
3. Admin: globals.css (nav, table, scrollbars), org layout (grouped sidebar +
   topbar), login, overview; sweep remaining pages.
4. Webmail: globals, login/picker, mail shell + list + reading pane, compose.
5. `pnpm -r typecheck && pnpm -r build`, deploy, verify in browser.
