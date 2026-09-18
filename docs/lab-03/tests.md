# Lab 3 Test Plan and Results — Auth, IT Staff, Admin

Written against tests that actually exist on each Lab 3 feature branch (PRs #53–#58) and that were
actually run in this session, not reconstructed afterward from whatever the coding agent happened
to produce. As of this document's commit, none of those PRs are merged into `lab3-staging` yet
(each was reviewed and run independently on its own branch, per `docs/lab-03/reviewer.md`) — Test
IDs and file paths below are accurate to each branch as implemented; "Final" reflects the result
observed on that branch's own CI run, not a run from `main`. This will be re-verified from a clean
checkout of `main` before Lab 3 is submitted (Definition of Done, `specification.md` §12).

## 1. Test Strategy

Four layers of coverage, matching handout §10's required unit / API–integration / UI /
authorization / migration-regression / E2E spread:

- **Unit tests** (Vitest, no DB): `server/tests/lab-03/jwt-config.unit.test.ts` — the
  `JWT_SECRET` fail-fast check (Issue #47), tested as a pure function rather than by mutating
  `process.env` and reloading modules.
- **API/integration tests** (Vitest + Supertest against the real Express app + a `.env.test`
  Postgres database): one new file per Lab 3 issue under `server/tests/lab-03/`, listed in the
  table below. File names match the handout §12 required structure where one was specified
  (`staff-queue.api.test.ts`, `authorization.api.test.ts`, `users-admin.api.test.ts`); the
  remaining two (`staff-ticket-detail`-shaped coverage for #42, and #43's Requester signal) didn't
  have an exact named home in §12, so they're named after the feature instead.
- **UI/component tests** (React Testing Library against a mocked `fetch`):
  `client/tests/lab-03/{UserManagement,RequesterTicketDetail,StaffTicketQueue}.test.tsx`.
- **Security/authorization sweep**: `server/tests/lab-03/authorization.api.test.ts` (Issue #47) —
  a dedicated, systematic pass across every protected route (no token / malformed token / expired
  token / wrong role / not-the-owner), separate from the endpoint-specific tests that check one
  feature's own business rules.
- **Migration/regression**: `server/tests/lab-03/seed-idempotency.test.ts` (Issue #48) — seed
  re-run safety, plus a check that a Ticket created outside the seed survives a re-seed untouched.
  The full pre-existing Lab 1/Lab 2 suite (`server/tests/full-app/`, `server/tests/lab-02/`,
  `client/tests/full-app/`, `client/tests/lab-02/`) also still passes on every Lab 3 branch — see
  §4 — which is the regression evidence that Lab 2 Requester behavior wasn't broken.
- **E2E**: not yet implemented. Planned files and scope are in §5; this is Issue #49's work,
  sequenced after the other Lab 3 branches merge so there's real merged UI to drive.

## 2. Test Table (Lab 3 — new tests only; see §4 for regression totals)

| Test ID | Type | Requirement/AC | What It Tests | Automated Test File | Branch (PR) | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | §11.3 decision | `assertJwtSecretConfigured` throws when the secret is missing outside `NODE_ENV=test` (3 cases: missing+prod, missing+empty-string, missing+undefined env) | `jwt-config.unit.test.ts` | #47 (PR #56) | Pass |
| UNIT-02 | Unit | §11.3 decision | Does not throw when missing under `NODE_ENV=test`, or when a secret is present under any env | `jwt-config.unit.test.ts` | #47 (PR #56) | Pass |
| API-01 | API | AC-11 | New Ticket's `itPriority` equals the submitted `requestedPriority` | `staff-ticket-detail.api.test.ts` | #42 (PR #53) | Pass |
| API-02 | API | — (§7 matrix) | New→Open (Acknowledge), then Open→In Progress (Start Progress) | `staff-ticket-detail.api.test.ts` | #42 (PR #53) | Pass |
| API-03 | API | — (§7 matrix) | New→In Progress direct shortcut still works (pre-existing behavior preserved) | `staff-ticket-detail.api.test.ts` | #42 (PR #53) | Pass |
| API-04 | API | AC-09 | In Progress→Waiting for Requester→In Progress (Mark Waiting / Resume Progress) | `staff-ticket-detail.api.test.ts` | #42 (PR #53) | Pass |
| API-05 | API | — (§7 matrix) | Resolve succeeds directly from Waiting for Requester, not only In Progress | `staff-ticket-detail.api.test.ts` | #42 (PR #53) | Pass |
| API-06 | API | — (§7 matrix) | Reopened→Open (Acknowledge) | `staff-ticket-detail.api.test.ts` | #42 (PR #53) | Pass |
| API-07 | API | — (§7 matrix) | Cancel: New→Cancelled, Open→Cancelled, In-Progress cancel rejected 409, Requester-role cancel rejected 403, Cancelled is terminal (5 tests) | `staff-ticket-detail.api.test.ts` | #42 (PR #53) | Pass |
| API-08 | API | AC-10 | New→Closed direct rejected 409, status unchanged; Open→Waiting rejected 409 (must go through In Progress) (2 tests) | `staff-ticket-detail.api.test.ts` | #42 (PR #53) | Pass |
| API-09 | API | BR-16/AC-12 | Administrator self-deactivation blocked 403, regardless of other active Administrators | `users-admin.api.test.ts` | #45 (PR #54) | Pass |
| API-10 | API | BR-17/AC-13 | Sole active Administrator blocked (409) from demoting themselves via `PATCH /:id` role change | `users-admin.api.test.ts` | #45 (PR #54) | Pass |
| API-11 | API | BR-17 | Demoting a *different* Administrator is allowed when another active Administrator remains (proves the guard isn't overbroad) | `users-admin.api.test.ts` | #45 (PR #54) | Pass |
| API-12 | API | BR-18 | Duplicate email rejected 409 on the **edit** path (`PATCH /:id`), not just create | `users-admin.api.test.ts` | #45 (PR #54) | Pass |
| API-13 | API | FR-24 | `isActive` settable at creation (explicit `false`, and default `true` when omitted) (2 tests) | `users-admin.api.test.ts` | #45 (PR #54) | Pass |
| API-14 | API | — | `GET /api/users?role=` filter returns only matching roles; non-Administrator gets 403 on any `/api/users/*` route (2 tests) | `users-admin.api.test.ts` | #45 (PR #54) | Pass |
| API-15 | API | AC-07 | Requester flags a New ticket as appears-resolved; `status` unchanged, `requesterAppearsResolvedAt` set | `requester-appears-resolved.api.test.ts` | #43 (PR #55) | Pass |
| API-16 | API | BR-05 | Flag works while In Progress and can be toggled back off | `requester-appears-resolved.api.test.ts` | #43 (PR #55) | Pass |
| API-17 | API | AC-08 | Rejected 409 once the ticket is Resolved | `requester-appears-resolved.api.test.ts` | #43 (PR #55) | Pass |
| API-18 | API | BR-05 | Rejected 409 once the ticket is Closed | `requester-appears-resolved.api.test.ts` | #43 (PR #55) | Pass |
| API-19 | API | BR-05 | The flag itself never changes `status` (distinct from Confirm/Reject Resolution) | `requester-appears-resolved.api.test.ts` | #43 (PR #55) | Pass |
| API-20 | API | AC-03/AC-16 | 404 for a Requester acting on another Requester's ticket via this endpoint | `requester-appears-resolved.api.test.ts` | #43 (PR #55) | Pass |
| API-21 | API | — | 403 when IT Staff calls the Requester-only endpoint | `requester-appears-resolved.api.test.ts` | #43 (PR #55) | Pass |
| API-22 | API | — (§10 contract) | `GET /api/tickets` returns `{ tickets, pagination }`, matching `/mine`'s shape | `staff-queue.api.test.ts` | #44 (PR #57) | Pass |
| API-23 | API | AC-14 | Sorts by `requestedPriority` using the Priority enum's declared order (not alphabetically) — caught and fixed a wrong assumption while writing this test | `staff-queue.api.test.ts` | #44 (PR #57) | Pass |
| API-24 | API | AC-14 | `ticketNumber` ascending/descending are exact reverses of each other | `staff-queue.api.test.ts` | #44 (PR #57) | Pass |
| API-25 | API | AC-14 | `itPriority` and `updatedAt` accepted as queue-specific sort fields | `staff-queue.api.test.ts` | #44 (PR #57) | Pass |
| API-26 | API | AC-14 | Pagination: `pageSize=2` splits 3 results correctly across 2 pages with correct totals | `staff-queue.api.test.ts` | #44 (PR #57) | Pass |
| API-27 | API | AC-14 | A page past the last page returns an empty array, not an error; `pageSize` clamps to the documented max instead of erroring (2 tests) | `staff-queue.api.test.ts` | #44 (PR #57) | Pass |
| API-28 | API | — (§10 contract) | Invalid `sort`/`page`/`pageSize` values silently fall back to defaults instead of erroring (2 tests) | `staff-queue.api.test.ts` | #44 (PR #57) | Pass |
| API-29 | API | — | Existing status/owner/category/search filters still combine correctly with the new sort+pagination | `staff-queue.api.test.ts` | #44 (PR #57) | Pass |
| SEC-01 | Security | — | No Authorization header → 401 across 9 representative protected endpoints (`it.each`) | `authorization.api.test.ts` | #47 (PR #56) | Pass |
| SEC-02 | Security | — | Malformed/garbage token → 401 | `authorization.api.test.ts` | #47 (PR #56) | Pass |
| SEC-03 | Security | AC-18 | Syntactically valid but expired token (signed with `expiresIn: -10`) → 401 | `authorization.api.test.ts` | #47 (PR #56) | Pass |
| SEC-04 | Security | AC-18 | A still-valid, unexpired token stops working the moment the account is deactivated mid-session (no wait for token expiry) | `authorization.api.test.ts` | #47 (PR #56) | Pass |
| SEC-05 | Security | — | Wrong role → 403 across 15 endpoint/role combinations (`it.each`) covering Requester-vs-staff-only and staff-vs-Requester-only routes both directions | `authorization.api.test.ts` | #47 (PR #56) | Pass |
| SEC-06 | Security | AC-15 | Non-Administrator (both IT Staff and Requester) blocked from every `/api/users/*` route (list/create/edit/reset-password) | `authorization.api.test.ts` | #47 (PR #56) | Pass |
| SEC-07 | Security | AC-04 | Requester blocked from posting Internal Notes (403) with no note content echoed in the error response; the ticket payload served to a Requester has no `internalNotes` key at all | `authorization.api.test.ts` | #47 (PR #56) | Pass |
| SEC-08 | Security | AC-03/AC-16 | Ownership boundary uses authenticated identity: a different Requester gets 404 (not 403) on `GET /:id` and on a Requester-only action; the 404 body shape is identical whether the ticket truly doesn't exist or just isn't theirs (no existence leak) (3 tests) | `authorization.api.test.ts` | #47 (PR #56) | Pass |
| SEC-09 | Security | §11.1 decision | Administrator retains full IT Staff ticket capability (queue access, claim), proving the deliberate authorization-matrix decision is actually implemented, not just documented | `authorization.api.test.ts` | #47 (PR #56) | Pass |
| MIG-01 | Migration | §9 | Running the seed twice produces identical seed-owned row counts (no duplication, no error) — scoped to rows the seed itself owns, not whole-table counts (see note below) | `seed-idempotency.test.ts` | #48 (PR #58) | Pass |
| MIG-02 | Migration | §5.3 minimums | Seeded role counts meet the Lab 3 minimums: ≥3 active + ≥1 inactive IT Staff, ≥4 active + ≥1 inactive Requester | `seed-idempotency.test.ts` | #48 (PR #58) | Pass |
| MIG-03 | Migration | §5.3 | Seed tickets span both assigned and unassigned ownership | `seed-idempotency.test.ts` | #48 (PR #58) | Pass |
| MIG-04 | Migration | §5.3 | Seed includes at least one Public Comment and one Internal Note | `seed-idempotency.test.ts` | #48 (PR #58) | Pass |
| MIG-05 | Migration | §5.2 (BR-23) | A Ticket created outside the seed still exists, byte-for-byte unchanged, after re-running the seed | `seed-idempotency.test.ts` | #48 (PR #58) | Pass |
| MIG-06 | Migration | §5.2 (BR-23) | Pre-existing Categories are not duplicated by a re-seed (upsert by unique name) | `seed-idempotency.test.ts` | #48 (PR #58) | Pass |
| UI-01 | UI | BR-16 | Deactivate control disabled (with tooltip) on the signed-in Administrator's own row; enabled on other rows | `UserManagement.test.tsx` | #45 (PR #54) | Pass |
| UI-02 | UI | — (§2.7) | Role filter dropdown re-fetches `/api/users` with the selected `role=` query param | `UserManagement.test.tsx` | #45 (PR #54) | Pass |
| UI-03 | UI | BR-05 | "Mark as Appears Resolved" shown on an open ticket, visually separate from (not replacing) Confirm/Reject Resolution | `RequesterTicketDetail.test.tsx` | #43 (PR #55) | Pass |
| UI-04 | UI | BR-05 | Toggle hidden once the ticket is formally Resolved (Confirm/Reject Resolution shown instead) | `RequesterTicketDetail.test.tsx` | #43 (PR #55) | Pass |
| UI-05 | UI | BR-05 | Clicking the toggle calls the endpoint, flips the label to "Undo Appears Resolved", and shows the "Appears Resolved" badge | `RequesterTicketDetail.test.tsx` | #43 (PR #55) | Pass |
| UI-06 | UI | AC-14 | Selecting a sort option re-fetches with the matching `sort=`/`order=` query params | `StaffTicketQueue.test.tsx` | #44 (PR #57) | Pass |
| UI-07 | UI | — (§2.5) | Pagination controls render, show correct page count, Previous disabled on page 1, Next requests the next page | `StaffTicketQueue.test.tsx` | #44 (PR #57) | Pass |
| UI-08 | UI | — (§2.5) | Pagination controls hidden entirely when everything fits on one page | `StaffTicketQueue.test.tsx` | #44 (PR #57) | Pass |
| UI-09 | UI | §8.6 (empty vs no-results) | Genuinely-empty-queue message shown when there are zero tickets and no filters active | `StaffTicketQueue.test.tsx` | #44 (PR #57) | Pass |

**Note on MIG-01's design**: the first version of this test compared whole-table row counts and
flaked when run as part of the full suite, because other Lab 3 test files legitimately create
their own users/tickets/comments concurrently in the same shared local test database — that
looked like the seed had duplicated something when it hadn't. Rescoped every count to rows the
seed itself owns (by its own known emails / `TKT-SAMPLE-` prefix / category names). Confirmed
stable across repeated full-suite runs, and separately verified by hand: ran the seed 3 times
directly against the dev database outside the test suite and diffed exact counts.

## 3. Acceptance-Criterion Traceability

| AC | Covered by | Gap |
|---|---|---|
| AC-01 | `server/tests/full-app/auth.test.ts` (Lab 1/2, still passing — see §4) | — |
| AC-02 | `server/tests/full-app/auth.test.ts`, `tickets.test.ts` (mustChangePassword flow + enforcement) | — |
| AC-03 | SEC-08, API-20 | — |
| AC-04 | SEC-07 | — |
| AC-05 | `server/tests/full-app/auth.test.ts` ("rejects a correct password for a deactivated user") | — |
| AC-06 | *(none)* | **Gap.** `updateTicketOwner`'s rejection of an inactive/Requester-role `ownerId` (400) is implemented but only the happy path (valid active IT Staff owner) is tested anywhere in the suite. Recommend adding to `staff-ticket-detail.api.test.ts` (#42) or `authorization.api.test.ts` (#47) as a follow-up before Lab 3 submission. |
| AC-07 | API-15 | — |
| AC-08 | API-17 | — |
| AC-09 | API-04 | — |
| AC-10 | API-08 | — |
| AC-11 | API-01 | — |
| AC-12 | API-09 | — |
| AC-13 | API-10, API-11 | — |
| AC-14 | API-22–API-29, UI-06–UI-09 | — |
| AC-15 | SEC-06 | — |
| AC-16 | SEC-08, API-20 | — |
| AC-17 | API-12 (edit path) | **Partial gap.** The **create** path (`POST /api/users` with a duplicate email) is only exercised incidentally elsewhere in the suite, never asserted as 409 in a dedicated test. Recommend adding one to `users-admin.api.test.ts` (#45) as a follow-up. |
| AC-18 | SEC-03, SEC-04 | — |

16 of 18 ACs are fully covered by an automated test that has actually been run; 2 have a specific,
named gap rather than a silent omission. Both gaps are small (one assertion each) and don't block
any PR — they're tracked here so they don't get lost before Lab 3 submission.

## 4. Regression Evidence (Lab 1 / Lab 2 suite, run on every Lab 3 branch)

Every Lab 3 branch in the table above also ran the full pre-existing suite before its PR was
opened, confirming no Lab 2 Requester behavior broke:

| Branch (PR) | Server: files / tests | Client: files / tests |
|---|---|---|
| #42 (PR #53) | 13 / 102 | 9 / 36 |
| #45 (PR #54) | 13 / 98 | 10 / 38 |
| #43 (PR #55) | 13 / 96 | 10 / 39 |
| #47 (PR #56) | 14 / 127 | 9 / 36 |
| #44 (PR #57) | 13 / 99 | 10 / 40 |
| #48 (PR #58) | 13 / 95 (run twice consecutively for stability) | — (no client changes) |

Per-branch totals differ because each branch is deliberately isolated from the others (none built
on top of another's commits — see `docs/lab-03/reviewer.md`), so each only carries its own new
test file(s) plus the shared Lab 1/2/full-app baseline. Once branches merge into `lab3-staging`,
the combined suite will be re-run from that branch directly and this table updated with the merged
totals (tracked under Issue #51, release integration).

## 5. Planned E2E Coverage (not yet implemented — Issue #49)

Per the required structure (handout §12):

| Planned file | Scope |
|---|---|
| `e2e/lab-03/authentication.spec.ts` | Valid/invalid login, inactive-account handling, mandatory first-password change gating normal app access, logout, direct-URL access blocked after logout (AC-01, AC-02, AC-05) |
| `e2e/lab-03/staff-ticket-flow.spec.ts` | IT Staff searches/filters/sorts the queue, opens a ticket, claims/reassigns ownership, sets IT Priority, moves through a permitted status transition, posts a Public Comment, writes an Internal Note and confirms a Requester session can't see it (AC-04, AC-09, AC-14) |
| `e2e/lab-03/user-administration.spec.ts` | Administrator creates a user, searches/filters, edits, sets a new initial password and confirms it's required at next login, attempts (and is blocked from) self-deactivation and removing the last Administrator, confirms non-Administrator gets forbidden (AC-12, AC-13, AC-15, AC-17) |

Deliberately sequenced after #42/#43/#45 merge into `lab3-staging`, so these drive real merged UI
rather than a throwaway local combine of unmerged branches.

## 6. Style/Responsive Checklist

Tracked in `docs/lab-03/ui-spec.md` §6 (visual checklist) — to be run and checked off during
Issue #49 alongside the E2E work, once there's a stable merged UI to screenshot at all three
breakpoints.
