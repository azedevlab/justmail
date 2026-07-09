# UI / UX specification

## Design principles

1. **Fast beats fancy.** No animation over 200 ms; no full-page skeleton over 400 ms.
2. **Keyboard first.** Every action reachable without touching the mouse.
3. **Read state before write state.** Never block the read view for a mutation.
4. **Predictable is beautiful.** No jumping layouts; content-shifted rows earn a call-out.
5. **Dense but breathable.** Table density ≥ Linear; whitespace ≥ Notion.
6. **Explicit ownership.** Every visible entity has a "manage" affordance one hop away.
7. **No dead ends.** Every empty state offers the next thing to do.

## Design system (`packages/design-tokens` + `packages/shared-ui`)

### Tokens (Style Dictionary)

- Color: neutral 12-step ramp + brand 12-step ramp + semantic (ok/warn/bad/info),
  emitted per theme (light / dark / system) and per contrast (default / high).
- Typography: `--font-sans` (Inter var), `--font-mono` (JetBrains Mono),
  `--font-serif` (Source Serif Pro for email quotes).
  Type scale: 12, 13, 14, 16, 18, 20, 24, 30, 36, 48; line-height per size.
- Spacing: 4 px baseline grid, tokens `space-0 … space-32`.
- Radius: 4, 6, 8, 12, 16, 999.
- Elevation: 5 shadow tokens tuned for dark and light.
- Motion: cubic-bezier(0.16, 1, 0.3, 1) 120 ms default, 200 ms max.
- Iconography: `lucide-react` normalised at 20 px stroke 1.5.

### Primitives (Radix + Tailwind)

Every primitive ships with variants, sizes, keyboard behaviour, and
accessibility metadata. Storybook stories per primitive.

| Component | Radix base | Notes |
|---|---|---|
| Button | native | Solid / secondary / ghost / destructive; XS/S/M/L; loading state |
| Input | native | text, email, password, number, tag input |
| Textarea | autosize | markdown / plaintext toggle |
| Select | Radix Select | keyboard search, virtualised list |
| Combobox | Ariakit | async source, chips |
| Checkbox / Switch | Radix | tri-state for lists |
| Radio | Radix | groups with keyboard nav |
| Dialog | Radix Dialog | focus trap, escape, backdrop click |
| Sheet | Radix Dialog (side) | mobile-first modals |
| Toast | Sonner-shaped | queue, dismiss, undo action |
| Tooltip | Radix | 300 ms delay |
| Popover | Radix | responsive placement |
| Menu / DropdownMenu | Radix | keyboard first, submenu |
| ContextMenu | Radix | right-click and long-press |
| CommandPalette | cmdk | fuzzy match, sections, hotkeys |
| Table | TanStack Table | virtualised, resizable, sortable, filterable, sticky header |
| DataGrid | shared-ui/DataGrid | inline edit, bulk select, keyboard nav |
| Tabs | Radix | keyboard, deep-linkable |
| Toolbar | Radix Toolbar | context-sensitive |
| Breadcrumbs | shared-ui | truncation, dropdown for overflow |
| Pagination | shared-ui | cursor + page number modes |
| DatePicker | react-day-picker | keyboard, ranges, presets |
| DateTimePicker | shared-ui | with tz picker |
| ColorPicker | shared-ui | tokens + hex + a11y contrast check |
| Charts | Recharts + custom | line, bar, sparkline, heatmap; responsive |
| Skeleton | shared-ui | shape-per-content, no more than 400 ms |
| Empty | shared-ui | title + description + action |
| Error | shared-ui | error boundary UI with report button |
| Offline | shared-ui | sticky banner with retry |
| Avatar | shared-ui | gravatar / initials / uploaded |
| Badge / Tag | shared-ui | with icon + variant |
| StatusDot | shared-ui | ok/warn/bad/info + pulse |
| KeyHint | shared-ui | renders `⌘ K` glyphs consistently |
| Split panes | react-resizable-panels | persisted sizes per user |
| Command bar | shared-ui | above-content action bar for tables |

### Global surfaces

- **Command palette** (`⌘K` / `Ctrl+K`) everywhere. Sources: navigation,
  actions, entities (mailboxes, domains, messages), recent, help.
- **Search everywhere** (`/`) opens a global search modal scoped to the
  current app.
- **Notifications** (`n`) — inbox for org events + Web Push subscription.
- **Undo** — every destructive mutation ships with a toast that says
  "Undo" for 8 s; the API supports undo tokens per mutation type.
- **Bulk actions** — every table supports shift-click ranges, Ctrl-click
  multi-select, and a persistent selection bar with actions.
- **Breadcrumbs** — always show; keyboard-navigable.

### Layouts

- Ultra-wide (`≥ 1600 px`): three-pane webmail, four-column tables.
- Desktop (`1024–1599`): default layouts.
- Tablet (`640–1023`): two-pane webmail, hide secondary metadata columns.
- Mobile (`< 640`): single pane, bottom nav, gesture-driven message actions.
- All layouts respect `prefers-reduced-motion` and `prefers-color-scheme`.

### Accessibility

- WCAG 2.2 AA baseline; screens with entered data aim for AAA.
- Focus visible always; focus ring uses `--color-brand-500` + 2 px inset.
- Every interactive element has an accessible name.
- ARIA roles set by primitives, not hand-authored per screen.
- Live regions for toasts, notifications, and inline validation.
- Keyboard shortcut sheet (`?`) documents every binding.

### Animation catalog

- Entrance: fade + 4 px slide up, 160 ms.
- Exit: fade, 120 ms.
- Micro (button press, checkbox tick): 80 ms.
- Toast: slide-in-right on desktop, slide-in-bottom on mobile.
- Route change in admin/webmail: no cross-fade (bad for perceived speed);
  content skeleton immediately.

## Screen catalog

Every screen ships with: **loading**, **empty**, **error**, **offline**,
**success state**, and a **command-palette entry** for its primary action.
The catalog below is exhaustive for v1.0.

### Admin app

| Screen | Purpose | Primary action | Keyboard |
|---|---|---|---|
| /login | Sign in | Sign in | `Enter` |
| /login/bootstrap | Bootstrap owner | Create org | `Enter` |
| /invite/:token | Accept invite | Join | `Enter` |
| /orgs/:id | Overview dashboard | Add domain / mailbox | `g o` |
| /orgs/:id/domains | Domain list | Add domain | `n d` |
| /orgs/:id/domains/:did | Domain detail (DNS + DKIM) | Verify | `v` |
| /orgs/:id/mailboxes | Mailbox list + CSV import | Add mailbox | `n m` |
| /orgs/:id/mailboxes/:mid | Mailbox detail | Edit | `e` |
| /orgs/:id/aliases | Alias list | Add alias | `n a` |
| /orgs/:id/queue | Queue snapshot + deferred | Trace queue-id | `/` |
| /orgs/:id/queue/:queueId | Per-message trace | Delete / requeue | `del` |
| /orgs/:id/deliverability | DMARC + DNSBL + score | View report | — |
| /orgs/:id/security | Blocked IPs + score + country | Block IP | `b` |
| /orgs/:id/backups | Schedule + runs + restore | Run now | `r` |
| /orgs/:id/webhooks | List + deliveries | New | `n w` |
| /orgs/:id/api-keys | List + issue + revoke | Issue | `n k` |
| /orgs/:id/team | Members + roles + invites | Invite | `n i` |
| /orgs/:id/plugins | Installed + marketplace | Install | — |
| /orgs/:id/themes | Theme editor + presets | New theme | — |
| /orgs/:id/settings | Platform preferences | Save | `⌘ s` |
| /orgs/:id/audit | Audit log with filters | Export | `⌘ e` |
| /developers | Dev portal + OpenAPI | Download spec | — |
| /help | Docs shortcut | — | `?` |

### Webmail app

| Screen | Purpose | Primary action | Keyboard |
|---|---|---|---|
| /:mailboxId | Three-pane inbox | Compose | `c` |
| /:mailboxId/:folder | Folder view | Compose | `c` |
| /:mailboxId/:folder/:threadId | Thread reader | Reply | `r` |
| /:mailboxId/compose/:draftId | Composer | Send | `⌘ ⏎` |
| /:mailboxId/search | Search results | Refine | `/` |
| /:mailboxId/settings | Signatures, rules, aliases | Save | `⌘ s` |
| /:mailboxId/contacts | Contacts | Add | `n c` |
| /:mailboxId/calendar | Calendar (CalDAV) | New event | `n e` |
| /:mailboxId/tasks | Tasks | New | `n t` |
| /:mailboxId/notes | Notes | New | `n n` |

### Landing app

- `/` Marketing hero, feature grid, testimonials, install CTA.
- `/features` Feature catalog with mini demos.
- `/pricing` Support tiers (self-hosted is free; support is paid).
- `/blog` and `/blog/[slug]` — MDX with RSS + Atom.
- `/changelog` — auto-generated from `CHANGELOG.md`.
- `/docs` (versioned) — every doc under `docs/` rendered.
- `/download` — installer curl one-liner, tarballs, checksums.
- `/community` — Discord/Matrix invite, forums.
- `/security` — vulnerability disclosure + `security.txt`.

## Interaction specifications (excerpts)

Full specs live in `docs/redesign/uiux/` per screen. Two examples here.

### Mailbox list (admin)

- Loading: skeleton rows (5) match average row height; header stays.
- Empty: illustration + "Add your first mailbox" primary + "or import CSV" secondary.
- Error: inline error banner above table + "Retry" + copy trace id.
- Offline: sticky banner above app; table renders cached rows dimmed.
- Interactions:
  - Row hover reveals ellipsis (`⋮`) menu — matches context menu.
  - Right-click / long-press on row opens ContextMenu.
  - Shift-click a row extends selection; Ctrl-click toggles.
  - Bulk bar appears when selection > 0: Suspend, Resume, Delete, Export.
  - Drag row over another to swap primary — only if user has admin.
  - Undo toast on Suspend/Delete for 8 s.
- Realtime: WS event `mailbox.updated` merges into query cache; row flashes
  120 ms `--color-brand-500` at 30% alpha to signal change.

### Message reader (webmail)

- Loading: envelope + skeleton body appears in < 100 ms from click; iframe
  fades in when the body arrives.
- Empty (thread with only draft): shows composer inline.
- Offline: last cached body renders; banner says "showing offline copy".
- Actions in header:
  - Reply (`r`), Reply All (`shift r`), Forward (`f`), Archive (`e`),
    Delete (`#`), Snooze (`b`), Star (`s`), Mark unread (`shift u`),
    Move (`v`), Label (`l`), Print (`⌘ p`).
- Attachments row above body; click opens preview modal (image / PDF /
  video); download button always present.
- Remote images blocked with a bar: "Images hidden — allow for this sender".
- Threading: collapsed messages show sender + snippet + time; click expands
  with animation ≤ 160 ms.
- Long messages: reader-mode toggle (`shift m`) strips styles.

## Motion & feedback

- Toasts stack in the bottom-right (desktop) / bottom (mobile). Max 3
  visible; overflow queues.
- Bulk actions show a progress toast with per-item pass/fail count.
- Optimistic updates: applied immediately, rolled back on error with an
  explanatory toast; row highlighted in `--color-bad-500` for 800 ms.

## Theming

- The theme engine (see `packages/theme-engine`) mounts three CSS variable
  scopes: `:root` (platform default), `[data-org="…"]` (per-org overrides),
  `[data-domain="…"]` (per-domain overrides on login screens).
- Dark and light modes are independent branches of the same token set;
  operators can ship both variants of any custom theme.
- Reduced-motion and high-contrast variants required for a theme to pass
  validation.

## Copywriting rules

- Sentence case in UI; title case in marketing.
- Never use "please"; never use "sorry".
- Errors state what happened, why (if we know), what to do next.
- Empty states are one sentence and one CTA; no clip art unless it earns.

## Deliverables per screen

Every screen ships:

1. Figma frame (v1.0 shipping design in `design/` — links in the screen
   spec).
2. Story in Storybook for each significant component.
3. Screen spec markdown at `docs/redesign/uiux/<app>/<screen>.md` capturing
   states, keyboard, ARIA, and analytics events.
4. Playwright e2e covering primary happy path + one error path.
5. Axe a11y assertion in Playwright.
