# Lab 2 Test Plan and Results — Requester-Facing Slice

Written against tests that actually exist. There is no `server/tests/lab-02/` directory — all relevant coverage lives in `server/tests/full-app/`, because the suite was written for the full-app build rather than a Lab-2-scoped one. Test IDs below are new labels assigned for traceability, not existing identifiers in the code.

## 1. Test Strategy

API-level coverage (Vitest + Supertest against the real Express app + a `.env.test` Postgres database) exists for every ticket-lifecycle endpoint touched by a Requester, plus auth and reference-data management. Client-side coverage also exists: React Testing Library component tests under `client/tests/` (note: not `client/src/` — the tests live in a separate `client/tests/` tree per `client/vite.config.ts`'s `test.include`) cover the main Requester, IT Staff, and Admin pages against a mocked `fetch`. There is no visual/style assertion, no responsive screenshot, and no E2E test anywhere in the repo (no `e2e/` directory exists). This is reported as-is rather than backfilled with placeholder claims.

## 2. Planned vs. Actual Test Table

| Test ID | Type | AC | What it tests | Actual test file | Status |
|---|---|---|---|---|---|
| API-01 | API | AC-01 | Create a valid ticket; response is 201, status NEW, ticketNumber matches `TKT-\d{4}-\d{6}` | `server/tests/full-app/tickets.test.ts` ("lets a requester create a ticket") | Pass |
| API-02 | API | AC-02 | Non-Requester role creating a ticket is rejected | `server/tests/full-app/tickets.test.ts` ("rejects ticket creation from non-requester roles") | Pass |
| API-03 | API | AC-03 | A different Requester gets 404 on someone else's ticket | `server/tests/full-app/tickets.test.ts` ("404s for another requester...") | Pass |
| API-04 | API | AC-04 | Owning Requester gets 200 and no `internalNotes` field | `server/tests/full-app/tickets.test.ts` (same test as API-03) | Pass |
| API-05 | API | AC-05 | Requester can change priority in NEW/IN_PROGRESS; blocked (409) otherwise | — | **Not implemented** — `PATCH /:id/priority` has no test coverage |
| API-06 | API | AC-06 | Resolved ticket: confirm → CLOSED | `server/tests/full-app/tickets.test.ts` ("walks through resolve -> confirm -> closed") | Pass |
| API-06b | API | AC-06 | Resolved ticket: reject → REOPENED | — | **Not implemented** — `reject-resolution` has no test coverage |
| API-07 | API | AC-07 | Closed ticket: request-reopen → REOPENED | `server/tests/full-app/tickets.test.ts` ("lets the requester request reopening...") | Pass |
| API-08 | API | AC-08 | `GET /api/tickets/mine` returns only the caller's tickets | `server/tests/full-app/tickets.test.ts` ("lets the requester see it in their own list") | Pass |
| API-09 | API | FR-09 | Public category/related-system list excludes inactive rows | `server/tests/full-app/referenceData.test.ts` | Pass |
| API-10 | API | BR-03 | Login returns a JWT + user profile; rejects bad credentials | `server/tests/full-app/auth.test.ts` | Pass |
| UI-01 | UI | AC-01 | Create Ticket form renders and loads categories from the API | `client/tests/full-app/pages.test.tsx` ("CreateTicketPage") | Pass |
| UI-02 | UI | AC-08 | My Tickets renders the Requester's own ticket list from the API | `client/tests/full-app/pages.test.tsx` ("RequesterDashboardPage") | Pass |
| UI-03 | UI | AC-04 | Ticket Detail renders ticket fields, comments, and actions for a staff viewer | `client/tests/full-app/pages.test.tsx` ("TicketDetailView") | Pass |
| UI-04 | UI | — | IT Staff all-tickets list includes the Requester column | `client/tests/full-app/pages.test.tsx` ("ItStaffDashboardPage") | Pass |
| UI-05 | UI | — | Admin: create a user, see the returned temporary password | `client/tests/full-app/adminPages.test.tsx` ("UserManagementPage") | Pass |
| UI-06 | UI | — | Admin: reference-data list includes inactive rows in the manage view | `client/tests/full-app/adminPages.test.tsx` ("ReferenceDataManagementPage") | Pass |
| UI-07 | UI | — | Create Ticket: validation message on empty submit, no API call | — | **Not implemented** — existing tests cover the happy path (data loads), not client-side validation feedback |
| UI-08 | UI | — | My Tickets: status filter re-fetches and re-renders the table | — | **Not implemented** |
| E2E-01 | E2E | AC-01 | Full create → find-in-My-Tickets flow across a real browser | — | **Not implemented** — no `e2e/` directory exists |
| VIS-01 | Visual | — | Desktop/tablet/mobile screenshots against `ui-spec.md` | — | **Not implemented** — no screenshot tooling configured |

## 3. Acceptance-Criterion Traceability

| AC | Covered by | Gap |
|---|---|---|
| AC-01 | API-01 | No UI/E2E coverage |
| AC-02 | API-02 | — |
| AC-03 | API-03 | — |
| AC-04 | API-04 | — |
| AC-05 | none | Priority-update endpoint is completely untested |
| AC-06 | API-06 | Reject-resolution path untested |
| AC-07 | API-07 | — |
| AC-08 | API-08, UI-02 | No search/sort/pagination to test (not implemented — see `specification.md` BR-09) |

## 4. Responsive and Visual Checklist

Not started. No Playwright config, no `artifacts/lab-02/screenshots/` directory, and no manual checklist has been produced. `ui-spec.md` Section 5 records the layout behavior by code inspection only, not by rendered evidence. Component-level UI tests exist (Section 2) but they assert data rendering, not responsive layout or visual style.

## 5. Test Commands

```bash
npm test --prefix server   # runs all Vitest+Supertest suites, including the ones referenced above
npm test --prefix client   # runs client/tests/**/*.test.{ts,tsx} (4 files, 13 tests as of this writing)
```

`server/package.json` also defines `test:prepare` (`dotenv -e .env.test -- prisma migrate deploy && ... seed.ts`), needed once to stand up the `.env.test` database before `npm test --prefix server` will pass.

## 6. Final Results

As of this writing, both `npm test --prefix server` (all suites in `server/tests/full-app/` and `server/tests/lab-01/`) and `npm test --prefix client` (4 test files, 13 tests, all passing) succeed on `dev/full-app`. No E2E command exists to report a result for.

## 7. Known Limitations or Deferred Tests

- `PATCH /api/tickets/:id/priority` and `POST /api/tickets/:id/reject-resolution` are implemented but untested at the API level (API-05, API-06b).
- Existing client tests cover happy-path data rendering only — no test exercises client-side validation messages, the My Tickets status-filter interaction, or any error/loading state.
- Attachment upload has no validation to test against (no size/type limit, no removal) — see `specification.md` BR-08. Writing a test for the Lab 2 attachment rules requires implementing them first.
- No E2E suite, no visual/responsive evidence — deferred, not silently skipped or hidden.
