# UI Specification — Requester-Facing Slice

Documents the UI as actually built (`client/src/pages`, `client/src/components`), not the Zen Green mockups in the Lab 2 handout. The gap between the two is called out explicitly rather than described as if closed.

## 1. Theme

**Status (2026-08-28): implemented in [PR #30](https://github.com/Film26/toktickit_7202/pull/30), not yet merged into `dev/full-app`.** Everything in this section describes that PR's `client/src/index.css`, not what's on `dev/full-app` today — until #30 merges, the live app still renders Bootstrap's default blue theme.

Bootstrap 5's compiled CSS hardcodes most component colors per-class (`.btn-primary`'s background is a literal hex, not `var(--bs-primary)`), so a single root-variable override doesn't retheme buttons, focus rings, or nav-tabs. `index.css` instead overrides `--bs-primary-rgb` (which navbar `bg-primary` and `text-bg-primary` badges do consume directly) plus the specific hardcoded classes the app actually uses.

| Token | Required (Lab 2) | Applied as |
|---|---|---|
| Primary | `#006B3C` | `--bs-primary-rgb` (navbar, primary badges) + explicit `.btn-primary`/`.btn-outline-primary` overrides |
| Secondary / active | `#0B7A46` | `--bs-link-color`, `.form-control:focus`/`.form-select:focus` ring, `.nav-tabs` active-tab color |
| Pale green | `#EAF6EF` | `.table` row-hover tint (`--bs-table-hover-bg`) |
| Page background | `#F5F7F6` | `--bs-body-bg` |
| Surface / cards | white, subtle border | `.card { --bs-card-bg: #fff }` (forced explicitly — otherwise cards would inherit the new page background and stop standing out as a surface) |
| Read-only field | soft gray-green/ivory | `--bs-light` / `--bs-light-rgb` (backs `.form-control.bg-light` and the `text-bg-light` "Not set" badge) |
| Error | dark red text/border | Bootstrap `.alert-danger` via `ErrorAlert` — left at Bootstrap default, not retheme'd |
| Priority/status badges | not specified | Bootstrap `.badge.rounded-pill` with semantic color classes — see Section 4; only the `primary`/`light` variants shifted color (via the token changes above), `info`/`warning`/`danger`/`success` are untouched |

Verified with a headless-browser screenshot against the running dev server: navbar/Sign-in button computed background `rgb(0, 107, 60)`, page background matches the pale token, no console errors. Not verified: contrast ratios against WCAG AA, or the tablet/mobile breakpoints (see Section 5).

## 2. Screens

### 2.1 Login (`LoginPage.tsx`)
Replaces the Lab 2 "Development Requester Selection" screen — this app uses real credentials, not a Requester picker. Elements: app title "TokTickIT", subtitle "IT Service Desk", email input, password input, submit button (busy-state label "Signing in..."), inline error alert on failure. No loading/empty state needed since there's nothing to load before submission.

### 2.2 My Tickets (`RequesterDashboardPage.tsx`)
Header with "My Tickets" title and a "+ Create Ticket" button. A row of status-filter buttons (All / New / In Progress / Resolved / Closed / Reopened) — clicking one re-fetches from `GET /api/tickets/mine?status=...`. Below that, a card containing `TicketTable`: a Bootstrap `table-hover` with columns Ticket No., Summary, Category, Owner, Requested Priority, IT Priority, Status; each row is clickable and navigates to `/tickets/:id`. Loading state is a spinner (`LoadingSpinner`); error state is an inline alert (`ErrorAlert`); empty state is `EmptyState` ("No tickets to show.").

**Gap vs. Lab 2:** no free-text search box, no column sorting, no pagination controls. The table simply renders every ticket returned for the active status filter.

### 2.3 Create Ticket (`CreateTicketPage.tsx`)
A single card form, max-width 720px, with: Category `<select>` (required, defaults to first loaded category), Related System `<select>` (optional, "None" default), Summary text input (`maxLength=200`, required), Description `<textarea>` (5 rows, required), Requested Priority `<select>` (defaults to Medium). Submit button shows "Submitting..." and is disabled while in flight; Cancel returns to `/dashboard`. Validation errors and API failures render through the same `ErrorAlert` component above the form; form values are preserved on failure since nothing is cleared until a successful `navigate()`.

**Gap vs. Lab 2:** there is no attachment picker on this screen — attachments can only be added after the ticket exists, from the Ticket Detail screen.

### 2.4 Ticket Detail (`TicketDetailView.tsx`, shared by Requester and staff pages)
Read-only header card: Ticket No., Ticket Date, Category, Related System, Requester, Requested Priority (badge), IT Priority (badge), Current Status (badge), Ticket Owner, Summary, Description, Resolution Summary (italic placeholder text when empty). An "Actions" card below shows role- and status-gated controls: for a Requester, a Requested Priority `<select>` (only while `NEW`/`IN_PROGRESS`), Confirm/Reject Resolution buttons (only while `RESOLVED`), Request Reopening button (only while `CLOSED`). A tabbed panel below covers Public Comments (all roles), Internal Notes (staff only, tab hidden for Requesters), Service Actions, and Attachments — the attachment tab is a filename + URL text-input form, not a file picker, followed by a list of existing attachments as plain links.

**Gap vs. Lab 2:** the handout requires the Requester Ticket Detail screen to show *only* ticket info and attachment actions, explicitly excluding Public Comments and status-workflow controls. The shipped component shows both to Requesters (comments tab, priority/resolution/reopen controls) — this is the "full lifecycle" scope from later labs, already present here.

## 3. Component states

- **Loading:** `LoadingSpinner` — a centered Bootstrap spinner, used identically on every page that fetches on mount.
- **Error:** `ErrorAlert` — a Bootstrap `alert-danger` rendering a single message string; used for both validation and network/API failures.
- **Empty:** `EmptyState` — used only in `TicketTable` when a ticket list is empty; there is no distinct "no results after filtering" vs "no tickets exist" state (both render the same message).
- **Busy button:** submit buttons disable themselves and swap their label text (e.g., "Submitting...", "Signing in...") while a request is in flight; no spinner icon is used inside the button.

## 4. Badges

`PriorityBadge`: LOW = secondary (gray), MEDIUM = info (cyan), HIGH = warning (amber), URGENT = danger (red); a `null` priority (IT Priority before staff sets one) renders "Not set" in a light/muted badge. `StatusBadge`: NEW = primary (blue), IN_PROGRESS = info, RESOLVED = success (green), CLOSED = secondary (gray), REOPENED = warning (amber). All badges are `rounded-pill` and rely on both color and text label (not color alone), satisfying the "no reliance on color alone" rule even though the palette itself is Bootstrap default rather than Zen Green.

## 5. Responsive behavior

No custom breakpoints are defined; layout responsiveness comes entirely from Bootstrap's grid (`container`, `row g-*`, `col-md-*`), whose breakpoints (`md` 768px, `lg` 992px) roughly line up with the Lab 2 tablet/desktop cutoffs. There is no dedicated mobile card layout for `TicketTable` — the table relies on Bootstrap's `.table-responsive` horizontal-scroll wrapper on narrow viewports rather than switching to a card list.

**Verified (2026-08-28), on PR #30's branch before merge, against Login/My Tickets/Create Ticket at desktop (1280px), tablet (800px), and mobile (375px):** no *page-level* horizontal scroll at any of the three (checked programmatically: `document.documentElement.scrollWidth` never exceeds `clientWidth`). The `TicketTable` columns do overflow *within* their own `.table-responsive` container at tablet and mobile widths — e.g. the Status column is visually clipped by the card edge on mobile — which is the documented gap above (no mobile card layout), not new page-level overflow. Not yet verified: Ticket Detail or the Attachments tab (both depend on PR #32, not yet merged), or a full visual checklist against the color/spacing tokens.

## 6. Accessibility

Form fields use `<label htmlFor>` paired with input `id`s throughout. Buttons carry visible text (no icon-only controls in this slice). No explicit `aria-live` region wraps the error/success alerts, so a screen reader's behavior on validation failure has not been verified. Focus-visible styling is whatever Bootstrap ships by default; no custom focus rings were added or verified against the "must remain visible" requirement.
