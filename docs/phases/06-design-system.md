# Phase 6 — Design system

Name: **Meridian** (JustMail's design language). Implemented as Tailwind v4 `@theme`
tokens in `packages/ui/src/tokens/theme.css`; components in `packages/ui`.

References: Stripe (data density), Linear (speed, keyboard), Vercel (restraint),
Raycast (command palette), Apple HIG (motion & hierarchy).

## 1. Principles

1. **Calm surface, dense data.** Neutral canvas; color only carries meaning
   (status, health, severity). Never decorative color noise.
2. **Speed is a feature.** Every interaction < 100ms perceived; optimistic updates;
   skeletons only on first load, never spinners inside content.
3. **Keyboard-first.** ⌘K palette reaches everything; list navigation j/k; `g d` go
   domains, `g m` mailboxes, `?` shortcut sheet.
4. **Live by default.** Numbers tick, statuses pulse subtly — realtime is felt,
   not announced.
5. **No ugly tables.** Data grids are interactive surfaces: hover states, inline
   actions, row expansion, virtualized, keyboard navigable.

## 2. Color tokens

OKLCH, defined once per theme. Semantic layer only — components never use raw palette.

```
Dark (default)                          Light
--bg          oklch(0.145 0.005 260)    oklch(0.985 0.002 260)
--bg-subtle   oklch(0.175 0.006 260)    oklch(0.965 0.003 260)
--surface     oklch(0.205 0.007 260)    oklch(1 0 0)
--surface-2   oklch(0.24  0.008 260)    oklch(0.975 0.003 260)
--border      oklch(0.28  0.01  260)    oklch(0.90  0.005 260)
--border-hover oklch(0.34 0.012 260)    oklch(0.84  0.006 260)
--text        oklch(0.93  0.005 260)    oklch(0.21  0.01  260)
--text-muted  oklch(0.68  0.008 260)    oklch(0.50  0.01  260)
--text-faint  oklch(0.50  0.008 260)    oklch(0.65  0.008 260)

--accent      oklch(0.72 0.16 255)      # electric indigo-blue — brand
--accent-fg   white
--success     oklch(0.72 0.17 155)      # green — healthy/delivered
--warn        oklch(0.78 0.15 80)       # amber — propagating/degraded
--danger      oklch(0.65 0.20 25)       # red — failed/blocked/bounced
--info        oklch(0.75 0.12 220)      # cyan — informational
```

Status mapping (used everywhere — pills, dots, charts): `active/delivered/pass → success`,
`pending/propagating/deferred → warn`, `failed/bounced/blocked → danger`,
`suspended/disabled → text-faint`.

## 3. Typography

- **UI:** Inter (variable), `font-feature-settings: 'cv11','ss01'` — 13px base in data
  areas, 14px in forms/content. Tight tracking on headings (-0.01em to -0.02em).
- **Mono:** JetBrains Mono — queue IDs, DNS records, log lines, code, addresses.
- Scale: 12 / 13 / 14 / 16 / 20 / 24 / 32. Weights: 400 / 500 / 600 only.
- Numbers in metrics: `font-variant-numeric: tabular-nums` always.

## 4. Space, radius, elevation

- Spacing: 4px grid. Page gutter 24px, card padding 20px, dense-table row height 40px.
- Radius: `--r-sm 6px` (inputs, pills), `--r-md 10px` (cards, popovers),
  `--r-lg 14px` (modals, palette). Never fully-rounded except avatars/dots.
- Elevation: borders carry hierarchy in dark mode (shadows barely read on dark);
  shadows carry it in light mode. Overlays (palette, modals, dropdowns):
  `backdrop-blur(12px)` + translucent surface (`--surface/85%`) — the *only* sanctioned
  glass. No glass on content cards.
- Gradients: one brand gradient (accent → violet) for hero moments (login, empty states,
  onboarding progress) — never behind data.

## 5. Motion (Motion library)

- Durations: 120ms (micro: hover, toggles), 200ms (panels, dropdowns), 320ms
  (modals, page transitions). Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint).
- Lists: staggered fade-up 12px, 20ms/item, cap 8 items.
- Live values: number tween on change; status dot pulse-once on transition (no infinite
  pulsing except "live" indicator).
- Charts: draw-in on mount only; realtime appends slide, never re-animate.
- `prefers-reduced-motion`: all transforms off, opacity-only.

## 6. Component states & rules

- Focus: 2px accent ring, offset 2px — visible on every interactive element, always.
- Buttons: primary (accent), secondary (surface+border), ghost, danger. Loading state
  swaps label for inline spinner, width locked (no layout shift).
- Inputs: surface bg, border → accent border on focus; error state = danger border +
  13px message below; all forms RHF + zod, validate on blur.
- Empty states: icon + one sentence + primary action. Never a bare "No data".
- Destructive flows: typed confirmation for irreversible ops (delete domain ⇒ type name).
- Toasts: bottom-right, auto-dismiss 5s, with undo where the operation supports it.
- Density: tables/logs use 13px + 40px rows; settings/forms breathe at 14px.

## 7. Layout shell

- Left sidebar 240px (collapsible to 64px icon rail): org switcher top, nav sections
  (Overview, Mail, Infrastructure, Security, Developer), health summary bottom.
- Top bar 48px: breadcrumb, global search trigger (⌘K), live status dot, theme toggle,
  user menu.
- Content max-width 1400px; dashboards fluid grid `minmax(280px, 1fr)`.
- Right inspector panel (420px slide-over) for detail views — list stays visible
  (Linear pattern) instead of navigating away.
