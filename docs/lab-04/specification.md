# Lab 4 Engineering Specification — Actions Taken, Dashboards, and Final Regression

## 1. Sprint Goal

Give IT Staff a structured way to plan and record the real work on a Ticket (Actions Taken), make
the backend refuse to resolve a Ticket until that work is actually finished, give every role a
concise dashboard that is calculated on the server and drills down into the existing lists, and
finish the product: every Lab 1–3 function still works, stale or duplicate updates are handled
safely, and the whole app looks and behaves like one Zen Green application on desktop, tablet, and
mobile.

## 2. Stakeholder Request (in our own words)

Comments and notes let people talk about a Ticket, but nobody can see *what was actually done*.
Each Ticket needs its own list of Actions Taken — when it happened, what was done, what the result
was, who did it (filled in automatically), whether a follow-up is still needed (and if so, what),
and where to find related files. The Ticket Owner still coordinates the Ticket, but any IT Staff
member may record or carry out an action. A Requester saying "it looks fixed" is only a hint — IT
Staff decide when a Ticket is formally Resolved, and they should not be able to do that while
recorded work is still open. Requesters and IT Staff each get a short dashboard that answers "what
needs my attention?" and links straight into the detailed screens. Finally, polish and harden
everything built in Labs 1–3 so it all keeps working.

## 3. Scope

### 3.1 Included

- Actions Taken: list, create, view/edit, assign, start, complete, cancel — staff-only writes,
  Requester read-only view on owned Tickets.
- Final Ticket status-transition matrix (§7) with a backend resolution gate tied to Actions Taken,
  an append-only Ticket status history, and stale-update (optimistic concurrency) protection.
- Requester Dashboard, IT Staff Dashboard, Administrator Dashboard (staff dashboard + user counts),
  with backend-calculated metrics and drill-down into My Tickets / Ticket Queue.
- Role navigation with active-page indication; My Tickets and Ticket Queue move to their own routes.
- Non-destructive Prisma migration + backfill, idempotent seed with 0 / 1 / many Actions Taken.
- Hardening: double-submit and retry protection, form data preserved on recoverable failures,
  consistent loading/empty/forbidden/conflict/not-found/safe-failure feedback, full Labs 1–3
  regression, E2E, screenshots, README.

### 3.2 Explicitly excluded (handout §4.2)

SLA clocks/escalation/on-call/breach notifications; email/SMS/LINE/push notifications; inventory,
spare parts, purchasing, cost accounting; time-sheets, billing, payroll, labor cost; multi-level
approvals and e-signatures; BI tools, custom report builders, exports; multi-tenant and
production-scale cloud operations; deleting Actions Taken, Comments, Notes or status history; file
upload *inside* an Action Taken (Attachment Notes is free text pointing to files in the existing
Attachments tab); any feature not listed in §3.1.

## 4. Starting-state note

Lab 4 does not start from zero. Read against the code on `main` at commit `4a13b87`:

- `ActionTaken` already exists (`server/prisma/schema.prisma`) with only `ticketId`, `authorId`,
  `description`, timestamps; `POST /api/tickets/:id/actions` and `PATCH .../actions/:actionId`
  exist (staff-only) but validate only `description`, never check the Ticket's status, and have no
  concurrency control. The Ticket Detail "Service Actions" tab shows a single text box.
- `RequesterDashboardPage.tsx` and `ItStaffDashboardPage.tsx` are really the **My Tickets** list and
  the **Ticket Queue** — there are no metric dashboards yet.
- `resolveTicket` only checks the current status; Lab 3 spec §3.2 explicitly deferred the
  "block resolution while Actions Taken are incomplete" rule to Lab 4.
- Workflow endpoints use read-then-write (`findUnique` → `update`), so two staff members changing
  the same Ticket at once can silently overwrite each other.

Tags below: **[existing]** already works (regression only), **[changed]** extends existing code,
**[new]** net-new.

## 5. Functional Requirements

### Actions Taken (Issue #65 API, #66 UI)

- **FR-01 [changed]** Each Action Taken stores: Action Date/Time, Action Description, Result,
  Performed By (automatic — the authenticated user who records it), Assigned To, Action Status,
  Follow-Up Required?, Follow-Up Note, Attachment Notes, plus created/updated timestamps and a
  `version`.
- **FR-02 [new]** `GET /api/tickets/:id/actions` lists a Ticket's Actions Taken in stable order
  (Action Date/Time ascending, then id ascending). Staff may read any Ticket's; a Requester only
  their own Ticket's (others → `404`).
- **FR-03 [changed]** `POST /api/tickets/:id/actions` (IT Staff/Administrator) creates an Action
  Taken with full validation (§6 BR-03…BR-12).
- **FR-04 [changed]** `PATCH /api/tickets/:id/actions/:actionId` (IT Staff/Administrator) edits
  fields, reassigns, and moves the action status, requiring the last-seen `version`.
- **FR-05 [new]** Ticket Detail shows an Actions Taken area with a list/table, Create mode, and
  View/Edit mode; Requesters see every Action Taken (all fields) read-only with no write controls.
- **FR-06 [new]** A retried create carrying the same `clientRequestId` returns the action already
  created instead of a duplicate.

### Ticket workflow (Issue #67)

- **FR-07 [changed]** Ticket transitions follow the final matrix in §7; only permitted transitions
  are shown in the UI and accepted by the API.
- **FR-08 [new]** The backend refuses to resolve a Ticket that fails the resolution gate (BR-15),
  whichever client calls it.
- **FR-09 [new]** Every successful status change appends a Ticket Status History record (from,
  to, who, when). History is shown on Ticket Detail to every role that can see the Ticket and has
  no edit/delete endpoint.
- **FR-10 [new]** Workflow endpoints accept the Ticket's last-seen `version` and reject a stale one
  with `409 STALE_UPDATE`; the transition itself is a conditional update, so two simultaneous
  transitions from the same status cannot both succeed.
- **FR-11 [existing]** Requester "Problem Appears Resolved" stays advisory: it never changes status.

### Dashboards (Issue #68)

- **FR-12 [new]** `GET /api/dashboard/requester` returns the metrics, attention-required list, and
  recent Tickets of the authenticated Requester only.
- **FR-13 [new]** `GET /api/dashboard/staff` returns operational metrics, IT Priority breakdown,
  the current user's recent Tickets, and the current user's open Actions Taken; for an
  Administrator it also returns user-account counts.
- **FR-14 [new]** Every metric carries a drill-down link; My Tickets (`/tickets`) and Ticket Queue
  (`/queue`) read `status`, `statusGroup`, `ownerId`, and `itPriority` from the URL so the drill-down
  shows exactly the counted Tickets.
- **FR-15 [new]** Role navigation: Requester → Dashboard, My Tickets, Create Ticket; IT Staff →
  Dashboard, Ticket Queue; Administrator → IT Staff links + Users, Reference Data. The current page
  is marked with `aria-current="page"` and a visible underline.

### Hardening (Issue #69)

- **FR-16 [new]** Write buttons are disabled while their request is in flight (no double submit).
- **FR-17 [new]** Action Taken, comment, note and resolve forms keep entered text after a
  recoverable failure (validation, conflict, network).
- **FR-18 [changed]** Loading, validation, success, empty/no-results, forbidden, conflict,
  not-found and safe API-failure feedback use the shared components consistently.
- **FR-19 [existing]** All Labs 1–3 screens and APIs keep working for their permitted roles
  (authentication, My Tickets, Create Ticket, Ticket Detail, Attachments, Public Comments, Internal
  Notes, IT Staff Queue, User Management, Reference Data).

## 6. Business Rules

| BR | Rule | Status |
|---|---|---|
| BR-01 | An Action Taken belongs to exactly one Ticket (`ticketId` NOT NULL FK; never moved to another Ticket). | existing (FK) |
| BR-02 | The Ticket Owner coordinates the Ticket, but an Action Taken may be performed by and assigned to a different IT Staff member or Administrator. | new |
| BR-03 | Performed By is set by the server from the authenticated user at creation and can never be changed or supplied by the client. | changed |
| BR-04 | Only IT Staff and Administrators create or update Actions Taken. Requesters read Actions Taken on their own Tickets only. Enforced by the backend. | changed |
| BR-05 | Assigned To defaults to Performed By and must be an **active** IT Staff or Administrator user; anything else is rejected `400`. | new |
| BR-06 | Action Description is required, 1–2000 characters after trimming. Result and Follow-Up Note ≤ 2000, Attachment Notes ≤ 500 characters. | new |
| BR-07 | When Follow-Up Required is true, a non-blank Follow-Up Note is required. When it is false, any Follow-Up Note is cleared. | new |
| BR-08 | Action Status is Planned, In Progress, Completed or Cancelled. Permitted moves: Planned → In Progress / Completed / Cancelled; In Progress → Completed / Cancelled. Completed and Cancelled are terminal and read-only (edits → `409`). A new action may start as Planned, In Progress or Completed. | new |
| BR-09 | Completing an action requires a non-blank Result; `completedAt` is set by the server. `cancelledAt` is set on cancel. | new |
| BR-10 | Action Date/Time is required (defaults to now), may not be earlier than the Ticket's creation time, and may not be more than 5 minutes in the future unless the status is Planned (planned work may be scheduled ahead). | new |
| BR-11 | Actions Taken can only be created or edited while the Ticket is New, Open, In Progress, Waiting for Requester, or Reopened; Resolved, Closed and Cancelled Tickets are read-only for actions (`409`). | new |
| BR-12 | Actions Taken are never deleted; a mistaken action is Cancelled. An edit must send the `version` it was based on; a mismatch returns `409 STALE_UPDATE` with the current action and changes nothing. | new |
| BR-13 | A create that repeats an earlier `clientRequestId` for the same Ticket returns the original action (`200`) instead of creating a duplicate. | new |
| BR-14 | The Ticket statuses remain New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled; only transitions in §7 are permitted, each by the roles shown. | existing (Lab 3 BR-13) |
| BR-15 | **Resolution gate:** a Ticket may move to Resolved only if it has at least one Completed Action Taken and no Planned or In Progress Action Taken, and a non-blank Resolution Summary is supplied. Otherwise `409 RESOLUTION_GATE` (or `400` for a missing summary). | new |
| BR-16 | A Requester's "Problem Appears Resolved" signal is advisory and never changes status; only IT Staff/Administrators can resolve. | existing (Lab 3 BR-05) |
| BR-17 | Cancelling a Ticket (New/Open only) also cancels its Planned/In Progress Actions Taken in the same transaction. | new |
| BR-18 | Every successful Ticket status change appends exactly one Ticket Status History row (from, to, changed by, server time). Ticket creation appends the initial `— → New` row. History rows are never updated or deleted. | new |
| BR-19 | Workflow writes (status, resolve, close, cancel, owner, IT Priority, Requester confirm/reject/reopen) increment the Ticket `version`. If the client sends a `version` that is not current, the write is rejected `409 STALE_UPDATE`. | new |
| BR-20 | All dashboard numbers are calculated by the backend from the database at request time; the client never counts Tickets itself. | new |
| BR-21 | **Open status group** = New, Open, In Progress, Waiting for Requester, Reopened. "Open" metrics and lists use this group. | new |
| BR-22 | "Today" on dashboards means the current calendar day in **Asia/Bangkok** (UTC+7, no DST): from 00:00 Bangkok time to now. | new |
| BR-23 | A Requester dashboard only ever counts or lists Tickets whose `requesterId` is the authenticated user. | new |
| BR-24 | Legacy data: Actions Taken created before Lab 4 are backfilled as Completed, assigned to their author, with Action Date/Time = their creation time. Tickets without Actions Taken stay valid; they simply cannot be resolved until an action is completed. Legacy Tickets without status history contribute 0 to "+N today" deltas. | new |
| BR-25 | Administrators have every IT Staff capability (Lab 3 BR-20), plus user-account counts on their dashboard. | existing + new |

## 7. Final Ticket Status Transition Matrix

| From | To | Trigger / endpoint | Roles | Extra rule |
|---|---|---|---|---|
| — | New | Create Ticket `POST /tickets` | Requester | history row `— → New` |
| New | Open | Acknowledge `PATCH /:id/status` | IT Staff, Admin | |
| New | In Progress | Start Progress `PATCH /:id/status` | IT Staff, Admin | |
| New | Cancelled | Cancel `POST /:id/cancel` | IT Staff, Admin | BR-17 |
| Open | In Progress | Start Progress | IT Staff, Admin | |
| Open | Cancelled | Cancel | IT Staff, Admin | BR-17 |
| In Progress | Waiting for Requester | Mark Waiting | IT Staff, Admin | |
| In Progress | Resolved | Resolve `POST /:id/resolve` | IT Staff, Admin | **BR-15 gate** |
| Waiting for Requester | In Progress | Resume Progress | IT Staff, Admin | |
| Waiting for Requester | Resolved | Resolve | IT Staff, Admin | **BR-15 gate** |
| Resolved | Closed | Close `POST /:id/close` | IT Staff, Admin | |
| Resolved | Closed | Confirm Resolution | Requester (own) | |
| Resolved | Reopened | Reject Resolution | Requester (own) | |
| Closed | Reopened | Request Reopening | Requester (own) | |
| Reopened | Open | Acknowledge | IT Staff, Admin | |
| Reopened | In Progress | Start Progress | IT Staff, Admin | |
| Cancelled | — | terminal | — | |

Any other `(from, to)` pair returns `409`. Every row is subject to BR-18 (history) and BR-19
(stale `version`).

## 8. Dashboard Calculations

All counts are `COUNT(*)` over `Ticket` (or `ActionTaken`) with the filters below; `me` = the
authenticated user. Drill-down links are client routes whose query string maps 1:1 to the list API.

### 8.1 Requester Dashboard (`requesterId = me` on every query)

| Key | Label | Query | Drill-down |
|---|---|---|---|
| `open` | My Open Tickets | status ∈ Open group (BR-21) | `/tickets?statusGroup=open` |
| `inProgress` | In Progress | status = IN_PROGRESS | `/tickets?status=IN_PROGRESS` |
| `waitingForMe` | Waiting for Me | status = WAITING_FOR_REQUESTER | `/tickets?status=WAITING_FOR_REQUESTER` |
| `resolved` | Resolved | status = RESOLVED | `/tickets?status=RESOLVED` |
| `closed` | Closed | status = CLOSED | `/tickets?status=CLOSED` |

Lists: **Needs your attention** = status ∈ {WAITING_FOR_REQUESTER, RESOLVED}, oldest `updatedAt`
first, max 5. **My Recent Tickets** = all own Tickets by `updatedAt` desc, max 5.
**Recently Resolved** = `resolvedAt` within the last 7 days, newest first, max 5.

### 8.2 IT Staff / Administrator Dashboard (all Tickets)

| Key | Label | Query | "+N today" delta | Drill-down |
|---|---|---|---|---|
| `new` | New | status = NEW | history rows to NEW today | `/queue?status=NEW` |
| `open` | Open | status = OPEN | history rows to OPEN today | `/queue?status=OPEN` |
| `inProgress` | In Progress | status = IN_PROGRESS | rows to IN_PROGRESS today | `/queue?status=IN_PROGRESS` |
| `waitingForRequester` | Waiting for Requester | status = WAITING_FOR_REQUESTER | rows to WAITING today | `/queue?status=WAITING_FOR_REQUESTER` |
| `myAssigned` | My Assigned | ownerId = me AND status ∈ Open group | — | `/queue?ownerId=me&statusGroup=open` |
| `unassigned` | Unassigned | ownerId IS NULL AND status ∈ Open group | — | `/queue?ownerId=unassigned&statusGroup=open` |

- **By IT Priority**: Open-group Tickets grouped by `itPriority` (URGENT, HIGH, MEDIUM, LOW, Not
  set) → `/queue?statusGroup=open&itPriority=<P|unset>`.
- **My Recent Tickets**: `ownerId = me`, `updatedAt` desc, max 5 → View all `/queue?ownerId=me`.
- **My Open Actions Taken**: actions with `assigneeId = me` and status ∈ {PLANNED, IN_PROGRESS},
  `actionAt` asc, max 5, plus the total count; each row links to its Ticket Detail.
- **Administrator only** — `userCounts`: active Requesters, active IT Staff, active Administrators,
  inactive accounts → `/admin/users`. IT Staff receive `userCounts: null`.

Empty behavior: a zero count is returned as `0` (never omitted) and rendered as `0` with a muted
"Nothing here" hint; empty lists render the shared empty state. No query ever returns a full Ticket
collection — lists are capped at 5 rows with only summary fields.

## 9. UI Specification Summary

Full detail in `docs/lab-04/ui-spec.md`.

- **App shell** — Zen Green navbar with role links (FR-15), active-page underline +
  `aria-current`, user name/role and Log out on the right. The Lab 2 "Change Requester" navbar
  button is removed (the dev-only `/dev-requester-select` route stays reachable by URL for
  development, but is no longer part of the product shell).
- **Requester Dashboard** (`/dashboard`) — "Welcome, <first name>!" header, 5 metric cards with
  "View all", My Recent Tickets list, Needs your attention list, Quick Actions (Create Ticket, View
  My Tickets).
- **IT Staff Dashboard** (`/dashboard`) — "Welcome back, <first name>!" header with Refresh,
  6 metric cards with "+N today", My Recent Tickets, My Open Actions Taken, By IT Priority, Quick
  Actions (Ticket Queue, Unassigned, My Queue); Administrator adds a User Accounts card.
- **My Tickets** (`/tickets`) and **Ticket Queue** (`/queue`) — Lab 2/3 lists, unchanged except
  they read filters from the URL and show a "Filtered from dashboard" chip with Clear.
- **Ticket Detail** — Actions Taken tab (table on ≥ md, stacked cards on mobile; Add Action button
  opens Create mode; row "View / Edit" opens a form panel; Requester read-only), Status History
  tab, status controls showing only §7 transitions, resolution gate hint ("Complete all open
  Actions Taken before resolving"), conflict banner with Reload.

## 10. Data Changes

### 10.1 Models

`ActionTaken` (extended, non-destructive):

| Field | Type | Notes |
|---|---|---|
| `actionAt` | `DateTime` default now | Action Date/Time; backfill = `createdAt` |
| `description` | `Text` | existing |
| `result` | `Text?` | required to complete |
| `authorId` | `Int` FK User | existing column, exposed as **Performed By** |
| `assigneeId` | `Int?` FK User `SetNull` | backfill = `authorId` |
| `status` | enum `ActionStatus` default `PLANNED` | backfill = `COMPLETED` |
| `followUpRequired` | `Boolean` default false | |
| `followUpNote` | `Text?` | |
| `attachmentNotes` | `String? (500)` | |
| `clientRequestId` | `String?` | `@@unique([ticketId, clientRequestId])` |
| `version` | `Int` default 1 | optimistic concurrency |
| `completedAt` / `cancelledAt` | `DateTime?` | backfill `completedAt = updatedAt` |

Indexes: `(ticketId, actionAt)`, `(assigneeId, status)`.

`Ticket` gains `version Int @default(1)` and index `(updatedAt)`.

`TicketStatusChange` (new, append-only): `id`, `ticketId` FK Cascade, `fromStatus TicketStatus?`,
`toStatus TicketStatus`, `changedById` FK User Restrict, `createdAt`; indexes
`(ticketId, createdAt)` and `(toStatus, createdAt)`.

### 10.2 Justified design decisions

1. **Extend `ActionTaken` instead of creating a new table.** Rows already exist in dev databases
   and are referenced by the Ticket Detail payload; renaming/re-creating would lose data and break
   Lab 3 regression. Every new column is nullable or defaulted, so the migration is additive.
2. **Action status as a Postgres enum, not free text or a reference table.** The four values drive
   business rules (BR-08, BR-15) that live in code, so an enum gives DB-level integrity and Prisma
   type safety; a reference table would let an Administrator invent a status the gate doesn't know.
3. **Integer `version` columns for optimistic concurrency** (not `updatedAt` comparison):
   timestamps have millisecond collisions and serialize lossily through JSON; an integer compared
   inside the `UPDATE … WHERE id = ? AND version = ?` is exact and race-free.
4. **Separate append-only `TicketStatusChange` table** rather than deriving "+N today" from
   `Ticket.updatedAt`: `updatedAt` changes on any edit (priority, owner), so it cannot tell *when a
   Ticket entered a status*; a history table can, and it doubles as the audit trail (FR-09).
5. **`clientRequestId` with a composite unique index** for retry-safe creates: the DB, not the
   application, guarantees no duplicate from a network retry, and Postgres allows many `NULL`s so
   older clients still work.

### 10.3 Migration, backfill, rollback

- Migration `20261006000000_lab4_actions_taken_workflow`: create enum + columns + table + indexes;
  `UPDATE "ActionTaken" SET status='COMPLETED', "actionAt"="createdAt", "assigneeId"="authorId",
  "completedAt"="updatedAt", result='Recorded before Lab 4 (no result captured).'`. Existing Users,
  Tickets, Attachments, Public Comments, Internal Notes are untouched.
- Rollback/recovery: the migration is additive, so the documented recovery is (1) `pg_dump` before
  `prisma migrate deploy` (README), and (2) a hand-written `down.sql` committed beside the migration
  that drops the new table, columns, indexes and enum — tested against the test DB in
  `server/tests/lab-04/migration-seed.test.ts` by checking the backfill result, and manually once
  (documented in `tests.md`).

### 10.4 Seed

Idempotent (`upsert` / existence checks / `clientRequestId = 'seed-…'`). Adds Tickets in Open,
Waiting for Requester and Cancelled so all 8 statuses exist; Actions Taken: 0 on several Tickets,
1 on `TKT-SAMPLE-000003`, many (by three different staff, mixed statuses, one with follow-up) on
`TKT-SAMPLE-000001`. Gives non-zero and zero metrics (e.g. Jennifer has 0 Closed, Ivy has open
Actions assigned, Sofia has none).

## 11. API Contract

Full detail in `docs/lab-04/api-spec.md`. New/changed:

- `GET /api/tickets/:id/actions` — new. `POST /api/tickets/:id/actions` — changed body.
  `PATCH /api/tickets/:id/actions/:actionId` — changed body, requires `version`.
- `POST /api/tickets/:id/resolve` — adds gate (BR-15). All workflow endpoints accept `version`.
- `GET /api/tickets/:id` — adds `version`, full Actions Taken, `statusHistory`.
- `GET /api/tickets`, `GET /api/tickets/mine` — add `statusGroup=open` and (`/tickets`) `itPriority`.
- `GET /api/dashboard/requester`, `GET /api/dashboard/staff` — new.
- Error shape stays `{ error: string }`, with an optional machine `code`
  (`VALIDATION_ERROR`, `STALE_UPDATE`, `RESOLUTION_GATE`, `INVALID_TRANSITION`, `TICKET_LOCKED`).

## 12. Acceptance Criteria

| AC | Criterion |
|---|---|
| AC-01 | Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with Performed By = the authenticated user and the approved assignee (default: same user). |
| AC-02 | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and lists for Tickets owned by that Requester are returned. |
| AC-03 | Given IT Staff in the browser, when they add an Action Taken, complete it, and resolve the Ticket, then the Actions Taken list and the Ticket status update without a page reload. |
| AC-04 | Given Follow-Up Required = true and a blank Follow-Up Note, when an action is created or edited, then it is rejected `400` and nothing is saved. |
| AC-05 | Given an action moved to Completed without a Result, the request is rejected `400`. |
| AC-06 | Given an `assigneeId` that is inactive, a Requester, or unknown, create/edit is rejected `400`. |
| AC-07 | A Requester gets `403` on create/edit of Actions Taken; can list them on an own Ticket; gets `404` for another Requester's Ticket. |
| AC-08 | Given an edit with a stale `version`, the response is `409 STALE_UPDATE` with the current action and nothing changes. |
| AC-09 | Given a Completed or Cancelled action, any further edit is rejected `409`; illegal action-status moves (e.g. Completed → Planned) are rejected `409`. |
| AC-10 | Given a Ticket with an open (Planned/In Progress) action, or no Completed action, resolve returns `409 RESOLUTION_GATE` and the status is unchanged — also when called directly against the API. |
| AC-11 | Given a Requester, "Problem Appears Resolved" leaves status unchanged and `POST /resolve` returns `403`. |
| AC-12 | Each successful transition appends exactly one status-history row in order; there is no endpoint to edit or delete history. |
| AC-13 | Given a stale Ticket `version` on any workflow endpoint, the response is `409 STALE_UPDATE`; two concurrent resolves of the same Ticket produce exactly one success. |
| AC-14 | Any transition not in §7 returns `409` and leaves status unchanged (Labs 3 regression). |
| AC-15 | Staff dashboard counts equal the corresponding database counts; My Assigned differs per signed-in staff member. |
| AC-16 | Requester → staff dashboard `403`; IT Staff → requester dashboard `403`; no token → `401`. |
| AC-17 | A user with no matching Tickets gets `0` for every metric and empty lists, not an error. |
| AC-18 | For every metric, calling the list API with the metric's drill-down query returns `totalCount` equal to the metric value. |
| AC-19 | An Administrator's staff dashboard includes `userCounts`; an IT Staff user's has `userCounts: null`. |
| AC-20 | Two creates with the same `clientRequestId` produce one row; the second returns `200` with the same id. |
| AC-21 | After migration, legacy actions are Completed, assigned to their author, `actionAt = createdAt`; the seed runs twice without duplicates and produces Tickets with 0, 1 and many actions. |
| AC-22 | Cancelling a Ticket cancels its open Actions Taken. |
| AC-23 | Actions are rejected `409` on Resolved, Closed, Cancelled Tickets. |
| AC-24 | In the UI, the Action form shows inline validation, keeps entered data after a server failure, disables Save while saving; Requesters see no Add/Edit controls. |
| AC-25 | In the UI, status controls show only §7 transitions for the role and status; after success the summary status badge and history refresh. |
| AC-26 | Dashboards render loading, populated, empty, forbidden and error states; each card's "View all" opens the filtered list. |
| AC-27 | Dashboards, Ticket Detail (Actions Taken) and lists have no horizontal page overflow at 375, 768 and 1280 px. |
| AC-28 | All Labs 1–3 server, client and E2E tests pass on the Lab 4 code (updated only where Lab 4 intentionally changes behavior, e.g. the resolution gate). |
| AC-29 | Dashboard endpoints respond within 1000 ms on seed data (performance smoke). |

Every AC maps to at least one test in `docs/lab-04/tests.md`.

## 13. Product Definition of Done

- [ ] `docs/lab-04/{specification,ui-spec,api-spec,tests,reviewer,ai-use}.md` complete, consistent.
- [ ] All Lab 4 Issues (#64–#70) closed; each feature merged into `lab4-staging` by a PR with a
      review recorded on GitHub, then `lab4-staging` → `main`.
- [ ] Every BR/AC has a passing automated test listed in `tests.md` with its real file path.
- [ ] `prisma migrate deploy` applies cleanly to a DB holding Lab 3 data with zero data loss;
      `down.sql` documented.
- [ ] Seed is idempotent and demonstrates zero and non-zero metrics.
- [ ] Full server + client + E2E suites pass from a clean checkout of `main`.
- [ ] No console errors, broken links, placeholder text, or unfinished controls in the product
      shell; README setup/migrate/seed/test/demo instructions current.
- [ ] Desktop/tablet/mobile screenshots of every Lab 4 screen under `artifacts/lab-04/screenshots/`
      and the visual/accessibility checklist in `ui-spec.md` completed.
- [ ] Lab 4 Kanban: all Issues Done.

## 14. Assumptions and Decisions

1. **Assignee added although the stakeholder field list omits it.** The handout's grading (Part 6:
   "assign … inactive-assignee rejection") and AC-01 ("approved assignee") require it. Performed By
   is *who recorded it* (automatic); Assigned To is *who is responsible for carrying it out*.
2. **Action statuses added** for the same reason (Part 6: "status transition, complete, cancel")
   and because the resolution gate needs a definition of "finished work".
3. **Resolution requires at least one Completed action.** "IT Staff must review the work and
   formally update the Ticket" — resolving a Ticket with no recorded work would make the gate
   meaningless. Consequence: Lab 3 tests that resolved Tickets directly now first record a Completed
   action (documented in `tests.md` as an intentional regression update).
4. **Requesters see every Action Taken field.** Handout §8.3 says "Requesters will see all Actions
   Taken items"; anything staff-only belongs in Internal Notes.
5. **`version` is optional on legacy workflow endpoints** (backward compatible with Lab 3 clients
   and tests) but the Lab 4 UI always sends it; **required** on the new Action Taken PATCH.
6. **Bangkok time zone** for "today" because the service desk is at KMUTT; stored timestamps stay UTC.
7. **"+N today"** replaces the mockup's "from yesterday" wording: it is exactly computable from the
   history table, whereas "change since yesterday" would need a daily snapshot table (BI scope,
   excluded by §4.2).
