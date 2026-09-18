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
- **New `RoleBadge`**: `REQUESTER` = light, `IT_STAFF` = info, `ADMINISTRATOR` = dark. Used in
  `NavBar` (current user) and the Administrator User Management table.
- **New "Appears Resolved" indicator**: a small `text-bg-success` pill with a check icon,
  `title="Requester indicated this appears resolved"`, shown next to the status badge in the queue
  row and the ticket-detail header whenever `requesterAppearsResolvedAt` is non-null. Not a status —
  it stacks alongside whatever `StatusBadge` is already showing.

## 2. Screens

### 2.1 Login (`LoginPage.tsx`) — unchanged from Lab 2

Already matches the handout mockup: email, password, inline validation, busy "Signing in..."
state, generic invalid-credentials alert (BR-06). No Lab 3 changes needed here.

### 2.2 Change Password (`FirstPasswordChangePage.tsx`)

Current (temporary) password, new password, confirm new password. Live validation: new/confirm
match, new ≥ 8 characters. Submit is disabled until both checks pass; busy label "Saving...". On
success, redirects into `/dashboard`. Per `specification.md` §11.5, the mockup's
upper/lower/number/special-character checklist is **not** implemented — only length is enforced and
shown — flagged for the reviewer rather than silently matched to the mockup.

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
- Column headers for `Created Date`, `Req. Priority`, `IT Priority`, `Status` become sort toggles
  (click = ascending, click again = descending; a small caret icon shows current sort direction).
  Default sort: `Created Date` descending (newest first), matching the current unsorted behavior.
- Pagination bar below the table (Previous / page numbers / Next), same component style as the
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
the note form, so an IT Staff member cannot mistake which box they're typing into. The Internal
Notes tab itself is only rendered when `isStaff` (existing) — a Requester never even sees an empty
tab for it, since the server already strips `internalNotes` from their payload entirely (FR-08).

### 2.7 Administrator User Management (`UserManagementPage.tsx`)

Existing: table (Name, Email, `RoleBadge`, Status badge, Edit button), search box wired to `q`.

**New (Issue #45):**
- Role filter `<select>` (All / Requester / IT Staff / Administrator) wired to the already-supported
  `role` query param.
- Create User panel gains an "Active" toggle (defaults on) alongside Name/Email/Role, sent as
  `isActive` on `POST /api/users`.
- Edit User panel: the "Deactivate" control is **disabled** (not merely warned-against) when the row
  being edited is the signed-in Administrator's own account, with a tooltip
  "You can't deactivate your own account." If an edit is attempted anyway via a stale UI state
  (e.g., two admin tabs open) and the server returns `403`/`409`, the panel shows that message
  inline via `ErrorAlert` rather than silently failing.
- "Reset Password" action shows the returned one-time temporary password in a dismissible
  `alert-success` panel (not a modal that could be lost on accidental dismiss) with a copy-to-
  clipboard button, and a note "The user must set a new password at their next login."

## 3. Component states (additions to Lab 2's list)

- **Forbidden:** a shared `ForbiddenAlert` (new) renders the server's `403` message inline where an
  action button lives (e.g., the disabled self-deactivate control, a blocked status transition) —
  distinct from `ErrorAlert`'s generic red styling by using `alert-warning` instead of
  `alert-danger`, so "you're not allowed" reads differently from "something broke."
- **Conflict (409):** rendered through the existing `ErrorAlert`, but the message is always the
  server's specific safe-error text (e.g., "Cannot deactivate the last active Administrator"), never
  a generic "Something went wrong."
- **Not found:** the Requester Ticket Detail and IT Staff Ticket Detail screens already 404-redirect
  to a "Ticket not found" `EmptyState` when `GET /:id` returns 404 — reused as-is for any Lab 3
  addition that can 404 (e.g. navigating to a stale ticket id after a peer's ticket gets removed from
  view).

## 4. Responsive behavior

Same Bootstrap-grid approach as Lab 2 (no custom breakpoints). New surfaces to verify at desktop
(1280px), tablet (800px), and mobile (375px), per handout §7/§8.7:
- IT Staff Queue table with the new sort headers and pagination bar — confirm the pagination bar
  wraps to a second line rather than overflowing horizontally at 375px.
- Administrator User Management's Create/Edit side panel — confirm it stacks below the table (not
  beside it) below the `md` breakpoint, matching the existing Ticket Detail's stacking behavior.
- Internal Notes' amber panel — confirm the left border and caption remain visible (not clipped) at
  375px.

Screenshots for all three breakpoints, all Lab 3 screens, go under
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

## 6. Visual checklist (to be run and checked off during Issue #49)

- [ ] Design consistency: every new control uses existing Zen Green tokens/components, no ad-hoc
      colors introduced.
- [ ] Role navigation: no nav link to a destination the current role can't use appears anywhere.
- [ ] Badges: status/priority/role badges never rely on color alone (text label always present).
- [ ] Editable vs. read-only fields keep the existing Lab 2 visual convention (`bg-light` for
      read-only).
- [ ] Validation placement consistent with Lab 2 (inline, under the field, not only in a toast).
- [ ] Focus states visible on every new interactive element (sort headers, toggle, filter select).
- [ ] No clipping/overlap/horizontal overflow at 375px on any Lab 3 screen.
