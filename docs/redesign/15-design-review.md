# JustMail v1.1 — Full Design Review

Scope: every admin screen + every webmail screen, reviewed against Apple HIG,
Vercel/Stripe/Linear dashboards, and Superhuman/Proton for mail. Screens were
reviewed live at justmail.example.com / webmail.example.com plus source audit.

Verdict up front: the product currently reads as a **dark admin template**.
Structure is competent (consistent primitives, TanStack Query states exist)
but nothing feels designed — it feels themed. Below, every problem class, then
per-screen scores.

---

## 1. Systemic problems (affect every screen)

### Visual
- **Broken CSS pipeline (P0)**: Tailwind v4 auto-detection never scans
  `packages/shared-ui`, so any utility used *only* inside shared-ui is missing
  from the emitted CSS. Live result: primary/secondary buttons render as
  unstyled bordered boxes with wrapped icons (see Mailboxes toolbar). This is
  the single biggest "looks broken" issue and it silently degrades every page.
- **Muddy dark palette**: canvas #08090C with 4–7% white borders everywhere
  produces a low-contrast gray soup. Nothing is clearly raised or recessed;
  cards, tables and sidebar all sit at the same perceived depth.
- **Border overload**: every card, every row, every cell is outlined. Premium
  dashboards (Stripe, Vercel) separate with whitespace + subtle background
  shifts, and reserve borders for interactive edges.
- **No visual hierarchy on data**: quota "0/2048 MB" renders as raw mono text
  with a 1px thread of a progress bar below it — the bar is invisible.
- **Icon-only accents**: brand violet appears only in the logo tile and active
  nav item; the rest of the screen is achromatic, so nothing guides the eye.

### Spacing
- Mixed rhythm: 6/10/14/18px paddings coexist with 8pt values. Table cells
  (0.6rem/0.7rem) don't align to any grid.
- Page gutters (24/32px) are fine, but content spans the full width — tables
  stretch to 1700px+ on wide screens with no max-width, producing unreadable
  row scanning distances.
- Header block (title + description + actions) has no breathing room from the
  table; actions bar visually collides with the table header on short pages.

### Typography
- Everything is 13–14px medium-gray; titles are the only anchor. No secondary
  hierarchy (section labels vs values vs metadata).
- Tabular numbers only applied in two components; quotas, counts and dates
  jitter elsewhere.
- Mono font is used for semantics it doesn't carry (addresses are mono, names
  are sans — inconsistent per column).

### Accessibility
- Muted text `--color-neutral-800` on `#0D0F13` measures ≈ 3.6:1 — fails AA
  for body text; several labels use neutral-700 (worse).
- Focus rings exist but are clipped inside overflow containers (table row
  buttons, sidebar).
- Icon-only buttons (bell, kebab, refresh) have Tooltips but several miss
  `aria-label`.
- Status is encoded by color alone in StatusBadge (ok/warn/bad) — needs icon
  or text weight redundancy for color-blind users. (Text is present, so this
  is partial, but green/amber pills at 11px are hard to distinguish.)
- No `prefers-reduced-motion` handling for animate-in entrances.

### Navigation
- 17 flat items in 4 groups is workable, but groups have equal visual weight;
  no way to collapse; no active-group affordance when scrolled.
- Breadcrumb duplicates page title on every screen ("DevLab / Mailboxes" +
  H1 "Mailboxes") — redundant 2 lines of chrome.
- Sidebar is glued edge-to-edge (no inset), which is exactly the "boxed admin
  template" look; there is no floating/elevated feel.
- No mobile navigation at all — sidebar simply overflows; the admin is
  unusable below ~900px.

### States
- Loading: skeleton rows exist but headers/actions pop in before content —
  layout shifts on every load.
- Empty: `Empty` is a dashed box with text only. No illustration, no guidance,
  frequently no primary action (Plugins/Themes pages are *only* an empty state
  — dead ends).
- Error: `ErrorState` exists on Overview only; other pages render nothing on
  error.
- Offline: nothing anywhere.
- Success: mutations invalidate queries silently; no optimistic UI, toast use
  is inconsistent (some pages toast, some don't).

### Consistency
- Two table systems: `<Table>` primitive *and* `.data` CSS class — different
  paddings, hover colors, header styles.
- Buttons: sizes drift (`xs` in tables, `md` in headers) with different
  radii; icon buttons are hand-rolled `p-2 rounded-lg hover:bg-white/[0.06]`
  in 9 places instead of a primitive.
- Dark-only hardcoded rgba(255,255,255,…) sprinkled through app code — a
  light theme cannot ship without a sweep.

---

## 2. Per-screen scores — Admin

| Screen | Score | Why |
|---|---|---|
| Login | 6/10 | Best screen (Aurora glow, centered card) but heavy black canvas, no brand color in the form, error text unstyled beyond red, no "forgot password" affordance. |
| Overview | 5/10 | Stat cards exist but are borders-on-borders; "Mail (24h)" and queue read as label/value soup with zero charting; deliverability factors are a plain list; no timeframe control; no realtime. |
| Mailboxes | 3/10 | **Buttons visibly broken** (P0 above); quota bar invisible; kebab menu unlabeled; no search/filter/sort; no pagination; address column mono while name column sans; row click does nothing (no detail view). |
| Domains | 4/10 | DNS status buried in a badge; verify flow hidden behind kebab; no copy-to-clipboard affordances for records; empty state has no "add first domain" illustration/CTA emphasis. |
| Aliases | 4/10 | Pure CRUD table; no grouping by domain; destination column truncates blindly; same broken toolbar buttons. |
| Queue | 4/10 | Four stat cards + table but no auto-refresh indicator, no per-message actions (retry/delete) surfaced, oldest-age not humanized in table. |
| Deliverability | 4/10 | Score without trend; factors without "fix it" links; no DMARC report viz (parser pending, but UI shows nothing). |
| Security | 5/10 | Denser but coherent; toggle rows lack descriptions; score duplicated from Overview with different styling. |
| Backups | 4/10 | Table of snapshots, no restore confirmation design, no schedule visualization, size not humanized consistently. |
| Audit log | 4/10 | Wall of rows; no actor avatars, no diff preview, no filters by action/date; timestamps absolute only. |
| Webhooks | 5/10 | Good modal flow; delivery log hidden; secret shown without reveal pattern; test-fire buried. |
| API keys | 5/10 | Create/reveal flow OK; no scopes UI, no last-used column emphasis, key rows identical to any table. |
| Plugins | 2/10 | Literally an empty state. Dead end, no marketplace teaser, no docs link. |
| Themes | 2/10 | Same dead end; ironic given a theme-engine package exists. |
| Team | 5/10 | Invite flow works; roles are text-only; no pending-invite distinction beyond badge; member rows lack avatars. |
| Settings | 4/10 | Sparse form in full-width cards; no sections, no danger zone styling. |
| Developers | 4/10 | Static links + curl block; CodeBlock has no copy button; no interactive API explorer teaser. |
| Notifications (bell) | 2/10 | Bell is decorative — no popover, no unread logic wired to the notifications API that exists. |
| Profile/avatar menu | 4/10 | Sign-out only; no profile, no theme switcher despite themes being a feature. |
| Org switcher | 5/10 | Works, but plain text rows; no org avatars/roles; no "create org". |

**Admin average: 4.0/10** — functional CRUD, zero delight, one P0 visual bug.

## 3. Per-screen scores — Webmail

| Screen | Score | Why |
|---|---|---|
| Login | 6/10 | Same strengths/weaknesses as admin login. |
| Mailbox picker | 5/10 | Clean cards, but a full-screen page for what should be an account switcher; no unread counts, no "last opened", no search when many mailboxes. |
| Unlock screen | 5/10 | Clear, but a second password prompt with no explanation of the security model beyond one line; no biometric/remember affordance. |
| Mail 3-pane | 5/10 | Right skeleton (rail/list/read) but: fixed 200/360px columns (not resizable), no conversation threading, no multi-select, no archive/spam folders surfaced distinctly, snooze button fake, no search box at all, no attachment previews, date column ambiguous, unread dot + bold is subtle. |
| Compose | 4/10 | Centered modal blocks the whole client (can't reference a message while composing); plain textarea (no rich text/markdown); no attachments; no draft autosave indicator; To field is raw comma-string. |
| Empty/reading states | 4/10 | "Select a message" with icon is fine; folder-empty vs no-selection not differentiated; no error state for failed message fetch. |

**Webmail average: 4.8/10** — right bones, not a product yet.

---

## 4. What must change (drives the redesign in 16-meridian.md)

1. **Fix the CSS pipeline** (`@source` the shared-ui package) — before any
   aesthetics matter.
2. **Light-first "Meridian" language**: near-white canvas, white raised
   surfaces, one violet accent, borders almost eliminated in favor of depth
   via background shifts + soft diffuse shadows. Dark stays as `.theme-dark`.
3. **Floating chrome**: inset sidebar card, glass topbar, content column with
   max-width and generous whitespace — kill the boxed template look.
4. **One table system**, one icon-button primitive, one state pattern
   (loading skeleton mirrors real layout; every list has designed empty +
   error; toasts on every mutation).
5. **AA+ text contrast** everywhere; visible focus everywhere;
   `prefers-reduced-motion` respected.
6. **Webmail becomes a client**: resizable panes, floating non-blocking
   compose, threading placeholder, search, attachment chips with previews.
7. Kill dead ends: Plugins/Themes get designed "coming soon" surfaces with
   docs links; bell gets a real notifications popover (API already exists).
