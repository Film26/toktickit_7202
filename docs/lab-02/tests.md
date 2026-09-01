# Lab 2 Test Plan and Results — Requester-Facing Slice

Written against tests that actually exist and that were actually run in this session. `server/tests/lab-02/`, `client/tests/lab-02/`, and `e2e/lab-02/` now exist as dedicated Lab-2-scoped suites, alongside the pre-existing `server/tests/full-app/` and `client/tests/full-app/` suites (which still cover the same Requester behavior plus the IT Staff/Admin/lifecycle features that are legitimately out of Lab 2 scope but real and needed for later labs — they were left untouched). Test IDs below are labels assigned for traceability, not identifiers that exist in the code.

## 1. Test Strategy

Three layers of coverage now exist for the Requester-facing slice:

- **API tests** (Vitest + Supertest against the real Express app + a `.env.test` Postgres database): `server/tests/lab-02/create-ticket.api.test.ts`, `my-tickets.api.test.ts`, `ticket-detail.api.test.ts`, `attachments.api.test.ts`. These are new, Lab-2-scoped files — not copies of `server/tests/full-app/*` — that isolate the Requester-only endpoints and add the `POST /api/requesters/dev-select` coverage that didn't exist anywhere before this session.
- **Client component tests** (React Testing Library against a mocked `fetch`): `client/tests/lab-02/CreateTicket.test.tsx`, `MyTickets.test.tsx`, `RequesterTicketDetail.test.tsx`, `AttachmentSection.test.tsx`. There is no standalone "AttachmentSection" component in the codebase — attachment list/upload/remove UI lives inline inside `client/src/components/TicketDetailView.tsx` — so `AttachmentSection.test.tsx` exercises that behavior through `TicketDetailView`, as instructed by the test plan for cases where the UI concern isn't a separable component.
- **End-to-end test** (Playwright, new `e2e/` package at the repo root, its own `package.json` and `playwright.config.ts`): `e2e/lab-02/requester-ticket-flow.spec.ts` drives a real Chromium browser against the actual dev-mode API and client dev servers (auto-started by Playwright's `webServer` config), backed by the existing dev Postgres database.

There is still no visual/style assertion library and no automated responsive-layout check — screenshots (Section 4) are the only responsive/visual evidence, and some of those are stale (see Section 4 and 7).

## 2. Planned vs. Actual Test Table

All "Actual test file" paths below were run in this session; the Status column reflects what was actually observed, not an assumption.

| Test ID | Type | AC | What it tests | Actual test file | Status |
|---|---|---|---|---|---|
| API-01 | API | AC-01 | Create a valid ticket; 201, status NEW, ticketNumber matches `TKT-\d{4}-\d{6}`, and two creations never collide | `server/tests/lab-02/create-ticket.api.test.ts` ("creates a ticket with a unique ticketNumber and NEW status") | Pass |
| API-01b | API | AC-01 | `requestedPriority` defaults to MEDIUM when omitted | `server/tests/lab-02/create-ticket.api.test.ts` ("defaults requestedPriority to MEDIUM when omitted") | Pass |
| API-01c | API | FR-01 | Missing categoryId/summary/description each independently 400 | `server/tests/lab-02/create-ticket.api.test.ts` ("rejects a ticket missing categoryId, summary, or description with 400") | Pass |
| API-02 | API | AC-02 | Non-Requester role creating a ticket is rejected (403); no auth header is rejected (401) | `server/tests/lab-02/create-ticket.api.test.ts` ("rejects ticket creation from a non-Requester role", "requires authentication") | Pass |
| API-03 | API | AC-03 | A different Requester gets 404 on someone else's ticket; malformed id gets 400 | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-04 | API | AC-04 | Owning Requester gets 200, correct fields, and no `internalNotes` field | `server/tests/lab-02/ticket-detail.api.test.ts` ("returns 200 with the full ticket payload...") | Pass |
| API-05 | API | AC-05 | Requester can change priority in NEW/IN_PROGRESS; blocked (409) once RESOLVED; blocked for a non-owner (403) | `server/tests/full-app/tickets.test.ts` ("lets the owning requester change requested priority...") | Pass |
| API-06 | API | AC-06 | Resolved ticket: confirm → CLOSED | `server/tests/full-app/tickets.test.ts` ("walks through resolve -> confirm -> closed") | Pass |
| API-06b | API | AC-06 | Resolved ticket: reject → REOPENED | `server/tests/full-app/tickets.test.ts` ("...reject-resolution reopens it") | Pass |
| API-07 | API | AC-07 | Closed ticket: request-reopen → REOPENED | `server/tests/full-app/tickets.test.ts` ("lets the requester request reopening...") | Pass |
| API-08 | API | AC-08 | `GET /api/tickets/mine` scoped to caller only, staff role rejected (403), no auth rejected (401) | `server/tests/lab-02/my-tickets.api.test.ts` ("is scoped to the caller only...", "rejects staff roles...", "requires authentication") | Pass |
| API-08b | API | BR-09 (superseded — see note) | Search, sort asc/desc, status filter, pagination metadata, zero-tickets vs. zero-matches distinction | `server/tests/lab-02/my-tickets.api.test.ts` (5 tests) | Pass |
| API-09 | API | FR-09 | Public category/related-system list excludes inactive rows | `server/tests/full-app/referenceData.test.ts` | Pass |
| API-10 | API | BR-03 | Login returns a JWT + user profile; rejects bad credentials, unknown email, inactive account | `server/tests/full-app/auth.test.ts` | Pass |
| API-11 | API | BR-03 | `POST /api/requesters/dev-select`: mints a same-shape-as-login session for an active Requester; the returned token actually authenticates | `server/tests/lab-02/create-ticket.api.test.ts` ("mints a session for an active Requester...") | Pass |
| API-11b | API | BR-03 | dev-select never leaks `password`/`passwordHash` in the response | `server/tests/lab-02/create-ticket.api.test.ts` ("never returns a password or passwordHash field...") | Pass |
| API-11c | API | BR-03 | dev-select 404s for: inactive Requester, non-existent id, valid-but-non-Requester id (IT Staff) | `server/tests/lab-02/create-ticket.api.test.ts` (3 tests) | Pass |
| API-11d | API | BR-03 | dev-select 400s for missing/non-numeric/negative requesterId | `server/tests/lab-02/create-ticket.api.test.ts` ("400s for a missing or invalid requesterId") | Pass |
| API-12 | API | FR-07 | Attachment upload (valid PNG), reject unsupported type, reject >5 MB, 6th active attachment rejected (409, cap of 5) | `server/tests/lab-02/attachments.api.test.ts` (4 tests) | Pass |
| API-12b | API | FR-07 | Owning Requester downloads an active attachment; soft-remove retains metadata, flips `isActive`, records `removedBy`/`removedReason`; download of a removed attachment returns 410 (not 404) | `server/tests/lab-02/attachments.api.test.ts` ("lets the owning requester download...", "soft-removes an attachment...") | Pass |
| API-12c | API | FR-07 | A slot freed by soft-removal allows a new upload even at the previous cap | `server/tests/lab-02/attachments.api.test.ts` ("the freed slot...") | Pass |
| UI-01 | UI | AC-01 | Create Ticket: loads categories/related systems, renders required fields | `client/tests/lab-02/CreateTicket.test.tsx` ("loads reference data...") | Pass |
| UI-01b | UI | — | Create Ticket: validation messages on empty submit, no API call; error clears once the field is fixed; valid submit posts to `/api/tickets` | `client/tests/lab-02/CreateTicket.test.tsx` (3 tests) | Pass |
| UI-02 | UI | AC-08 | My Tickets: renders list from the API; zero-tickets empty state | `client/tests/lab-02/MyTickets.test.tsx` (2 tests) | Pass |
| UI-02b | UI | AC-08 / BR-09 | My Tickets: search box re-fetches with `search=`, debounced; status-filter button re-fetches with `status=` | `client/tests/lab-02/MyTickets.test.tsx` (2 tests) | Pass |
| UI-03 | UI | AC-04 | Ticket Detail: read-only fields (ticket no., category, related system, requester, summary, description, owner) render correctly for the Requester | `client/tests/lab-02/RequesterTicketDetail.test.tsx` (2 tests) | Pass |
| UI-03b | UI | AC-04 | Ticket Detail: no Internal Notes tab for a Requester; safe error state (with a way back) when the ticket can't be loaded | `client/tests/lab-02/RequesterTicketDetail.test.tsx` (2 tests) | Pass |
| UI-04 | UI | FR-07 | Attachments (via `TicketDetailView`): lists existing attachments, empty state, client-side type rejection without an API call, successful upload reflects as active, soft-remove flow shows "Removed by..." and hides Download/Remove | `client/tests/lab-02/AttachmentSection.test.tsx` (5 tests) | Pass |
| UI-05 | UI | AC-01 | Create Ticket form renders and loads categories (full-app, kept for regression) | `client/tests/full-app/pages.test.tsx` ("CreateTicketPage") | Pass |
| UI-06 | UI | AC-08 | My Tickets renders the Requester's list, status-filter re-fetch, zero-vs-no-match distinction (full-app, kept for regression) | `client/tests/full-app/pages.test.tsx` ("RequesterDashboardPage") | Pass |
| UI-07 | UI | AC-04 | Ticket Detail renders fields/comments/actions for a staff viewer (full-app, kept for regression — not Requester-scoped, listed for completeness) | `client/tests/full-app/pages.test.tsx` ("TicketDetailView") | Pass |
| UI-08 | UI | BR-03 | Dev Requester Selector: loads active Requesters, dev-selects with no password field anywhere, empty state, load-failure state | `client/tests/full-app/devRequesterSelect.test.tsx` (3 tests) | Pass |
| E2E-01 | E2E | AC-01, AC-08, AC-04, FR-07, BR-03 | Full flow: dev-select (no password) → Create Ticket (all fields) → find it in My Tickets by search → open Ticket Detail, verify read-only fields → upload an attachment, verify active → soft-remove it, verify blocked | `e2e/lab-02/requester-ticket-flow.spec.ts` | **Pass** — run twice against real dev servers + the dev DB in this session (see Section 6) |
| VIS-01 | Visual | — | Create Ticket / My Tickets / Ticket Detail screenshots | `artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/` | Present (copied from real captures; not retaken this session) |
| VIS-02 | Visual | — | Dev Requester Selector / responsive screenshots | `docs/lab-02/submission-screenshots/{part5-login,part9-responsive}/` | **Stale** — predate this session's no-password Selector rewrite; deliberately not copied into `artifacts/`, see Section 4 |

## 3. Acceptance-Criterion Traceability

| AC | Covered by | Gap |
|---|---|---|
| AC-01 | API-01, API-01b, API-01c, UI-01, UI-01b, UI-05, E2E-01 | — |
| AC-02 | API-02 | — |
| AC-03 | API-03 | — |
| AC-04 | API-04, UI-03, UI-03b, UI-07, E2E-01 | — |
| AC-05 | API-05 | — |
| AC-06 | API-06, API-06b | — |
| AC-07 | API-07 | — |
| AC-08 | API-08, API-08b, UI-02, UI-02b, UI-06, E2E-01 | `specification.md`'s AC-08 text still says "no pagination metadata (there is none to return)" — that's stale relative to the shipped `{ tickets, pagination }` response shape tested here; `specification.md` was left unmodified (out of scope for this task) but the actual behavior (search/sort/pagination, all tested) supersedes that line. |
| FR-07 (attachments) | API-12, API-12b, API-12c, UI-04, E2E-01 | `specification.md` BR-08 still describes attachments as metadata-only (filename + URL, no upload); that's also stale relative to the shipped real-file upload/download/soft-remove behavior tested here. Not fixed in `specification.md` (out of scope), but noted here so the gap isn't hidden. |
| BR-03 (dev-select) | API-11, API-11b, API-11c, API-11d, UI-08, E2E-01 | — |

## 4. Responsive and Visual Checklist

- `artifacts/lab-02/screenshots/create-ticket/`, `my-tickets/`, `ticket-detail/` — populated this session as copies of the real, previously-captured PNGs in `docs/lab-02/submission-screenshots/part6-create-ticket/`, `part7-my-tickets/`, `part8-ticket-detail/` (6, 10, and 5 files respectively; counts verified to match after copying).
- **Not copied, and flagged via `artifacts/lab-02/screenshots/README.md`:** `part5-login/` (Dev Requester Selector) and `part9-responsive/` (responsive views). Both predate this session's Selector rewrite (real login → no-password `dev-select`), so presenting them as current evidence would be misleading. They need to be retaken against the current app before final submission — see the README for exactly what to recapture.
- No automated responsive-breakpoint test exists (e.g. Playwright viewport assertions) — the checklist remains screenshot-based, by design for this lab.

## 5. Test Commands

```bash
# server (all suites: lab-01, full-app, lab-02)
cd server
npx dotenv -e .env.test -- npx vitest run

# client (all suites: lab-01, full-app, lab-02)
cd client
npx vitest run

# e2e (Lab 2 Requester flow, against real dev servers)
cd e2e
npm install                         # first time only
npx playwright install --with-deps chromium   # first time only
npx playwright test                 # auto-starts ../server and ../client dev servers via webServer config,
                                     # health-checks http://localhost:4000/api/health and http://localhost:5173
```

`server/package.json` also defines `test:prepare` (`dotenv -e .env.test -- prisma migrate deploy && ... seed.ts`), needed once to stand up the `.env.test` database before the server suite will pass. The e2e suite reuses the dev database at `server/.env`'s `DATABASE_URL`; running `npx tsx prisma/seed.ts` (or `npm run prisma:seed`) against it first is idempotent and safe to repeat.

## 6. Final Results

All of the following were actually run in this session, not assumed:

- **Server:** `npx dotenv -e .env.test -- npx vitest run` from `server/` → **12 test files, 89 tests, all passing** (`tests/lab-01/` + `tests/full-app/` + the 4 new `tests/lab-02/` files contributing 32 of those 89 tests: 12 + 8 + 5 + 7).
- **Client:** `npx vitest run` from `client/` → **9 test files, 36 tests, all passing** (`tests/lab-01/` + `tests/full-app/` + the 4 new `tests/lab-02/` files contributing 17 of those 36 tests: 4 + 4 + 4 + 5).
- **E2E:** `npx playwright test` from `e2e/` → **1 test file, 1 test (4 sequential steps), passing** — run twice in this session (once fresh, once with the dev servers already up) against the real dev API + client dev servers and the actual dev Postgres database, with a real tiny PNG fixture (`e2e/lab-02/fixtures/test-attachment.png`) uploaded and then soft-removed. No sandbox limitation was hit — Chromium installed cleanly via `npx playwright install --with-deps chromium`, both dev servers started and health-checked successfully, and the full dev-select → create → find → detail → attach → remove flow completed as scripted.

  Note: on this Windows sandbox, killing Playwright's `webServer`-managed `npm run dev` processes did not always cascade to the underlying `node` child process (a known Windows/npm quirk with `tsx watch`/`vite`) — after the test run, two orphaned `node` processes were found still listening on ports 4000/5173 and were manually stopped. This doesn't affect whether the test passed, but is worth knowing if `npx playwright test` is re-run and a port conflict shows up: check for and kill any leftover `node` process on 4000/5173 first.

## 7. Known Limitations or Deferred Tests

- **Screenshots for the Dev Requester Selector and responsive layouts are stale** (Section 4) — they show the pre-fix, password-based Selector and need to be retaken against the current no-password `dev-select` flow before final submission.
- `specification.md` BR-03 and `api-spec.md`'s auth section were updated (elsewhere in this session) to describe the new no-password `dev-select` flow. Beyond that targeted fix, both documents were otherwise left unmodified (broader spec cleanup was explicitly out of scope for this task), so two other claims remain stale relative to shipped, tested behavior: `specification.md` AC-08's "no pagination metadata" line, and BR-08's "no file upload" description of attachments. Both are called out in Section 3 rather than silently left inconsistent.
- No automated visual-regression or responsive-breakpoint testing tool is configured; responsive evidence is screenshot-only.
- The e2e suite is a single sequential flow (by design — each step's assertions depend on state the previous step created) rather than several independent specs; it is not currently parallelized and only covers the one happy-path Requester journey named in the test plan (it does not, for example, re-test every validation/error case already covered at the API and component level — that would be redundant, not additional coverage).
- `e2e/` is a separate npm package from `client/`/`server/` (its own `package.json`), not wired into a monorepo workspace — running its tests requires `cd e2e` first, as documented in Section 5.
