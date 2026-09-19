# Lab 3 Engineering Specification — Users, Roles, IT Staff Ticketing, and Admin Screens

## 1. Sprint Goal

Replace the Lab 2 Development Requester selector with real, server-enforced authentication and
role-based authorization for three roles (Requester, IT Staff, Administrator); give IT Staff an
operational Ticket Queue and Ticket Detail workflow (ownership, IT Priority, status transitions,
Public Comments, Internal Notes); give Administrators a minimalist User Management screen; and
close the specific, verified gaps between what already exists in this codebase and what the Lab 3
handout requires — without breaking any completed Lab 2 Requester function.

## 2. Stakeholder Request (in our own words)

Real users need to sign in with an email and password instead of picking a name from a dropdown.
An Administrator needs one simple screen to create accounts, assign a role, edit basic info,
activate/deactivate, and reset a password — nothing fancier. IT Staff need a queue they can search,
filter, sort, and page through, a ticket detail screen where they can claim/reassign ownership, set
IT Priority, move a ticket through its permitted statuses, talk to the Requester via Public
Comments, and keep private Internal Notes. Requesters keep using the ticket functions from Lab 2,
but now tied to their real login identity, and gain the ability to flag that a problem seems fixed
— without being able to formally resolve or close their own ticket. Every one of these rules has to
be enforced on the server, not just hidden in the UI.

## 3. Scope

### 3.1 Included

- Email + password login, forced first-login password change, current-user retrieval, logout.
- Server-side RBAC for Requester / IT Staff / Administrator on every protected endpoint.
- IT Staff Ticket Queue: search, filter, sort, pagination.
- IT Staff Ticket Detail: claim/reassign owner, set IT Priority, permitted status transitions,
  Public Comments, Internal Notes.
- Requester Ticket Detail: Public Comments (already live) + new "Problem Appears Resolved" signal.
- Administrator User Management: list (search + role filter), create, edit, activate/deactivate,
  reset password to a new initial password, with the mandatory safety rules in §5.
- Ticket status set completed to the full 8 required values with a documented transition matrix.
- Non-destructive migration of Lab 2 data; expanded, idempotent seed data.

### 3.2 Explicitly excluded (per handout §4.2)

Email invitations/password-reset email, MFA, social login/SSO, self-registration, Actions Taken
workflow rules (the `ActionTaken` model and its endpoints already exist in the schema/API from
pre-Lab-2 development and are left in place, untouched and unused by any Lab 3 requirement — the
rule that blocks resolution while Actions Taken are incomplete is Lab 4 scope), formal
SLA/escalation/notifications, dashboards/KPI analytics, multi-tenant/department structures,
production deployment changes, multiple roles per user, user deletion/bulk ops/import-export/audit
history, extended profile fields, email delivery of credentials, account unlocking/approval
workflows, mandatory pagination or multi-column sort or multiple simultaneous filters on the user
list.

## 4. Starting-state note (read this before reading the FRs)

This codebase did **not** start Lab 3 from zero. During Lab 2 development, real JWT
authentication, RBAC middleware, ticket ownership, IT Priority, Public Comments, Internal Notes,
and full IT Staff/Administrator screens were built ahead of schedule, then intentionally decoupled
from the live Lab 2 Requester flow (which uses a dedicated, unauthenticated
`POST /api/requesters/dev-select` test selector instead) — see `docs/lab-02/specification.md` §11
and `docs/lab-02/reviewer.md` for that decision's history. All of that code is real, live, and
already wired into `server/src/app.ts` and `client/src/router.tsx` today.

Every FR and BR below is written against a direct reading of the current code
(`server/src/routes/*.ts`, `server/src/controllers/*.ts`, `server/src/middleware/*.ts`,
`server/prisma/schema.prisma`, `client/src/router.tsx`, `client/src/components/TicketDetailView.tsx`)
as of this document's commit, not against the handout's mockups. Each FR is tagged:

- **[existing]** — already implemented and verified by reading the code; Lab 3 work is
  documentation, test coverage, and polish only.
- **[gap]** — partially implemented; a specific, named piece is missing.
- **[new]** — does not exist yet; net-new work.

## 5. Functional Requirements

### Authentication (Issue #41 docs; #47 hardening)

- **FR-01 [existing]** `POST /api/auth/login` accepts `{ email, password }`; returns
  `401 { error: "Invalid credentials" }` for a nonexistent email, wrong password, or inactive
  account (same response for all three, so account existence/status is never revealed). On success
  returns `{ token, user: { id, email, fullName, role, mustChangePassword } }`.
  (`server/src/controllers/auth.controller.ts`)
- **FR-02 [existing]** `POST /api/auth/change-password` (authenticated) verifies
  `currentPassword`, requires `newPassword` ≥ 8 characters, hashes it with bcrypt, and clears
  `mustChangePassword`.
- **FR-03 [existing]** `GET /api/auth/me` (authenticated) returns the current user's identity and
  role.
- **FR-04 [existing]** Every route in `tickets.routes.ts` and `users.routes.ts` runs
  `requireAuth` then `enforcePasswordChange`: a user with `mustChangePassword: true` gets
  `403 { error: "PASSWORD_CHANGE_REQUIRED" }` on any of those endpoints until they change their
  password.
- **FR-05 [gap]** Logout: currently client-side only (`AuthContext` discards the token from
  `localStorage`); there is no `POST /api/auth/logout`. Because `requireAuth` re-checks the user's
  `isActive` flag from the database on every request, a deactivated account loses API access
  immediately regardless of token expiry — this already gives Administrator-driven "logout" a real
  server-side effect even without a dedicated endpoint. Decision (§11): keep this design; do not add
  a stateful blocklist for Lab 3 (see BR-09).

### Authorization (Issue #47)

- **FR-06 [existing]** `requireRole(...roles)` middleware rejects with `403 { error: "Insufficient
  permissions" }` when the authenticated user's role is not in the allowed set.
  (`server/src/middleware/requireRole.ts`)
- **FR-07 [existing]** Ticket ownership is enforced server-side, never by a client-supplied id:
  `req.user!.id` is the sole source of Requester identity everywhere in
  `tickets.controller.ts`; `loadTicketForUser`/`userCanAccessTicket` return `404` (not `403`) when
  a Requester requests a ticket they don't own, so existence is never leaked.
  (`server/src/lib/ticketAccess.ts`)
- **FR-08 [existing]** Internal Notes are stripped from the serialized ticket for `REQUESTER`
  viewers server-side (`serializeTicket`), not merely hidden in the UI; `POST /:id/notes` is
  additionally gated to `IT_STAFF`/`ADMINISTRATOR` by `requireRole`.
- **FR-09 [new]** Full authorization-matrix test coverage proving every protected endpoint
  rejects the wrong role/ownership combination via direct API calls (Issue #47).

### IT Staff Ticket Queue (Issue #44)

- **FR-10 [existing]** `GET /api/tickets` (staff-only) supports `status`, `ownerId`
  (`me` / `unassigned` / a numeric id), `categoryId`, and `q` (summary/ticket-number search).
- **FR-11 [gap]** `GET /api/tickets` has no `sort`/`order`/`page`/`pageSize` parameters, unlike
  `GET /api/tickets/mine` which already has both. Lab 3 brings the two endpoints to parity
  (Issue #44).

### IT Staff Ticket Detail (Issues #42, #45 supporting)

- **FR-12 [existing]** `PATCH /api/tickets/:id/owner` (staff-only) claims or reassigns ownership;
  rejects any `ownerId` that is not an active `IT_STAFF`/`ADMINISTRATOR` user.
- **FR-13 [existing]** `PATCH /api/tickets/:id/it-priority` (staff-only) sets IT Priority
  independently of Requested Priority.
- **FR-14 [gap]** IT Priority does not currently default to Requested Priority at ticket creation
  (handout §4.5); `createTicket` leaves `itPriority` `null`. Fixed as part of Issue #42.
- **FR-15 [gap]** Status transitions only cover `NEW→IN_PROGRESS`, `REOPENED→IN_PROGRESS`
  (direct `PATCH /:id/status`), plus dedicated `resolve`/`close`/`confirm-resolution`/
  `reject-resolution`/`request-reopen` endpoints. The three missing statuses (`OPEN`,
  `WAITING_FOR_REQUESTER`, `CANCELLED`) and their transitions are net-new (Issue #42, matrix in §7).
- **FR-16 [existing]** `POST /api/tickets/:id/comments` (any accessor with ticket access) and
  `POST /api/tickets/:id/notes` (staff-only) create Public Comments / Internal Notes; both are
  append-only (no edit/delete routes exist).

### Requester regression (Issue #43)

- **FR-17 [existing]** Requester Ticket Detail already uses the authenticated identity end to
  end (no `requesterId` in any request body); `DevRequesterSelectPage`/`Change Requester` from Lab 2
  are a separate, isolated entry point (`/dev-requester-select`), not part of the authenticated app
  shell.
- **FR-18 [existing]** Requester Public Comments already work: the Public Comments tab and
  `CommentForm` in `TicketDetailView.tsx` are visible and usable by Requesters (not staff-gated).
- **FR-19 [existing]** Requesters already have a post-resolution loop: `Confirm Resolution`
  (`RESOLVED→CLOSED`) and `Reject Resolution` (`RESOLVED→REOPENED`), plus `Request Reopening`
  (`CLOSED→REOPENED`) — all Requester-triggered, all gated to `ticket.requesterId === req.user!.id`,
  and all only reachable once IT Staff has already formally resolved the ticket.
- **FR-20 [new]** "Problem Appears Resolved" (BR-05) is a distinct, new signal a Requester can
  raise on their own ticket **before** it reaches `RESOLVED` — it does not change `status` and does
  not let the Requester close anything (see §7 for exact semantics). This is the one genuinely
  missing piece of Requester Ticket Detail for Lab 3.

### Administrator User Management (Issue #45)

- **FR-21 [existing]** `GET /api/users` supports `q` (name/email), `role`, and `isActive` query
  filters server-side.
- **FR-22 [gap]** `UserManagementPage.tsx` only wires the `q` search box to the UI; the
  already-supported `role`/`isActive` filters have no controls (Issue #45).
- **FR-23 [existing]** `POST /api/users` creates a user with a server-generated temporary
  password (`mustChangePassword: true` always), rejecting duplicate emails with `409`.
- **FR-24 [gap]** `POST /api/users` does not accept an initial `isActive` value — new users are
  always created active. Handout §8.5 asks for activation state to be settable at creation; folded
  into Issue #45.
- **FR-25 [existing]** `PATCH /api/users/:id` edits `fullName`/`email`/`role`;
  `PATCH /api/users/:id/status` edits `isActive`; `POST /api/users/:id/reset-password` issues a new
  temporary password and sets `mustChangePassword: true`.
- **FR-26 [gap]** Neither `updateUser` nor `updateUserStatus` currently prevents an Administrator
  from deactivating their own account, or from deactivating/demoting the last active Administrator
  (Issue #45 — this is the most safety-critical gap in the whole spec).

## 6. Business Rules

| BR | Rule | Status |
|---|---|---|
| BR-01 | Only an active user with valid credentials may authenticate. | existing |
| BR-02 | A user marked as requiring a password change cannot use any endpoint under `enforcePasswordChange` until a new valid password is saved via `/api/auth/change-password`. | existing |
| BR-03 | The authenticated user identity, not a client-supplied id, determines ownership of Requester operations. | existing |
| BR-04 | Public Comments are visible to the Requester, IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator, enforced server-side. | existing |
| BR-05 | A Requester may flag that the problem appears resolved (see FR-20), but only IT Staff/Administrator can transition a Ticket to Resolved, and only IT Staff/Administrator or the owning Requester's post-resolution actions (Confirm/Reject, both gated to an already-Resolved ticket) can reach Closed. A Requester can never move a ticket directly into Resolved. | new (mechanism) / existing (the Closed-side guardrail) |
| BR-06 | Login failure for a nonexistent email, a wrong password, and an inactive account all return the identical `401 { error: "Invalid credentials" }` — account existence/status is never distinguishable from the response. | existing |
| BR-07 | Passwords are hashed with bcrypt (cost factor 10) before storage; the plaintext is never persisted or logged. A temporary password is returned exactly once, in the API response to the Administrator who created the account or reset the password. | existing |
| BR-08 | A newly created user or a password-reset target always has `mustChangePassword: true`. | existing |
| BR-09 | Logout is client-side token disposal (no server-side token blocklist in Lab 3); deactivating a user takes effect on that user's very next request regardless of token expiry, because `requireAuth` re-reads `isActive` from the database every time. | existing (decision, see §11) |
| BR-10 | A Ticket's `ownerId` must reference an active `IT_STAFF` or `ADMINISTRATOR` user, or be `null` (unassigned). A Requester can never be set as owner. | existing |
| BR-11 | Only IT Staff or Administrator may claim or reassign Ticket ownership, and only IT Staff or Administrator may change IT Priority. | existing |
| BR-12 | Requested Priority is set by the Requester at creation and editable by the Requester only while the Ticket is `NEW` or `IN_PROGRESS`. IT Priority defaults to the Requested Priority value at ticket creation and is thereafter changed only by IT Staff/Administrator. | new (default-copy) / existing (edit rule) |
| BR-13 | The required Ticket statuses are New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, and Cancelled; only the transitions listed in the matrix in §7 are permitted, each restricted to the roles shown there. | new (3 statuses + matrix) |
| BR-14 | Public Comments and Internal Notes are append-only in Lab 3 (no edit, no delete); empty or whitespace-only content is rejected (`z.string().min(1)`); each entry records its author and server-assigned `createdAt`. | existing |
| BR-15 | An Administrator may create a user with exactly one role (`REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`) — the schema has no concept of multiple roles per user. | existing |
| BR-16 | An Administrator cannot deactivate their own account. | new |
| BR-17 | The system must always retain at least one active Administrator: an update that would deactivate the last active Administrator, or change their role away from `ADMINISTRATOR`, is rejected. | new |
| BR-18 | Duplicate email addresses are rejected on user creation (`409`) via the database's unique constraint on `User.email`; the same check applies when editing a user's email. | existing (create) / to confirm on edit (Issue #45) |
| BR-19 | Users are deactivated, never deleted; there is no delete endpoint for `User`. | existing |
| BR-20 | An Administrator has every IT Staff Ticket capability in addition to user management (queue access, claim/reassign, IT Priority, status changes, Public Comments, Internal Notes) — this is a deliberate authorization-matrix decision, not an oversight; see §11. | existing (decision) |
| BR-21 | An Administrator does not need Requester-only actions (create ticket, edit Requested Priority, "Problem Appears Resolved") — those remain restricted to `REQUESTER`. | existing |
| BR-22 | A Requester's own client-supplied `requesterId` (if any were sent) is always ignored; ownership comes from the authenticated token (restates BR-03 for the regression-test angle in Issue #47). | existing |
| BR-23 | Existing Lab 2 Categories, Related Systems, Tickets, and Attachments remain valid and queryable after all Lab 3 migrations — no destructive schema change is permitted. | existing (constraint on Issue #42/#48) |

## 7. Ticket Status Transition Matrix (completes BR-13 / Issue #42)

| From | To | Trigger | Roles |
|---|---|---|---|
| New | Open | Acknowledge | IT Staff, Administrator |
| New | In Progress | Start Progress *(existing shortcut, kept)* | IT Staff, Administrator |
| New | Cancelled | Cancel Ticket | IT Staff, Administrator |
| Open | In Progress | Start Progress | IT Staff, Administrator |
| Open | Cancelled | Cancel Ticket | IT Staff, Administrator |
| In Progress | Waiting for Requester | Mark Waiting | IT Staff, Administrator |
| In Progress | Resolved | Resolve Ticket (requires `resolutionSummary`) | IT Staff, Administrator |
| Waiting for Requester | In Progress | Resume Progress | IT Staff, Administrator |
| Waiting for Requester | Resolved | Resolve Ticket (requires `resolutionSummary`) | IT Staff, Administrator |
| Resolved | Closed | Close Ticket | IT Staff, Administrator |
| Resolved | Closed | Confirm Resolution *(existing)* | Requester (ticket owner only) |
| Resolved | Reopened | Reject Resolution *(existing)* | Requester (ticket owner only) |
| Closed | Reopened | Request Reopening *(existing)* | Requester (ticket owner only) |
| Reopened | In Progress | Start Progress *(existing)* | IT Staff, Administrator |
| Reopened | Open | Acknowledge | IT Staff, Administrator |
| Cancelled | — | *(terminal in Lab 3 — no transition out)* | — |

No other transition is permitted; an unlisted `(from, to)` pair returns `409` with the same safe
error shape as the existing `updateTicketStatus` handler. Cancel is only reachable from New/Open
(a ticket already being actively worked is resolved or closed, not cancelled, in Lab 3).

## 8. UI Specification Summary

Full screen-by-screen detail (modes, controls, feedback states, responsive behavior) is in
`docs/lab-03/ui-spec.md`. Summary:

- **Login** — email/password (with a show/hide toggle), inline validation, busy Sign In state,
  generic invalid-credentials banner (BR-06) with an icon, a "Forgot your password?" link (shows a
  "contact your Administrator" message — no email-based reset per §3.2's exclusion), redirects to
  `/first-password-change` when `mustChangePassword`, else `/dashboard`.
- **Change Password** — current + new + confirm (each with a show/hide toggle), live rule
  checklist (≥8 chars, upper **and** lower case, a number and a special character — see §11.5),
  blocks navigation away until saved.
- **App shell** — `NavBar` shows the authenticated user's name/role and role-appropriate links
  only; `Logout` clears the token and redirects to `/login`.
- **Requester Dashboard / Create Ticket / Ticket Detail** — unchanged from Lab 2 except Ticket
  Detail gains the "Problem Appears Resolved" toggle (FR-20) next to the existing Public Comments
  panel.
- **IT Staff Dashboard (Queue)** — search box, status/owner/category filters (existing), plus new
  sort-column headers and pagination controls (FR-11); ownership/status/priority badges per Zen
  Green tokens.
- **IT Staff Ticket Detail** — extends the shared `TicketDetailView`; owner/IT-priority selectors,
  status action buttons per §7, Public Comments tab (open) and Internal Notes tab (staff-only, gated
  both by `isStaff` in the UI and by the server), visually distinguished (Internal Notes use a
  muted/amber panel per `ui-spec.md`, never the same visual treatment as Public Comments).
- **Administrator User Management** — table (Name, Email, Role, Status, Edit), search box, new role
  filter dropdown (FR-22), Create User panel (name, email, role, activation state, generated initial
  password shown once), Edit panel (name/email/role/active + Reset Password action), with the
  Deactivate control disabled on the signed-in Administrator's own row (BR-16) and a safe `409`-driven
  inline error if the last-Administrator rule (BR-17) is hit.

## 9. Data Changes

- `TicketStatus` enum gains `OPEN`, `WAITING_FOR_REQUESTER`, `CANCELLED` (additive, non-destructive
  Prisma migration; existing rows keep their current status value).
- `Ticket` gains `requesterAppearsResolvedAt DateTime?` (nullable, default `null`) — set/cleared by
  the Requester via the new endpoint in §10, read-only display for IT Staff (a badge/flag in the
  queue and ticket detail), never itself a status value.
- `Ticket.itPriority` gains a default-copy-on-create behavior at the application layer (not a schema
  default, since it must copy the submitted `requestedPriority`, not a fixed constant).
- No changes to `User`, `Category`, `RelatedSystem`, `PublicComment`, `InternalNote`, `Attachment`,
  or `ActionTaken`. All Lab 2 data (Tickets, Attachments, Categories, Related Systems) survives every
  Lab 3 migration untouched (BR-23).
- Seed data (`server/prisma/seed.ts`) currently has 1 Administrator, 1 IT Staff, 5 Requesters
  (4 active + 1 inactive — already meets the Requester minimum), and 1 sample Ticket. Lab 3 adds 2
  more active IT Staff + 1 inactive IT Staff (to meet "3 active + 1 inactive"), and a realistic
  spread of Tickets across all 8 statuses, both priorities, and assigned/unassigned ownership
  (Issue #48). Seeding remains `upsert`-based (idempotent, safe to re-run).

## 10. API Contract

Full endpoint-by-endpoint detail (request/response shapes, status codes, error bodies) is in
`docs/lab-03/api-spec.md`. New/changed endpoints introduced by this spec:

- `GET /api/tickets` — add `sort`, `order`, `page`, `pageSize` query params (FR-11).
- `PATCH /api/tickets/:id/requester-appears-resolved` — new, Requester-only, own ticket, body
  `{ appearsResolved: boolean }`, rejected with `409` if the ticket is already `RESOLVED`, `CLOSED`,
  or `CANCELLED` (FR-20).
- `PATCH /api/tickets/:id/status` — extend `ALLOWED_DIRECT_TRANSITIONS` per §7.
- `POST /api/tickets/:id/cancel` — new, staff-only, allowed only from `NEW`/`OPEN`.
- `PATCH /api/users/:id` / `PATCH /api/users/:id/status` — add BR-16/BR-17 guard checks, returning
  `409 { error: "..." }` with a specific, safe message for each rule.
- `POST /api/users` — accept an optional `isActive` field (default `true`) (FR-24).

## 11. Acceptance Criteria

| AC | Criterion |
|---|---|
| AC-01 | Given an active user with valid credentials, when they log in, the backend establishes authenticated access and returns their permitted identity and role. |
| AC-02 | Given a user who must change their initial password, when login succeeds, normal application screens stay unavailable (`403 PASSWORD_CHANGE_REQUIRED`) until a valid new password is saved. |
| AC-03 | Given an authenticated Requester, when the client supplies another user's id anywhere in a Requester-scoped request, the backend still applies the authenticated identity and never returns another Requester's data. |
| AC-04 | Given a Requester account, when an Internal Note endpoint is requested, the operation is rejected (`403`/`404` as appropriate) without exposing note content. |
| AC-05 | Given an inactive user, when they attempt to log in with correct credentials, the response is identical (`401 Invalid credentials`) to a wrong-password response. |
| AC-06 | Given an IT Staff or Administrator user, when they call `PATCH /:id/owner` with an inactive or Requester-role `ownerId`, the request is rejected `400`. |
| AC-07 | Given a Ticket in `NEW`, when a Requester calls the new appears-resolved endpoint, the ticket's `status` does not change and `requesterAppearsResolvedAt` is set. |
| AC-08 | Given a Ticket in `RESOLVED`, when a Requester calls the appears-resolved endpoint, the request is rejected `409`. |
| AC-09 | Given a Ticket in `IN_PROGRESS`, when IT Staff calls `PATCH /:id/status` with `WAITING_FOR_REQUESTER`, the transition succeeds; the reverse succeeds via "Resume Progress". |
| AC-10 | Given any `(from, to)` pair not listed in §7, when `PATCH /:id/status` is called, the response is `409` and `status` is unchanged. |
| AC-11 | Given a newly created Ticket, its `itPriority` equals the submitted `requestedPriority` immediately after creation. |
| AC-12 | Given the signed-in Administrator's own user id, when they call `PATCH /:id/status` with `isActive: false` on themselves, the request is rejected. |
| AC-13 | Given exactly one active Administrator, when an Administrator attempts to deactivate or demote that Administrator (even a different Administrator id equal to the last one), the request is rejected. |
| AC-14 | Given `GET /api/tickets` with `sort=itPriority&order=desc&page=2&pageSize=10`, the response returns the correct page slice in the requested order plus pagination metadata matching `GET /api/tickets/mine`'s shape. |
| AC-15 | Given a non-Administrator, when they call any `/api/users/*` endpoint, the response is `403`. |
| AC-16 | Given a Requester who is not the ticket's requester, when they call any Requester-only ticket action (priority edit, appears-resolved, confirm/reject-resolution, request-reopen) on someone else's ticket, the response is `404`. |
| AC-17 | Given valid duplicate-email input on `POST /api/users` or `PATCH /api/users/:id`, the response is `409` without leaking which existing user owns that email beyond the generic message. |
| AC-18 | Given a deactivated user's still-unexpired JWT, when they call any protected endpoint, `requireAuth` rejects with `401` (deactivation takes effect immediately, not only at token expiry). |

Every AC above maps to at least one row in `docs/lab-03/tests.md` (Issue #47/#49 for authorization
and E2E rows specifically).

## 12. Definition of Done

- [ ] `docs/lab-03/{specification,ui-spec,api-spec,tests,reviewer,ai-use}.md` complete and internally consistent.
- [ ] All 9 Lab 3 GitHub Issues closed, each merged into `lab3-staging` via a reviewed PR.
- [ ] Every BR in §6 and every transition in §7 has a passing automated test referenced in `tests.md`.
- [ ] `npx prisma migrate dev` runs cleanly against a copy of the current database with zero data loss (BR-23).
- [ ] `npm run seed` (or equivalent) is idempotent — running it twice produces no duplicates or errors.
- [ ] Full server + client + E2E test suite passes from a clean checkout of `lab3-staging`.
- [ ] Manual walkthrough of Login → forced password change → each of the three role dashboards →
      Logout → blocked direct access, on desktop, tablet, and mobile viewports, with screenshots
      captured under `artifacts/lab-03/screenshots/`.
- [ ] `lab3-staging` merged into `main` via a final reviewed PR (Issue #51), with
      `docs/lab-03/reviewer.md` showing real PR links, comments, responses, and approvals.

## 13. Assumptions and Decisions

1. **Administrator inherits full IT Staff ticket capability** (BR-20). The handout allows this "if
   the approved authorization matrix explicitly permits it" — we permit it, matching the code as
   found, because this is a small team/course project where a single Administrator account
   realistically also triages tickets; user account management stays the one thing *only*
   Administrators can do (§14/BR-15–19 are Administrator-exclusive).
2. **"Problem Appears Resolved" is a flag, not a status.** We chose a nullable timestamp
   (`requesterAppearsResolvedAt`) over a new status value so it composes with every existing status
   (a Requester can raise it while `IN_PROGRESS` or `WAITING_FOR_REQUESTER`) without adding a branch
   to the status transition matrix. This is distinct from — and does not replace — the existing
   Confirm/Reject-Resolution loop, which remains the mechanism for closing the loop **after** IT
   Staff formally resolves.
3. **No server-side logout/token blocklist.** A stateless JWT with client-side disposal is
   sufficient for this course stack; the existing live `isActive` re-check on every request already
   gives Administrator-driven deactivation an immediate effect, which covers the one case (a
   misbehaving or offboarded account) where "logout now" actually matters operationally.
4. **Login/inactive-account responses stay uniform** (`401 Invalid credentials` for all three
   failure causes) rather than adding a distinct "this account is inactive" message, per the
   handout's "clear response... without exposing unnecessary account information" — we read
   "clear" as clear *to a legitimate user who knows their own account state*, not as a distinct
   wire-level signal an attacker could use to enumerate accounts.
5. **Reversed: password rules now match the mockup's checklist.** Originally kept at the existing
   ≥8-character minimum (this decision was flagged here as open to revisiting if the reviewer
   disagreed) — the reviewer did, post-release, so `POST /api/auth/change-password` now also
   requires upper **and** lower case letters, a number, and a special character
   (`server/src/lib/passwordPolicy.ts`), with a live checklist on `FirstPasswordChangePage.tsx`
   matching the mockup exactly (show/hide toggle, per-requirement checkmarks). System-generated
   temporary passwords (`generateTempPassword.ts`) were updated to always satisfy the same policy.
6. **Cancel is one-way in Lab 3** (no "reopen a cancelled ticket") to keep the transition matrix
   small; nothing in the handout requires reopening a cancelled ticket, and Lab 4's Actions Taken
   gate only concerns Resolved/Closed.
