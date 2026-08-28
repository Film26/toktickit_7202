# Lab 2 Test Plan and Results — Requester-Facing Slice

Written against tests that actually exist. There is no `server/tests/lab-02/` directory — all relevant coverage lives in `server/tests/full-app/`, because the suite was written for the full-app build rather than a Lab-2-scoped one. Test IDs below are new labels assigned for traceability, not existing identifiers in the code.

## 1. Test Strategy

API-level coverage (Vitest + Supertest against the real Express app + a `.env.test` Postgres database) exists for every ticket-lifecycle endpoint touched by a Requester, plus auth and reference-data management. There is no UI component test, no visual/style assertion, no responsive screenshot, and no E2E test anywhere in the repo (`client/src/**/*.test.tsx` matches zero files; no `e2e/` directory exists). This is reported as-is rather than backfilled with placeholder claims.

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
| UI-01 | UI | AC-01 | Create Ticket form: validation message on empty submit, no API call | — | **Not implemented** — no client test files exist |
| UI-02 | UI | — | My Tickets: status filter re-fetches and re-renders table | — | **Not implemented** |
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
| AC-08 | API-08 | No search/sort/pagination to test (not implemented — see `specification.md` BR-09) |

## 4. Responsive and Visual Checklist

Not started. No Playwright config, no `artifacts/lab-02/screenshots/` directory, and no manual checklist has been produced. `ui-spec.md` Section 5 records the layout behavior by code inspection only, not by rendered evidence.

## 5. Test Commands

```bash
npm test --prefix server   # runs all Vitest+Supertest suites, including the ones referenced above
npm test --prefix client   # currently 0 test files match; exits with no tests to run
```

`server/package.json` also defines `test:prepare` (`dotenv -e .env.test -- prisma migrate deploy && ... seed.ts`), needed once to stand up the `.env.test` database before `npm test --prefix server` will pass.

## 6. Final Results

As of this writing, `npm test --prefix server` passes in full on `dev/full-app` (all suites in `server/tests/full-app/` and `server/tests/lab-01/`). No client or E2E command exists to report a result for.

## 7. Known Limitations or Deferred Tests

- `PATCH /api/tickets/:id/priority` and `POST /api/tickets/:id/reject-resolution` are implemented but untested (API-05, API-06b).
- Attachment upload has no validation to test against (no size/type limit, no removal) — see `specification.md` BR-08. Writing a test for the Lab 2 attachment rules requires implementing them first.
- No client component tests, no E2E suite, no visual/responsive evidence — all deferred, not silently skipped or hidden.
