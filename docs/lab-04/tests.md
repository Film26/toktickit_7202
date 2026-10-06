# Lab 4 Test Plan and Results — Actions Taken, Workflow, Dashboards

Written before implementation (Issue #64) as the Test-DD plan; the **Final** column is filled in
from real runs as each feature PR lands, and from the clean-checkout run at release (Issue #70).
`Planned` = not yet run.

## 1. Strategy

| Layer | Tool | Location |
|---|---|---|
| Unit | Vitest (no DB) | `server/tests/lab-04/*.unit.test.ts` |
| API / integration / authorization / workflow | Vitest + Supertest + `.env.test` Postgres | `server/tests/lab-04/*.api.test.ts` |
| Migration / seed / regression | Vitest against the migrated test DB | `server/tests/lab-04/migration-seed.test.ts`, all of `server/tests/lab-0{1,2,3}`, `full-app` |
| UI component | Vitest + React Testing Library, mocked `fetch` | `client/tests/lab-04/*.test.tsx` |
| UI style / responsive / a11y | Playwright (real app) | `e2e/lab-04/visual-inspection.spec.ts` |
| End-to-end | Playwright (real app, seeded dev DB) | `e2e/lab-04/*.spec.ts` + Lab 2/3 E2E |
| Performance smoke | Supertest timing | `server/tests/lab-04/staff-dashboard.api.test.ts` |

Run: `cd server && npm run test:prepare && npm test` · `cd client && npm test` ·
`cd e2e && npx playwright test`.

## 2. Test cases

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-08 | Action status move table | Only Planned→IP/Completed/Cancelled, IP→Completed/Cancelled allowed | server/tests/lab-04/action-rules.unit.test.ts | Pass (#65) |
| UNIT-02 | Unit | BR-07, BR-09, BR-10 | Merged action validation (follow-up note, result, date window) | Correct field errors | server/tests/lab-04/action-rules.unit.test.ts | Pass (#65) |
| UNIT-03 | Unit | BR-22 | Bangkok `todayStart` at 23:30 and 00:30 local | Correct UTC boundary | server/tests/lab-04/action-rules.unit.test.ts | Pass (#68) |
| UNIT-04 | Unit | BR-15 | Resolution-gate evaluator | Blocks with open / no completed actions | server/tests/lab-04/action-rules.unit.test.ts | Pass (#67) |
| API-01 | API | FR-02, AC-07 | List actions as staff / own Requester / other Requester | 200 ordered / 200 / 404 | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-02 | API | AC-07, BR-04 | Requester POST / PATCH action | 403 | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-03 | API | AC-01 | Create a valid Action Taken | 201 under the correct Ticket, performedBy = caller, assignee default caller | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-04 | API | AC-01, BR-02 | Create assigned to a different IT Staff (not the Ticket Owner) | 201, assignee = that user | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-05 | API | AC-04 | Follow-up required without note (create + edit) | 400 `fields.followUpNote` | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-06 | API | AC-05 | Complete without result | 400 `fields.result` | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-07 | API | AC-06 | Inactive / Requester / unknown assignee | 400 | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-08 | API | BR-06, BR-10 | Blank description, too-long fields, future completed date, date before ticket | 400 | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-09 | API | AC-08 | PATCH with stale version | 409 STALE_UPDATE + current, unchanged | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-10 | API | AC-09 | Edit Completed / Cancelled; Completed→Planned | 409 INVALID_TRANSITION | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-11 | API | BR-08 | Planned → In Progress → Completed; Planned → Cancelled | 200, completedAt / cancelledAt set, version increments | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-12 | API | AC-20 | Same clientRequestId twice | 201 then 200 same id, one row | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-13 | API | AC-23 | Create/edit on Resolved, Closed, Cancelled ticket | 409 TICKET_LOCKED | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-14 | API | BR-03 | Body tries to set performedBy/authorId | Ignored, performedBy = caller | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| API-15 | API | BR-25 | Administrator creates/edits action | 201/200 | server/tests/lab-04/actions-taken.api.test.ts | Pass (#65) |
| WF-01 | Workflow | AC-10 | Resolve with no action / open action | 409 RESOLUTION_GATE, status unchanged | server/tests/lab-04/ticket-workflow.api.test.ts | Pass (#67) |
| WF-02 | Workflow | AC-10 | Resolve with ≥1 completed + rest cancelled | 200 RESOLVED | server/tests/lab-04/ticket-workflow.api.test.ts | Pass (#67) |
| WF-03 | Workflow | AC-11 | Requester appears-resolved + Requester POST resolve | status unchanged; 403 | server/tests/lab-04/ticket-workflow.api.test.ts | Pass (#67) |
| WF-04 | Workflow | AC-12 | Full lifecycle New→Open→IP→Waiting→IP→Resolved→Closed→Reopened | one history row per step, in order, correct actor | server/tests/lab-04/ticket-workflow.api.test.ts | Pass (#67) |
| WF-05 | Workflow | AC-13 | Stale ticket version on status / owner / it-priority | 409 STALE_UPDATE | server/tests/lab-04/ticket-workflow.api.test.ts | Pass (#67) |
| WF-06 | Workflow | AC-13 | Two concurrent resolves | exactly one 200, one history row | server/tests/lab-04/ticket-workflow.api.test.ts | Pass (#67) |
| WF-07 | Workflow | AC-14 | Every non-matrix transition (sampled table) | 409 | server/tests/lab-04/ticket-workflow.api.test.ts | Pass (#67) |
| WF-08 | Workflow | AC-22 | Cancel ticket with planned action | ticket CANCELLED, action CANCELLED | server/tests/lab-04/ticket-workflow.api.test.ts | Pass (#67) |
| WF-09 | Workflow | FR-09 | GET ticket includes ordered statusHistory + version for Requester and staff | present | server/tests/lab-04/ticket-workflow.api.test.ts | Pass (#67) |
| DASH-01 | API | AC-02 | Requester dashboard only own tickets (compare two requesters to DB) | counts = DB counts for that requester | server/tests/lab-04/requester-dashboard.api.test.ts | Pass (#68) |
| DASH-02 | API | AC-16 | Staff → requester dashboard; no token | 403; 401 | server/tests/lab-04/requester-dashboard.api.test.ts | Pass (#68) |
| DASH-03 | API | AC-17 | Fresh Requester with no tickets | all 0, lists [] | server/tests/lab-04/requester-dashboard.api.test.ts | Pass (#68) |
| DASH-04 | API | AC-18 | Each requester metric's drill-down vs `/tickets/mine` totalCount | equal | server/tests/lab-04/requester-dashboard.api.test.ts | Pass (#68) |
| DASH-05 | API | AC-15 | Staff metrics vs `prisma.ticket.count` | equal | server/tests/lab-04/staff-dashboard.api.test.ts | Pass (#68) |
| DASH-06 | API | AC-15 | My Assigned / My Open Actions differ per staff user | per-user values | server/tests/lab-04/staff-dashboard.api.test.ts | Pass (#68) |
| DASH-07 | API | AC-18 | Each staff metric + byItPriority drill-down vs `/tickets` totalCount | equal | server/tests/lab-04/staff-dashboard.api.test.ts | Pass (#68) |
| DASH-08 | API | AC-19 | Admin userCounts vs DB; IT Staff null | equal / null | server/tests/lab-04/staff-dashboard.api.test.ts | Pass (#68) |
| DASH-09 | API | AC-16 | Requester → staff dashboard | 403 | server/tests/lab-04/staff-dashboard.api.test.ts | Pass (#68) |
| DASH-10 | API | BR-22 | "+N today" counts a transition made in the test | delta ≥ 1 for that status | server/tests/lab-04/staff-dashboard.api.test.ts | Pass (#68) |
| PERF-01 | Perf smoke | AC-29 | Both dashboards on seed data | < 1000 ms | server/tests/lab-04/staff-dashboard.api.test.ts | Pass (#68) |
| MIG-01 | Migration | AC-21, BR-24 | Legacy-style action backfill semantics; all Lab 3 tables still queryable | as specified | server/tests/lab-04/migration-seed.test.ts | Pass (#65) |
| MIG-02 | Seed | AC-21 | Seed twice → no duplicate actions/tickets; 0 / 1 / many actions exist; all 8 statuses | pass | server/tests/lab-04/migration-seed.test.ts | Pass (#65) |
| UI-01 | UI | AC-26 | Staff Dashboard renders cards, deltas, lists, drill-down hrefs | correct | client/tests/lab-04/StaffDashboard.test.tsx | Pass (#68) |
| UI-02 | UI | AC-26 | Staff Dashboard loading / error+Retry / empty / Admin user card | correct | client/tests/lab-04/StaffDashboard.test.tsx | Pass (#68) |
| UI-03 | UI | AC-26 | Requester Dashboard cards, attention list, empty state, error | correct | client/tests/lab-04/RequesterDashboard.test.tsx | Pass (#68) |
| UI-04 | UI | AC-24 | Actions Taken list + Add form inline validation (follow-up note, result) | errors under fields, no request sent | client/tests/lab-04/ActionsTaken.test.tsx | Pass (#66) |
| UI-05 | UI | AC-24 | Server 400/500 keeps entered values; Save disabled while saving | values retained | client/tests/lab-04/ActionsTaken.test.tsx | Pass (#66) |
| UI-06 | UI | AC-08 | 409 STALE_UPDATE shows ConflictAlert + Reload | shown | client/tests/lab-04/ActionsTaken.test.tsx | Pass (#66) |
| UI-07 | UI | AC-24 | Requester sees actions, no Add/Edit | hidden | client/tests/lab-04/ActionsTaken.test.tsx | Pass (#66) |
| UI-08 | UI | AC-25 | Buttons per status/role match matrix | exact set | client/tests/lab-04/TicketWorkflow.test.tsx | Pass (#67) |
| UI-09 | UI | AC-25 | Resolve disabled with gate hint; success refreshes badge + history | correct | client/tests/lab-04/TicketWorkflow.test.tsx | Pass (#67) |
| UI-10 | UI | FR-14 | Queue / My Tickets read drill-down params into the API call | query forwarded | client/tests/lab-04/StaffDashboard.test.tsx | Pass (#68) |
| UI-11 | UI | FR-15 | NavBar role links + aria-current | correct | client/tests/lab-04/StaffDashboard.test.tsx | Pass (#68) |
| E2E-01 | E2E | AC-03 | Staff: add planned action assigned to another staff, edit, complete, resolve | list + status update | e2e/lab-04/actions-taken-flow.spec.ts | Pass (#69) |
| E2E-02 | E2E | AC-07, AC-24 | Requester sees the actions read-only | no Add/Edit | e2e/lab-04/actions-taken-flow.spec.ts | Pass (#69) |
| E2E-03 | E2E | AC-10, AC-25 | Resolve blocked by open action, then allowed; Requester confirms → Closed | pass | e2e/lab-04/ticket-resolution.spec.ts | Pass (#69) |
| E2E-04 | E2E | AC-26, AC-18 | Staff dashboard card → filtered queue count matches | pass | e2e/lab-04/dashboards.spec.ts | Pass (#69) |
| E2E-05 | E2E | AC-02, AC-26 | Requester dashboard → filtered My Tickets; only own tickets | pass | e2e/lab-04/dashboards.spec.ts | Pass (#69) |
| STYLE-01 | UI style / responsive | AC-27 | No horizontal overflow on dashboards + ticket detail at 375/768/1280; screenshots | pass | e2e/lab-04/visual-inspection.spec.ts | Pass (#69) |
| REG-01 | Regression | AC-28 | All Lab 1–3 + full-app server tests | pass | server/tests/{lab-01,lab-02,lab-03,full-app} | Pass (#69) |
| REG-02 | Regression | AC-28 | All Lab 1–3 client tests | pass | client/tests/{lab-01,lab-02,lab-03,full-app} | Pass (#69) |
| REG-03 | Regression | AC-28 | Lab 2 + Lab 3 E2E | pass | e2e/lab-02, e2e/lab-03 | Pass (#69) |

## 3. AC → test traceability

| AC | Tests |
|---|---|
| AC-01 | API-03, API-04 |
| AC-02 | DASH-01, E2E-05 |
| AC-03 | E2E-01 |
| AC-04 | API-05, UNIT-02, UI-04 |
| AC-05 | API-06, UNIT-02, UI-04 |
| AC-06 | API-07 |
| AC-07 | API-01, API-02, UI-07, E2E-02 |
| AC-08 | API-09, UI-06 |
| AC-09 | API-10, UNIT-01 |
| AC-10 | WF-01, WF-02, UNIT-04, E2E-03 |
| AC-11 | WF-03 |
| AC-12 | WF-04, WF-09 |
| AC-13 | WF-05, WF-06 |
| AC-14 | WF-07 |
| AC-15 | DASH-05, DASH-06 |
| AC-16 | DASH-02, DASH-09 |
| AC-17 | DASH-03, UI-02, UI-03 |
| AC-18 | DASH-04, DASH-07, E2E-04 |
| AC-19 | DASH-08, UI-02 |
| AC-20 | API-12 |
| AC-21 | MIG-01, MIG-02 |
| AC-22 | WF-08 |
| AC-23 | API-13 |
| AC-24 | UI-04, UI-05, UI-07 |
| AC-25 | UI-08, UI-09, E2E-03 |
| AC-26 | UI-01, UI-02, UI-03, E2E-04, E2E-05 |
| AC-27 | STYLE-01 |
| AC-28 | REG-01, REG-02, REG-03 |
| AC-29 | PERF-01 |

## 4. Intentional regression updates

Lab 3 tests that resolved a Ticket without any Action Taken must first record a Completed action
(specification §14.3). Each such change is listed here when made, with the file and reason.

| Issue | File | Change | Reason |
|---|---|---|---|
| #65 | `server/tests/full-app/tickets.test.ts` | Action edit now sends `version` | BR-12: Action Taken edits require the last-seen version |
| #67 | `server/tests/full-app/tickets.test.ts` (3 sites), `lab-03/requester-appears-resolved.api.test.ts` (2), `lab-03/staff-ticket-detail.api.test.ts` (2) | Call `tests/helpers/recordCompletedAction.ts` before resolving | BR-15 resolution gate: these 8 tests resolved tickets with no Completed action and failed with `409 RESOLUTION_GATE` — the intended new behavior |
| #68 | `client/tests/{lab-02/MyTickets,lab-03/StaffTicketQueue,full-app/pages}.test.tsx` | Import `MyTicketsPage` / `TicketQueuePage` (renamed files) | The list pages moved from `/dashboard` to `/tickets` and `/queue`; `/dashboard` is now the metric dashboard (FR-12..FR-14). Assertions unchanged |
| #68 | `e2e/lab-02/requester-ticket-flow.spec.ts`, `e2e/lab-03/{authentication,staff-ticket-flow,visual-inspection}.spec.ts` | After login, expect the dashboard greeting and open My Tickets / Ticket Queue via the nav | Same route move; the list-behaviour assertions are unchanged |
| #68 | `e2e/lab-03/staff-ticket-flow.spec.ts` | `getByText('Waiting for Requester', { exact: true })` | The new aria-live "Status changed to Waiting for Requester" announcement also matched the loose locator |
| #68 | `server/vitest.config.mts` | `fileParallelism: false` | All API test files share one DB; parallel files made "dashboard value == DB count" checks race other files' inserts (each dashboard file passed alone) |
| #67 | `server/tests/full-app/tickets.test.ts` | The action-edit step also completes the action (`status: COMPLETED`, `result`) | Under Lab 4 a description-only action defaults to Planned (open work), which correctly blocked resolving the shared lifecycle ticket |

## 5. Results log

| Date | Branch | Command | Result |
|---|---|---|---|
| 2026-10-07 | `feat/issue-65-actions-taken-api` | `server: npx vitest run` | 23 files, **225/225 passed** (181 Lab 1–3 + 44 Lab 4) |
| 2026-10-07 | `feat/issue-65-actions-taken-api` | `client: npx vitest run` | 12 files, **45/45 passed** |
| 2026-10-07 | `feat/issue-69-hardening` (full stack of #71–#76) | `server: npx vitest run` | 26 files, **261/261 passed** |
| 2026-10-07 | `feat/issue-69-hardening` | `client: npx vitest run` | 16 files, **85/85 passed** |
| 2026-10-07 | `feat/issue-69-hardening` | `e2e: npx playwright test` (Lab 2 + 3 + 4), API on `toktickit_test` | **26/26 passed** — **372/372 in total** |
| 2026-10-07 | `feat/issue-69-hardening` | `e2e/lab-04/visual-inspection` on the seeded dev DB | 5/5 passed, 37 screenshots committed, 0 px overflow at 1280/800/375. Found + fixed: Actions Taken table overflowed at 800 px |
| 2026-10-07 | `feat/issue-69-hardening` | `e2e/lab-04` first run | Found + fixed a real bug: an action dated "now" in the same minute the ticket was created was rejected (BR-10 now minute precision; unit test added) |
| 2026-10-07 | `feat/issue-68-dashboards` | `server: npx vitest run` (sequential files) | 26 files, **260/260 passed** in 36 s |
| 2026-10-07 | `feat/issue-68-dashboards` | `client: npx vitest run` | 16 files, **85/85 passed** |
| 2026-10-07 | `feat/issue-68-dashboards` | `e2e: npx playwright test` (Lab 2 + Lab 3), API on `toktickit_test` | **17/17 passed**. Note: on the dev DB the `admin@toktickit.dev` password was changed on 2026-09-19, so admin E2E steps must run against a DB with seed passwords |
| 2026-10-07 | `feat/issue-68-dashboards` | Playwright screenshots of all 3 role dashboards, 1280 + 375 px | 0 console errors, 0 px horizontal overflow |
| 2026-10-07 | `feat/issue-67-ticket-workflow` | `server: npx vitest run` | 24 files, **245/245 passed** (20 new in `ticket-workflow.api.test.ts`, incl. 3-way concurrent resolve → exactly one 200) |
| 2026-10-07 | `feat/issue-67-ticket-workflow` | `client: npx vitest run` | 14 files, **70/70 passed** (16 new in `TicketWorkflow.test.tsx`) |
| 2026-10-07 | `feat/issue-67-ticket-workflow` | Playwright smoke: staff on seeded ticket with open actions | Resolve disabled with "2 actions are still open"; Status History tab shows legacy empty state; 0 console errors |
| 2026-10-07 | `feat/issue-66-actions-taken-ui` | `client: npx vitest run` | 13 files, **54/54 passed** (9 new in `ActionsTaken.test.tsx`) |
| 2026-10-07 | `feat/issue-66-actions-taken-ui` | Manual Playwright smoke against real API (staff adds action at 1280 + 375 px) | Pass; 0 console errors, 0 px horizontal overflow. Found + fixed: line-clamp on `<td>` broke table column layout |
| 2026-10-07 | `feat/issue-65-actions-taken-api` | `prisma migrate deploy` on dev + test DBs, row counts before/after | All 8 tables' counts identical; 6 legacy test-DB actions backfilled (0 violations) |
