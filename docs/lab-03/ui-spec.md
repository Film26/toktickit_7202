# UI Specification — Lab 3 (Auth, IT Staff, Admin)

Extends `docs/lab-02/ui-spec.md` — same Zen Green tokens (`client/src/index.css`), same shared
components (`LoadingSpinner`, `ErrorAlert`, `EmptyState`, `PriorityBadge`, `StatusBadge`,
`CommentForm`, `CommentList`). This document only describes what's new or changed for Lab 3; it
does not repeat the Lab 2 token table.

## 1. New/changed badges

- **`StatusBadge` gains three values** (Issue #42): `OPEN` = primary-outline (distinct from `NEW`'s
  solid primary, so a reviewer can tell "not yet acknowledged" from "acknowledged, not started"
  apart), `WAITING_FOR_REQUESTER` = warning (amber, matches `REOPENED`'s "needs attention" tone but
  a different label so the two are never confused), `CANCELLED` = dark/secondary with a strikethrough
  text style on the ticket row (signals "terminal, nothing to do" distinctly from `CLOSED`).
- **`RoleBadge` — planned, not built (found during Issue #49 visual inspection).** This doc
  originally described a dedicated `RoleBadge` component (`REQUESTER` = light, `IT_STAFF` = info,
  `ADMINISTRATOR` = dark) for `NavBar` and the Administrator User Management table. No such
  component exists in `client/src/components/`. In practice: `NavBar` shows the role as plain text
  (`{fullName} ({role})`), and the User Management table shows role as an editable `<select>`, not
  a badge. Functionally fine (the role is always legible as text either way), but flagged here
  rather than left silently mismatched with the code.
- **New "Appears Resolved" indicator**: a small `text-bg-success` pill with a check icon,
  `title="Requester indicated this appears resolved"`, shown next to the status badge in the queue
  row and the ticket-detail header whenever `requesterAppearsResolvedAt` is non-null. Not a status —
  it stacks alongside whatever `StatusBadge` is already showing.

## 2. Screens

### 2.1 Login (`LoginPage.tsx`)

Email + password, inline validation, busy "Signing in..." state, generic invalid-credentials alert
(BR-06) with an icon (`ErrorAlert`, shared with other screens). **Updated post-release to match the
handout mockup exactly** (previously deferred, see `specification.md` §11.5): the password field
has a show/hide eye-icon toggle (`PasswordInput`, shared with Change Password), and a "Forgot your
password?" link toggles a small inline message — "Please contact your Administrator to reset your
password" — rather than an actual email-based reset flow, which stays excluded per §3.2.

### 2.2 Change Password (`FirstPasswordChangePage.tsx`)

Current (temporary) password, new password, confirm new password, each with the same show/hide
toggle as Login. **Password rule reversal (see `specification.md` §11.5):** the mockup's
upper/lower/number/special-character checklist is now enforced, not just ≥8 characters — a live
checklist (`Password must:` with three rows: length, case, number+special) shows a green check per
requirement as the user types, backed by `client/src/lib/passwordPolicy.ts` (mirroring
`server/src/lib/passwordPolicy.ts`, the actual enforcement boundary). Submit is disabled until every
requirement passes and new/confirm match; busy label "Saving...". On success, redirects into
`/dashboard`.

### 2.3 App shell / `NavBar`

Shows the authenticated user's full name + `RoleBadge`. Nav links are role-filtered at render time
*and* every link's destination is itself `ProtectedRoute`-guarded server-authorization-backed — the
UI hiding is a convenience, not the security boundary (handout §4.3). `Logout` button clears the
token from `AuthContext`/`localStorage` and navigates to `/login`; any subsequent direct navigation
to a protected path immediately redirects to `/login` (verified by `ProtectedRoute`, which reads
`useAuth()` on every render, not just on mount).

### 2.4 Requester Ticket Detail (`RequesterTicketDetailPage.tsx` via `TicketDetailView.tsx`)

Unchanged Lab 2 layout (read-only header, Requested Priority editor while New/In Progress,
Public Comments tab — already open to Requesters) **plus one new control** (Issue #43): a
"Problem Appears Resolved" toggle button in the Actions card, visible whenever the ticket's status
is not `RESOLVED`/`CLOSED`/`CANCELLED`. Toggling it calls
`PATCH /:id/requester-appears-resolved` and flips the button between "Mark as Appears Resolved" and
"Undo Appears Resolved" (outline-success) — it never touches the status badge. This sits visually
separate from the (pre-existing) Confirm/Reject Resolution buttons, which only appear once IT Staff
has already moved the ticket to `RESOLVED` — the two must not be visually conflated, since one is an
informal Requester signal and the other is a formal post-resolution decision.

### 2.5 IT Staff Ticket Queue (`ItStaffDashboardPage.tsx`)

Existing: search box, Status/Owner/Category filter dropdowns, `TicketTable` with columns Ticket No.,
Created Date, Summary, Category, Req. Priority, IT Priority, Status, Owner (per handout §8.3's
example field list — Last Updated is intentionally omitted from the default column set to avoid the
"unreadable mega-grid" the handout warns against; sortable via the new column-header sort, see
below).

**New (Issue #44):**
- Sort is a `<select aria-label="Sort tickets">` dropdown above the table (Newest/Oldest first,
  Ticket No., Requested/IT Priority, Status, Recently updated) — **not** the clickable
  column-header-with-caret-icon design originally planned here (found during Issue #49 visual
  inspection; this doc's earlier draft described sort toggles built into the column headers
  themselves). The simpler dropdown covers the same sort fields and is consistent with the
  existing status/owner filter controls on the same screen; flagged as a design simplification,
  not a functional gap. Default sort: `Created Date` descending (newest first), matching the
  current unsorted behavior.
- Pagination bar below the table (Previous / page count / Next), same component style as the
  Requester's My Tickets list (which already has pagination from Lab 2).
- Empty/no-results distinction (per handout §8.6): "No tickets match your filters." when filters
  are active and the query returns zero rows, vs. "No tickets in the queue." when there are no
  filters and zero rows.

### 2.6 IT Staff Ticket Detail (`ItStaffTicketDetailPage.tsx` via `TicketDetailView.tsx`)

Existing: Owner `<select>`, IT Priority `<select>`, status action buttons, Internal Notes tab
(staff-only). **New (Issue #42):** status action buttons extended to cover the full matrix in
`specification.md` §7 — "Acknowledge" (New/Reopened → Open), "Mark Waiting" (In Progress → Waiting
for Requester), "Resume Progress" (Waiting for Requester → In Progress), "Cancel Ticket" (New/Open →
Cancelled, behind a confirmation dialog per handout §8.6's "required confirmations"). Only the
buttons valid for the ticket's *current* status render — the UI narrows the choice set as a
convenience, matching (not substituting for) the server's `409` enforcement.

**Public Comments vs. Internal Notes — visual distinction (handout §8.4):** Public Comments keep
the existing white-card / plain-text style. Internal Notes render inside a `bg-warning-subtle`
panel with a left amber border and a "Internal — not visible to the Requester" caption pinned above
the note form, so an IT Staff member cannot mistake which box they're typing into. **This
distinction did not exist until Issue #49's visual inspection caught it**: Internal Notes were
rendering with the exact same plain white-card style as Public Comments (only the tab label and
placeholder text differed) — a real gap against this doc and handout §8.4, fixed as part of #49
rather than left for a later issue, since it was a small, targeted change
(`client/src/components/TicketDetailView.tsx`, the `tab === 'notes'` branch). The Internal Notes
tab itself is only rendered when `isStaff` (existing) — a Requester never even sees an empty
tab for it, since the server already strips `internalNotes` from their payload entirely (FR-08).

### 2.7 Administrator User Management (`UserManagementPage.tsx`)

Existing: table (Name, Email, `RoleBadge`, Status badge, Edit button), search box wired to `q`.

**New (Issue #45):**
- Role filter `<select>` (All / Requester / IT Staff / Administrator) wired to the already-supported
  `role` query param.
- Create User panel gains an "Active" toggle (defaults on) alongside Name/Email/Role, sent as
  `isActive` on `POST /api/users`.
- **Correction (Issue #49 visual inspection): there is no separate "Edit User panel."** This doc's
  earlier draft described role/active editing happening in a dedicated Edit panel with its own
  Deactivate control. The actual, shipped design is simpler: every editable field lives inline in
  the table row itself — a `<select>` for Role (changes immediately on select), a "Reset Password"
  button, and a "Deactivate"/"Activate" toggle button. That toggle **is** disabled (not merely
  warned-against) on the signed-in Administrator's own row, with a tooltip "You can't deactivate
  your own account," and a `403`/`409` from the server (e.g. two admin tabs open) shows inline via
  `ErrorAlert`. Name and email are **not** editable through the UI at all — `PATCH /api/users/:id`
  supports it server-side (FR-25), but no control calls it with those fields. Worth a follow-up
  issue if the handout requires editing them; out of scope to add here.
- "Reset Password" (and "Create") show the returned one-time temporary password in a dismissible
  `alert-success` panel (not a modal that could be lost on accidental dismiss) with a note that it
  won't be shown again. **There is no copy-to-clipboard button** (this doc's earlier draft
  described one) — the password is plain selectable text in a `<code>` element only.

## 3. Component states (additions to Lab 2's list)

- **Forbidden — `ForbiddenAlert` was planned but not built (found during Issue #49 visual
  inspection).** This doc originally described a dedicated `ForbiddenAlert` component using
  `alert-warning` (amber) styling, distinct from `ErrorAlert`'s red, for `403` responses. No such
  component exists — every error, including `403`s, renders through the same `ErrorAlert`
  (`alert-danger`, red). Not a functional problem (the message text is always the server's
  specific, safe error text either way — see "Conflict" below), just a visual-distinction gap
  against this doc's original intent. The one place a "forbidden" state is genuinely
  distinguishable is the disabled self-deactivate button (a `disabled` control with a tooltip, not
  an alert at all).
- **Conflict (409):** rendered through the existing `ErrorAlert`, but the message is always the
  server's specific safe-error text (e.g., "Cannot deactivate the last active Administrator"), never
  a generic "Something went wrong."
- **Not found:** the Requester Ticket Detail and IT Staff Ticket Detail screens already 404-redirect
  to a "Ticket not found" `EmptyState` when `GET /:id` returns 404 — reused as-is for any Lab 3
  addition that can 404 (e.g. navigating to a stale ticket id after a peer's ticket gets removed from
  view).

## 4. Responsive behavior

Same Bootstrap-grid approach as Lab 2 (no custom breakpoints). New surfaces verified at desktop
(1280px), tablet (800px), and mobile (375px), per handout §7/§8.7 (Issue #49 visual pass):
- IT Staff Queue table and pagination bar — **the pagination bar itself never overflows or wraps**
  at 375px (Previous / "Page 1 of 4" / Next stay on one line). The *table*, however, has more
  columns than fit at 375px or even 800px — see §6's "clipping/overflow" finding for the full
  detail; it scrolls horizontally within its own `.table-responsive` container rather than
  overflowing the page.
- Administrator User Management's Create User panel — confirmed it stacks above the table at every
  width tested, including 375px (`user-management/user-list-mobile.png`); there is no separate Edit
  panel to check (see §2.7 correction).
- Internal Notes' amber panel (added during this pass, §2.6) — confirmed the left border and
  caption remain visible, not clipped, at 375px.

Screenshots for all three breakpoints, all Lab 3 screens, are committed under
`artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`
(Issue #49).

## 5. Accessibility (additions to Lab 2's list)

- The new sort-toggle column headers are real `<button>` elements inside `<th>` (not clickable
  `<div>`s), so they remain keyboard- and screen-reader-operable.
- `ForbiddenAlert`/`ErrorAlert` regions get `role="alert"` so their text is announced when they
  appear, closing the Lab 2 gap noted for validation/success alerts generally (Issue #49 visual pass
  should re-check this against Lab 2's screens too, not just the new ones).
- The disabled self-deactivate control keeps a visible `disabled` state (not just a class toggle
  with no `disabled` attribute), so it's correctly announced as unavailable rather than merely
  styled differently.

## 6. Visual checklist (run during Issue #49, against screenshots in
`artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`)

- [x] **Design consistency** — PASS. Every screen uses the existing Zen Green tokens (green
      navbar/primary buttons, existing badge/alert styles); no ad-hoc colors found. The one
      addition, the Internal Notes amber panel (see §2.6), reuses Bootstrap's existing
      `bg-warning-subtle`/`border-warning` utilities, not a new color.
- [x] **Role navigation** — PASS. Requester sees only "Create Ticket" + "Change Requester"; Admin
      sees only "Users" + "Reference Data"; IT Staff sees neither. No link to an inaccessible
      destination was found on any screenshot.
- [x] **Badges never rely on color alone** — PASS. Every `StatusBadge`/`PriorityBadge` always shows
      a text label (e.g. "High", "In Progress") alongside its color. Role is not shown as a badge
      at all currently (see §1 correction) — text-only, so this is trivially satisfied for role too.
- [x] **Editable vs. read-only fields** — PASS. Read-only `Field`s (Ticket No., Category, Ticket
      Date, etc.) consistently use `bg-light`; every editable control (selects, inputs) uses the
      plain white Bootstrap control style. Verified on both Requester and IT Staff ticket detail.
- [x] **Validation placement** — PASS. The login error and the create-user validation both render
      inline, above/near the relevant form, never only in a toast (`artifacts/.../login-error-*`).
- [ ] **Focus states** — NOT VERIFIED. Static screenshots can't show `:focus` styling; this needs
      an actual keyboard walk-through (Tab through each form) rather than a screenshot diff. Left
      unchecked rather than falsely marked pass — a follow-up manual pass is still needed here.
- [~] **No clipping/overlap/horizontal overflow at 375px** — PARTIAL. No page-level horizontal
      scroll or overlapping elements were found on any screen. However, the IT Staff Queue table
      (`staff-queue/queue-mobile.png`) and the User Management table (`user-management/user-list-
      mobile.png`) both have more columns than fit in 375px (and even 800px tablet width) — several
      columns (Status, IT Priority, Password, action buttons) are pushed outside the initially
      visible area. This is Bootstrap's `.table-responsive` wrapper doing its job (the table
      scrolls horizontally *within its own container*, not the whole page), and it's the same
      pattern Lab 2's My Tickets table already uses — not a Lab 3 regression. But it means a
      reviewer scanning only a screenshot (not actually scrolling) will not see most of the table's
      columns at mobile width; worth a follow-up (e.g. a visible "scroll for more →" hint) rather
      than a hard requirement for this lab.

### Findings fixed during this pass
- IT Staff Ticket Detail's Owner-reassignment dropdown was silently empty for any plain IT Staff
  session (`GET /api/users` is Administrator-only) — fixed in Issue #49's E2E PR with a new
  `GET /api/tickets/assignable-owners` endpoint.
- Internal Notes had no visual distinction from Public Comments (see §2.6) — fixed in this pass.

### Findings documented, not fixed (flagged for the reviewer)
- `RoleBadge`, `ForbiddenAlert`, column-header sort toggles, the Reset-Password copy-to-clipboard
  button, and the separate Edit User panel were all planned in this doc but never built. None are
  functional blockers — see the corrected descriptions in §1/§2.5/§2.7/§3 above for what actually
  ships instead.
