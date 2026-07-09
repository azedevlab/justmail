# Phase 8 — Component library (`packages/ui`)

Layering: **shadcn/ui primitives → Meridian tokens → JustMail composites**.
shadcn components are vendored into `packages/ui` (not per-app) and re-styled once via
the Phase 6 tokens. Apps import only from `@justmail/ui`.

## 1. Base layer (shadcn/ui, restyled)

Button, Input, Select, Combobox, Checkbox, Switch, Slider, Dialog, Sheet, Popover,
DropdownMenu, Tooltip, Tabs, Badge, Avatar, Toast (sonner), Form (RHF+zod wiring),
Skeleton, Command (cmdk), ScrollArea, Separator, Breadcrumb.

Rules: no per-app overrides; variants via `cva`; every interactive element keyboard
accessible; focus ring mandatory.

## 2. JustMail composites

| Component | Purpose / notes |
|---|---|
| `AppShell` | Sidebar + topbar + content grid; collapse state persisted; org switcher slot |
| `CommandPalette` | cmdk + pluggable sources (nav/entities/actions); server-backed entity search debounced 120ms |
| `StatCard` | Dashboard metric: label, big tabular-nums value (tweens on change), delta chip, sparkline slot, click → drill-down |
| `LiveChart` | Recharts wrapper: theme-bound axes/palette, draw-in once, WS append without re-animation; variants: area, stacked-area, bar, sparkline |
| `DataGrid` | TanStack Table + virtualizer: sticky header, row hover actions, row expansion, multi-select + bulk bar, j/k navigation, column persistence, URL-synced filters/sort, empty & skeleton states built-in |
| `StatusPill` / `StatusDot` | Single source of status→color mapping (Phase 6 §2); pulse-once on transition |
| `HealthScore` | Radial 0–100 gauge + breakdown popover (security score, domain health) |
| `DnsRecordRow` | Type chip, mono name/content (copy on click), TTL, status, expand → desired vs observed diff + propagation map |
| `SetupChecklist` | Wizard step list with live ✗/⏳/✓ transitions (domain onboarding, TLS setup) |
| `QueueItem` | Queue-id (mono, copyable), route summary, age, error reason, inline retry/hold/delete |
| `TraceTimeline` | Vertical event chain for one queue-id; per-step duration, collapsible raw logs |
| `LogViewer` | Virtualized mono stream: follow-tail toggle, severity coloring, search-in-view, saved filter chips |
| `QuotaBar` | Used/total with thresholds (ok/warn/danger), inline editable target |
| `InspectorPanel` | Right slide-over (Sheet-based, 420px): header, tab slots, danger zone footer; URL-addressable |
| `BulkActionBar` | Floats above DataGrid on selection: count, actions, escape to clear |
| `ConfirmDestructive` | Typed-confirmation dialog for irreversible ops |
| `CopyField` | Mono value + copy button + copied feedback (DNS values, API keys, IPs) |
| `EmptyState` | Icon + sentence + primary action; brand-gradient illustration variant for first-run |
| `KbdHint` / `ShortcutSheet` | Shortcut rendering + `?` overlay |
| `LiveIndicator` | Topbar dot: WS connection state (live/reconnecting/offline) |
| `ThemeToggle` | next-themes; no-flash inline script in app layout |

## 3. Chart & realtime conventions

- All charts read CSS variables — theme switch restyles without re-render.
- WS events land in a Zustand buffer; charts consume at max 1 update/s (batched),
  grids invalidate TanStack Query keys.
- Time ranges shared via `TimeRangePicker` (1h/24h/7d/30d/custom) synced to URL.

## 4. Quality gates

- Storybook for every composite (dark+light), interaction tests for DataGrid,
  CommandPalette, InspectorPanel.
- Axe accessibility checks in CI; keyboard path tested for palette, grid, inspector.
- Visual regression (Chromatic-style snapshots via Playwright) on tokens + top 10 composites.
