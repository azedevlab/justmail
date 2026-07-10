# Meridian — JustMail design language v2 (light-first)

North star: *"If Apple created Gmail for developers."* Every decision below is
traceable to Apple HIG, Vercel, Stripe, Linear, Superhuman, Raycast.

Companion review: `15-design-review.md`. This document is the buildable spec.

---

## 1. Design system

### Canvas & depth (no boxes)
- Canvas `#F7F8FA`. Raised surfaces are **white + soft diffuse shadow**, not
  border-outlined boxes. Recessed wells (inputs, code, quota tracks) are
  `#F2F3F6` with a 4% inset shadow.
- Borders only where an edge is interactive or structural: `rgba(16,24,40,0.09)`
  hairline; `0.16` for controls. Never border + shadow + background together.
- Dark theme survives behind `.theme-dark` (previous Aurora values); every
  component styles through theme vars only — zero hardcoded rgba in app code.
- Glass: topbar and floating panels use `backdrop-blur(12px)` over
  `rgba(255,255,255,0.72)` (dark: `rgba(13,15,19,0.72)`).

### Type
- Inter. Body 14/1.5 `-0.011em`. Page titles 20/600 `-0.02em` (not 24 — the
  chrome shrinks, content leads). Section labels 11/500 uppercase `+0.08em`
  in `neutral-600`. Numbers always `tabular-nums`.
- Data tables: 13px; addresses/ids in mono 12px only when copyable.

### Spacing — strict 8pt
- Component paddings from {4,8,12,16,24,32}. Page gutter 32. Card padding 20→
  rounded to 24 exceptionally for hero cards. Table cells 12×16.
- Content max-width 1200px, centered; full-bleed only for the webmail grid.

### Color
- One accent: violet ramp (kept). Accent text on light = brand-600.
- Semantic (light): ok #15803D, warn #B45309, bad #DC2626, info #1D4ED8;
  12% tinted backgrounds for badges.
- Charts/quota: brand for used, `#E3E7EC` track.

### Motion
- 120ms `cubic-bezier(0.16,1,0.3,1)` for hover/press; 200ms for
  panels/modals (fade + 2% scale). Entrances: fade+4px rise, stagger 30ms.
- `@media (prefers-reduced-motion: reduce)`: all transitions/animations off.

### Core components (shared-ui)
| Component | Meridian treatment |
|---|---|
| Button/primary | Violet gradient (400→600), white inset highlight, soft drop; press = translate-y 1px |
| Button/secondary | White, hairline border, shadow-1; hover → surface-2 |
| IconButton (new) | 32px square, radius 8, ghost → hover overlay; `aria-label` required prop |
| Input | White field, inset 4% shadow, focus = brand ring 3px @18% |
| Card | White, radius 12, shadow-1, **no border** (border-strong only in dark) |
| Table | Single system; sticky header 11px caps; row hover overlay-faint; no vertical rules |
| Progress (new) | 6px rounded track surface-2, brand fill, animated width |
| Badge | Tinted bg + darker text (AA); dot variant for tables |
| Modal | Radix; white sheet radius 16 shadow-4; overlay 45% slate + blur 6 |
| Toast | White, left accent bar 3px, shadow-3, bottom-right |
| CommandPalette | Raycast-style: glass overlay, 640px sheet, footer kbd hints |
| Empty (new art) | 40px duotone icon medallion, title, one-line help, primary CTA |
| ErrorState | Same skeleton as Empty + retry secondary button |
| Skeleton | surface-2 shimmer, mirrors real layout (list rows, stat cards) |
| Wordmark | Kept; glyph unchanged, label color follows theme |

### Accessibility AA+
- Muted text floor = neutral-800 (#4E5867 on white = 7.4:1). neutral-600/700
  reserved for ≥600 weight labels.
- Focus visible on every interactive element (2px brand outline, offset 2).
- All icon-only controls take `aria-label`; StatusBadge adds tone dot + text.
- Full keyboard reach: sidebar (arrow keys), tables (row focus), ⌘K anywhere.

---

## 2. App shells

### Admin shell — floating chrome
- **Desktop (≥1024)**: canvas gray; sidebar is a **floating card** (248px,
  inset 12px, radius 16, shadow-2, full-height) — Linear-style. Content column
  right of it, max-w 1200 centered, 32px gutters. Topbar inside content: glass,
  sticky, 52px — breadcrumb (org / page), ⌘K search pill, bell popover, avatar
  menu.
- **Tablet (768–1023)**: sidebar collapses to 64px icon rail (tooltips);
  topbar unchanged.
- **Mobile (<768)**: rail hidden; hamburger in topbar opens sidebar as a
  sheet (overlay + slide-in 240px); content single column, 16px gutters,
  tables become stacked cards (address + status + kebab).
- Keyboard: ⌘K palette (all nav + actions), `g` then key nav chords later.

### Webmail shell
- Full-bleed 3-pane grid: folder rail 216px / list 300–460px (**resizable**,
  drag handle, persisted) / reading pane. Header 52px glass.
- **Tablet**: rail collapses to icons; list+read remain.
- **Mobile**: single pane stack — folders sheet, list screen, message screen
  (back chevron); compose full-screen sheet.
- **Compose = floating panel** (Superhuman/Gmail): bottom-right, 560×~640,
  radius 16, shadow-5, draggable header, minimize to pill, does not block the
  client. Fields: To (chips), Subject, body textarea (markdown accepted,
  rendered on send later — placeholder for rich composer), attach button (UI),
  ⌘↵ send.

---

## 3. Screen specs (compact)

Standard states (apply to every screen unless noted):
- **Loading**: skeleton mirroring final layout, no chrome shift.
- **Empty**: Empty component w/ CTA.
- **Error**: ErrorState w/ retry.
- **Offline**: global toast "Connection lost — retrying" via query error dedupe.
- **Success**: toast on every mutation; optimistic where trivial (toggles).

| Screen | Purpose | Desktop layout | Key interactions / shortcuts |
|---|---|---|---|
| Login | Authenticate | Centered 384px card on Aurora-light canvas | Enter submits; error inline under fields |
| Overview | Health at a glance | 4 stat cards → 2 activity cards (24h mail, queue) → deliverability factors with fix-links | Cards link to their screens |
| Mailboxes | Manage users | Toolbar (search filter + Export + Add) above table: address, name, quota **Progress bar**, status dot-badge, protocols, kebab | `/` focuses search; row kebab: suspend/reset/delete |
| Domains | Domain lifecycle | Table + status; DNS records drawer w/ copy buttons | Verify = primary row action |
| Aliases | Routing | Grouped-by-domain table | Inline create row |
| Queue | Postfix state | 4 stats + auto-refreshing table (10s, paused on hover) | Retry/delete per row |
| Deliverability | Sender reputation | Score hero + factor checklist with remediation links | — |
| Security | Hardening | Sectioned toggle cards w/ descriptions | Optimistic toggles |
| Backups | Snapshots | Schedule card + snapshot table | Restore = confirm modal (danger) |
| Audit | Forensics | Filter bar (actor/action/date) + timeline rows, relative time w/ title attr | — |
| Webhooks | Integrations | Endpoint cards w/ delivery sparkline + reveal-secret pattern | Test-fire button |
| API keys | Programmatic access | Table + create modal w/ one-time reveal | Copy button |
| Plugins/Themes | Future | Designed "coming soon": medallion, roadmap copy, docs link | Not a dead end |
| Team | Membership | Member rows w/ avatar initials, role select, pending section | Invite modal |
| Settings | Org config | 640px form column, sections, danger zone (red hairline card) | — |
| Developers | API docs | Quickstart card w/ copyable curl, links grid | Copy button |
| Notifications | Awareness | Bell popover: unread list from notifications API, mark-read | — |
| Webmail list | Triage | Rows: unread dot, sender 600, subject, snippet muted, time right; hover reveals quick actions (archive/star) | j/k move, o open, e archive, s star, c compose, / search, r reply |
| Webmail read | Consume | max-w 720 article; avatar header; action row; sanitized iframe; attachment chips | u back to list |
| Compose | Send | Floating panel spec above | ⌘↵ send, Esc minimize |

Animation notes: list rows fade-rise on first load (stagger 20ms, capped 12);
pane transitions on mobile slide 240ms; compose panel springs up 200ms.

---

## 4. Build order

1. Tokens: light default + per-theme vars (`--hover-overlay`, `--overlay`,
   `--scrollbar-thumb`, `--color-field`, `--color-accent`, `--dot-grid`,
   light shadows/semantics). `.theme-dark` keeps Aurora.
2. **Fix Tailwind `@source`** for shared-ui in both apps' globals.
3. shared-ui: restyle all primitives per table; add IconButton, Progress,
   redesigned Empty/ErrorState; reduced-motion CSS.
4. Admin shell (floating sidebar, glass topbar, mobile sheet) + Overview,
   Mailboxes, Domains upgraded explicitly; remaining pages inherit and get
   state/contrast sweeps.
5. Webmail: resizable panes, floating compose, list/read polish, search box.
6. Deploy + live verification + commit.
