# UI Specification — Lab 4 (Actions Taken, Dashboards, Final Polish)

Extends `docs/lab-02/ui-spec.md` and `docs/lab-03/ui-spec.md`: same Zen Green tokens
(`client/src/index.css` — primary `#006b3c`, secondary `#0b7a46`, pale `#eaf6ef`, page `#f5f7f6`,
read-only `#f4f1e8`), same shared components (`LoadingSpinner`, `ErrorAlert`, `EmptyState`,
`StatusBadge`, `PriorityBadge`, `CommentForm`, `CommentList`). Only new or changed UI is described.

## 1. App shell and navigation

| Role | Left (brand) | Links | Right |
|---|---|---|---|
| Requester | clock icon + **TokTickIT** → `/dashboard` | Dashboard · My Tickets · Create Ticket | name (role) · Log out |
| IT Staff | same | Dashboard · Ticket Queue | same |
| Administrator | same | Dashboard · Ticket Queue · Users · Reference Data | same |

- Links are `NavLink`s: the active one gets `aria-current="page"`, bold text and a 3px white
  underline (non-colour cue). Visible focus ring on every link/button (`:focus-visible`, white
  2px outline on the green bar).
- Below 768px the links collapse behind a "Menu" toggle button (`aria-expanded`,
  `aria-controls`); no horizontal scroll.
- The Lab 2 "Change Requester" navbar button is removed (dev-only selector, no longer part of the
  product shell — `/dev-requester-select` still works by URL for development).

## 2. Shared new components

- **`MetricCard`** — white card, label (small, muted), large value (`fs-2 fw-semibold`), optional
  `+N today` line (green ▲ with text, never colour alone), and a "View all" link
  (`aria-label="View all <label> tickets"`). Whole card is not a link — only "View all" is, so the
  focus order stays simple. Zero value shows `0` and a muted "Nothing here".
- **`DashboardTicketList`** — card with header (title + "View all" link) and up to 5 rows:
  ticket number (link to detail) + summary, `StatusBadge`, formatted updated date. Empty → shared
  `EmptyState`.
- **`ActionStatusBadge`** — Planned (white, primary outline, ◷ text "Planned"), In Progress (info),
  Completed (success, ✓), Cancelled (dark, strikethrough). Text label always present.
- **`ConflictAlert`** — warning alert: "This item was changed by someone else. Reload to see the
  latest version." + **Reload** button; used for any `409 STALE_UPDATE`.

## 3. Requester Dashboard (`/dashboard`, Requester)

Matches handout §8.2 mockup.

- Header: `h1` "Welcome, <first name>!" + muted "Here's the latest on your requests."
- Row of 5 `MetricCard`s: My Open Tickets, In Progress, Waiting for Me, Resolved, Closed
  (`row-cols-2 row-cols-md-3 row-cols-xl-5`).
- Two columns (`col-lg-8` / `col-lg-4`):
  - Left: **My Recent Tickets** (View all → `/tickets`), then **Needs your attention** (Waiting for
    Me + Resolved awaiting confirmation; View all → `/tickets?status=WAITING_FOR_REQUESTER`).
  - Right: **Quick Actions** — "+ Create Ticket / Submit a new request" and "View My Tickets / Track
    existing requests" as large outline buttons.
- States: loading → `LoadingSpinner "Loading dashboard..."`; error → `ErrorAlert` + Retry button;
  no tickets at all → all zeros + `EmptyState "You haven't created any tickets yet."` with Create
  Ticket button; forbidden (wrong role via URL) → never happens because `/dashboard` picks the
  role's dashboard; direct API misuse gets `403`.

## 4. IT Staff Dashboard (`/dashboard`, IT Staff and Administrator)

Matches handout §8.1 mockup.

- Header: `h1` "Welcome back, <first name>!" + muted "Here's what's happening with your queue
  today." + **Refresh** button (disabled + spinner while reloading).
- 6 `MetricCard`s: New, Open, In Progress, Waiting for Requester, My Assigned, Unassigned
  (`row-cols-2 row-cols-md-3 row-cols-xl-6`), first four with "+N today".
- Two columns:
  - Left (`col-lg-7`): **My Recent Tickets** (View all → `/queue?ownerId=me`), **My Open Actions
    Taken** (ticket number, description, `ActionStatusBadge`, action date; total count in header).
  - Right (`col-lg-5`): **Quick Actions** (Ticket Queue, Unassigned, My Queue — icon + label
    tiles), **Open Tickets by IT Priority** (list of priority badge + count, each a link).
  - Administrator only: **User Accounts** card (active Requesters / IT Staff / Administrators,
    inactive) with "Manage users" link.
- States as §3; IT Staff with nothing assigned → My Recent Tickets empty state "No tickets are
  assigned to you yet." and My Open Actions empty state "You have no open Actions Taken."

## 5. My Tickets (`/tickets`) and Ticket Queue (`/queue`)

Lab 2/3 pages, moved from `/dashboard`. On load they read `status`, `statusGroup`, `ownerId`,
`itPriority` from the URL; a dismissible chip "Filtered from dashboard: <description>" with
**Clear filters** appears when a drill-down filter that has no visible control (statusGroup,
itPriority) is active. Status filter buttons now include all 8 statuses (Open, Waiting for
Requester, Cancelled were missing from the button row).

## 6. Ticket Detail — Actions Taken area

Tab renamed from "Service Actions" to **Actions Taken (n)**, placed first among the tabs for staff.

### 6.1 List mode

- ≥ 992px: table — Date/Time · Description · Result · Performed By · Assigned To · Status ·
  Follow-Up · (staff) "View / Edit" button. Description/result clamp to 2 lines with full text in
  the View panel. Follow-Up column: "Yes" + note excerpt, or "No".
- < 992px (tablet and mobile): each action is a stacked card (label: value pairs), no horizontal scroll.
- Ordered by Action Date/Time ascending, then creation — stable across reloads.
- Empty: "No Actions Taken recorded yet." (+ staff hint "Use Add Action to plan or record work.").
- Staff header button **+ Add Action** (hidden when the Ticket is Resolved/Closed/Cancelled, with
  muted text "Actions are read-only once a ticket is Resolved, Closed or Cancelled.").

### 6.2 Create mode (staff)

Inline form panel (`aria-labelledby` heading "Add Action Taken"):

| Control | Type | Rule shown inline |
|---|---|---|
| Action Date/Time | `datetime-local`, default now | required |
| Action Description | textarea | required, ≤ 2000 |
| Status | select Planned / In Progress / Completed | |
| Result | textarea | required when Completed |
| Assigned To | select of active staff (default: me) | |
| Follow-Up Required? | checkbox | |
| Follow-Up Note | textarea, shown when checked | required when checked |
| Attachment Notes | text input | ≤ 500, hint "e.g. see router-log.pdf in Attachments" |
| Performed By | read-only text "You (<name>)" | automatic |

Buttons: **Save Action** (disabled + "Saving..." while in flight) and **Cancel**. Field errors
appear directly under the field (`invalid-feedback`, `aria-invalid`, `aria-describedby`); server
`400 fields` are mapped onto the same places. On any failure the entered values stay. A
`clientRequestId` is generated when the form opens and reused on retry.

### 6.3 View / Edit mode (staff)

Same form pre-filled; Performed By and created time read-only (`--zg-readonly-bg`). Status select
offers only the BR-08 moves. Completed/Cancelled actions open read-only ("This action is
Completed and can no longer be edited."). Quick buttons in the panel: **Start**, **Mark
Completed** (requires Result), **Cancel Action** (confirm dialog). `409 STALE_UPDATE` →
`ConflictAlert` with Reload; the form keeps the user's text until they reload.

### 6.4 Requester view

Same list/cards, no Add/Edit buttons, View opens a read-only panel.

## 7. Ticket workflow controls and feedback

- Status buttons are computed from one `allowedTransitions(status, role)` helper mirroring
  specification §7, so the UI never shows a transition the API would reject for that role.
- **Resolve** panel (staff, In Progress / Waiting): Resolution Summary textarea + Resolve button.
  If the gate is not met the button is disabled and a hint lists why ("1 action still open",
  "No completed action yet") with a link that switches to the Actions Taken tab. The backend
  still enforces it (`409 RESOLUTION_GATE` message shown in `ErrorAlert` if reached).
- Every workflow button is disabled while any workflow request is in flight.
- On success, the ticket is re-fetched: status badge, available buttons, version, and Status
  History all update; a `role="status"` live region announces "Status changed to <label>".
- **Status History** tab: ordered list "<from> → <to> · by <name> · <date>" (first entry
  "Created"). Read-only for all roles. Legacy tickets show "No status history recorded before
  Lab 4." when empty.

## 8. Responsive rules

| Width | Dashboards | Actions Taken | Navbar |
|---|---|---|---|
| ≥ 1200 | 5–6 cards in one row, two-column body | table | inline links |
| 992–1199 | 3 cards per row, two-column body | table (wraps text) | inline links |
| 768–991 | 3 cards per row, single column | stacked cards | inline links |
| < 768 | 2 cards per row, single column | stacked cards | Menu toggle |

No horizontal page scroll at 375, 768, 1280 px (checked by `e2e/lab-04/visual-inspection.spec.ts`
via `document.documentElement.scrollWidth <= innerWidth`).

## 9. Accessibility

Semantic headings (one `h1` per page, `h2` per card), labelled form controls, `aria-current` on
active nav, `aria-live` status announcements, focus moved to the form heading when Create/Edit
opens and back to the triggering button on close, keyboard-operable everything (no click-only
divs), status/priority/action-status always have a text label (not colour alone), contrast ≥ 4.5:1
for text on Zen Green.

## 10. Visual and accessibility checklist (completed at release — Issue #69)

Checked on 2026-10-07 against `artifacts/lab-04/screenshots/` (37 screenshots, desktop 1280 /
tablet 800 / mobile 375 px, captured by `e2e/lab-04/visual-inspection.spec.ts` on the seeded dev
DB). "Auto" = asserted by a test on every run; "Visual" = checked by reviewing the screenshots.

| # | Check | Staff Dashboard | Requester Dashboard | Actions Taken | Evidence |
|---|---|---|---|---|---|
| 1 | Zen Green tokens only, no stray Bootstrap blue | ✅ | ✅ | ✅ | Visual |
| 2 | Cards/buttons/badges consistent with Labs 2–3 | ✅ | ✅ | ✅ | Visual; reuses `StatusBadge`, `PriorityBadge`, card + button classes |
| 3 | Editable vs read-only fields visually distinct | n/a | n/a | ✅ Performed By / Requester view use the read-only beige; Requester panel fields disabled | Visual + `ActionsTaken.test.tsx` UI-07 |
| 4 | Validation messages placed under the field | n/a | n/a | ✅ `invalid-feedback` + `aria-invalid` + `aria-describedby` | `ActionsTaken.test.tsx` UI-04, screenshot `02-create-validation` |
| 5 | Visible keyboard focus on every control | ✅ white 2px ring on nav | ✅ | ✅ green focus ring on inputs; heading focused when form opens | Visual + UI-04 (`toHaveFocus`) |
| 6 | No clipped text / overlapping controls (375/768/1280) | ✅ (labels reserve 2 lines so values align) | ✅ | ✅ (table → cards below 992 px) | Visual |
| 7 | No horizontal overflow (375/800/1280) | ✅ | ✅ | ✅ | Auto (`visual-inspection.spec.ts` asserts `scrollWidth ≤ innerWidth` at every width) |
| 8 | Loading, empty, error states present | ✅ incl. safe-failure + Retry screenshot | ✅ | ✅ empty list, locked-ticket message | UI-02, UI-03, screenshot `04-safe-failure` |
| 9 | Non-colour status cues | ✅ "+N today" has ▲ and text | ✅ | ✅ action status symbol + label; active nav underlined + bold | Visual |
| 10 | Drill-down links reach the filtered list | ✅ | ✅ | n/a | Auto (DASH-04/07 API totals, E2E-04/05 in browser) |

Issues found and fixed during this pass:

- **Actions Taken table broke the page width at 800 px**: the table's visually-hidden header
  label is absolutely positioned and escaped the `.table-responsive` scroll box. Fixed with
  `position-relative` on the wrapper, and the table now starts at 992 px (cards below), since
  eight columns do not fit a tablet usefully.
- **Clamping text on a `<td>` itself broke the table layout** (Result rendered under
  Description). Fixed by clamping an inner `<div>`.
- **Metric values misaligned** when one label wrapped ("Waiting for Requester"). Fixed by
  reserving two label lines on every card.
