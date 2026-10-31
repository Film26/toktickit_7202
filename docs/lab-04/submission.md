# Lab 4 Submission — TokTickIT: Actions Taken, Dashboards, and Final Regression

CPE 334, Semester 1/2026 · Repository: https://github.com/Film26/toktickit_7202 ·
Kanban: https://github.com/users/Film26/projects/11

> **Before exporting to PDF**, complete every item marked **[TO ADD]**. They need things only the
> team can provide: the reviewer's identity and comments, your own reflection, and screenshots
> taken after the PRs are merged into `main`. Links below point at `main`; they work once the
> release PR (Issue #70) is merged. Images use repo-relative paths, so export from the GitHub
> rendering of this file (or any Markdown → PDF tool run inside the repository).

---

## Answer Part 1:

**Git use with engineering workflow (10 points)**

**Issues (11), one Kanban board** — https://github.com/users/Film26/projects/11

| Issue | Scope | PR |
|---|---|---|
| [#64](https://github.com/Film26/toktickit_7202/issues/64) | Sprint 4 engineering contract | [#71](https://github.com/Film26/toktickit_7202/pull/71) |
| [#65](https://github.com/Film26/toktickit_7202/issues/65) | Actions Taken foundation: migration, model, seed, API | [#72](https://github.com/Film26/toktickit_7202/pull/72) |
| [#66](https://github.com/Film26/toktickit_7202/issues/66) | Actions Taken UI on Ticket Detail | [#73](https://github.com/Film26/toktickit_7202/pull/73) |
| [#67](https://github.com/Film26/toktickit_7202/issues/67) | Ticket workflow: resolution gate, status history, stale-update conflicts | [#74](https://github.com/Film26/toktickit_7202/pull/74) |
| [#68](https://github.com/Film26/toktickit_7202/issues/68) | Role dashboards with drill-down | [#75](https://github.com/Film26/toktickit_7202/pull/75) |
| [#69](https://github.com/Film26/toktickit_7202/issues/69) | Final hardening: Lab 4 E2E, visual inspection, README | [#76](https://github.com/Film26/toktickit_7202/pull/76) |
| [#77](https://github.com/Film26/toktickit_7202/issues/77) | Accessibility audit (axe-core) + fixes | [#81](https://github.com/Film26/toktickit_7202/pull/81) |
| [#78](https://github.com/Film26/toktickit_7202/issues/78) | Migration rollback and recovery verification | [#82](https://github.com/Film26/toktickit_7202/pull/82) |
| [#79](https://github.com/Film26/toktickit_7202/issues/79) | Remove temporary dev UI in production + regression sweep | [#83](https://github.com/Film26/toktickit_7202/pull/83) |
| [#80](https://github.com/Film26/toktickit_7202/issues/80) | This submission document | *(this PR)* |
| [#70](https://github.com/Film26/toktickit_7202/issues/70) | Release integration `lab4-staging` → `main` | *(release PR)* |

**Branch flow:** one branch per issue → PR → `lab4-staging` → release PR → `main` (same flow as
Labs 2–3). Because each issue builds on the one before (contract → API → UI → …), the PRs are
stacked and merged in order; the full diagram is in
[`docs/lab-04/reviewer.md`](reviewer.md).

**Peer review:** rendered [`docs/lab-04/reviewer.md`](reviewer.md) — reviewer identity, PR links,
comments, responses, approvals.

- **[TO ADD]** Screenshot of the commit graph showing the feature branches merged into
  `lab4-staging` and then `main` (e.g. GitHub *Insights → Network*, or `git log --graph --oneline`).
- **[TO ADD]** Screenshot of the Kanban board with all 11 issues in **Done**.
- **[TO ADD]** Screenshot of rendered `reviewer.md` after the reviewer columns are filled in.

**README and .gitignore:** [`README.md`](../../README.md) — setup, migrate, seed, backup and
rollback, test commands, demo accounts, Lab 4 demo walkthrough, the global-`DATABASE_URL` pitfall.
[`.gitignore`](../../.gitignore) — excludes `node_modules`, `.env` / `.env.test` secrets (keeps the
`.example` templates), build output, logs and uploaded attachment files; `e2e/.gitignore` excludes
Playwright test results and reports.

**Repository structure (Lab 4 increment, handout §12):**

```
docs/lab-04/        specification.md  tests.md  ui-spec.md  api-spec.md  reviewer.md  ai-use.md  submission.md
server/tests/lab-04/
  actions-taken.api.test.ts       ticket-workflow.api.test.ts
  requester-dashboard.api.test.ts staff-dashboard.api.test.ts
  action-rules.unit.test.ts       migration-seed.test.ts  migration-rollback.test.ts
  dev-tools-production.api.test.ts  dashboard-helpers.ts
client/tests/lab-04/
  StaffDashboard.test.tsx  RequesterDashboard.test.tsx  ActionsTaken.test.tsx  TicketWorkflow.test.tsx  helpers.tsx
e2e/lab-04/
  actions-taken-flow.spec.ts  ticket-resolution.spec.ts  dashboards.spec.ts
  accessibility.spec.ts  regression-sweep.spec.ts  visual-inspection.spec.ts  regression-screens.spec.ts
artifacts/lab-04/screenshots/
  staff-dashboard/  requester-dashboard/  actions-taken/  regression/
server/prisma/migrations/
  20261006000000_lab4_actions_taken/   (migration.sql + down.sql)
  20261007000000_lab4_ticket_workflow/ (migration.sql + down.sql)
```

---

## Answer Part 2:

**Spec DD (5 points)** — [`docs/lab-04/specification.md`](specification.md), with
[`ui-spec.md`](ui-spec.md) and [`api-spec.md`](api-spec.md).

| Required content | Where |
|---|---|
| Numbered requirements | §5 FR-01 … FR-19 |
| Business rules (assignment, dates, statuses, resolution gate, dashboards) | §6 BR-01 … BR-25 |
| Actions Taken rules (fields, assignee, status moves, follow-up, locking, no delete) | §6 BR-01 … BR-13 |
| Ticket transition rules | §7 final transition matrix (every from → to, trigger, role, extra rule) |
| Dashboard calculations | §8 — exact query, label, "+N today" rule and drill-down link per card; Asia/Bangkok day boundary (BR-22) |
| Acceptance criteria | §12 AC-01 … AC-29 |
| Migration decisions | §10 — 5 justified database decisions, backfill rule (BR-24), tested rollback/recovery |
| Product Definition of Done | §13 |
| Assumptions and decisions | §14 (e.g. why Assigned To and action status were added) |

**Evidence that the specification came before implementation:**
the contract commit `866a59e` ("Add Lab 4 engineering contract (Issue #64)") is dated
2026-10-06 23:56 (+07:00), and its PR [#71](https://github.com/Film26/toktickit_7202/pull/71)
was opened at 16:56 UTC — before the first implementation PR
[#72](https://github.com/Film26/toktickit_7202/pull/72) (17:03 UTC). Every implementation PR is
stacked on top of #71.

- **[TO ADD]** Screenshot of PR #71 showing its creation time next to PR #72's.

---

## Answer Part 3:

**Test DD and traceability (10 points)** — [`docs/lab-04/tests.md`](tests.md)

- §2: every planned test with ID, type, requirement/AC, what it tests, expected result, the
  **actual test file path**, and its final status (all **Pass**).
- §3: AC → test traceability; every AC-01 … AC-29 maps to at least one test.
- §4: every Lab 1–3 test changed on purpose, with the reason (e.g. the resolution gate means a
  ticket now needs a Completed action before it can be resolved).
- §5: log of real runs, including the bugs those runs found.

**Final results on the complete Lab 4 code (2026-10-09):**

| Suite | Command | Result |
|---|---|---|
| Server unit + API/integration + authorization + workflow + migration/regression (Labs 1–4) | `cd server && npm test` | **268 / 268 passed** (28 files) |
| Client UI component (Labs 1–4) | `cd client && npm test` | **85 / 85 passed** (16 files) |
| End-to-end, accessibility, regression sweep, visual (Labs 2–4) | `cd e2e && npx playwright test` | **40 / 40 passed** |
| **Total** | | **393 / 393** |

- **[TO ADD]** Screenshots of the three terminal outputs, run on `main` after the merge.

---

## Answer Part 4:

**AI use with reflection (5 points)** — [`docs/lab-04/ai-use.md`](ai-use.md): names the LLM
(Claude Opus 5.5 via Claude Code) and lists the key prompts, what each produced, and what
had to be checked or corrected.

- **[TO ADD]** "My Reflection" in your own words in `ai-use.md` (specification-agent use vs.
  coding-agent use), then a screenshot of the rendered file.

---

## Answer Part 5:

**Working IT Staff Dashboard UI (5 points)**

| Requirement | Evidence |
|---|---|
| Operational metrics (New, Open, In Progress, Waiting for Requester, My Assigned, Unassigned) with "+N today" | ![IT Staff dashboard](../../artifacts/lab-04/screenshots/staff-dashboard/01-dashboard-desktop.png) |
| Current user's Actions Taken | "My Open Actions Taken" card on the same screen |
| Recent / urgent tickets | "My Recent Tickets" and "Open Tickets by IT Priority" cards |
| Drill-down | ![Drill-down: My Assigned](../../artifacts/lab-04/screenshots/staff-dashboard/02-drill-down-my-assigned-desktop.png) |
| Safe failure (with Retry) | ![Safe failure](../../artifacts/lab-04/screenshots/staff-dashboard/04-safe-failure-desktop.png) |
| Loading, empty, forbidden | `client/tests/lab-04/StaffDashboard.test.tsx` UI-02 (loading spinner, empty-state messages, 403 message without Retry) |
| Responsive | tablet / mobile: `staff-dashboard/01-dashboard-tablet.png`, `01-dashboard-mobile.png`, `03-mobile-menu-open-mobile.png` |
| **Metrics match database queries** | `server/tests/lab-04/staff-dashboard.api.test.ts` DASH-05 compares every card with a direct `prisma.ticket.count(...)`; DASH-07 opens every card's drill-down and checks the list's `totalCount` equals the card; `e2e/lab-04/dashboards.spec.ts` does the same in the browser. Query definitions: specification §8.2 |

---

## Answer Part 6:

**Working Actions Taken UI (10 points)**

| Requirement | Evidence |
|---|---|
| List, several different Actions Taken on one ticket (by different staff, mixed statuses) | ![Actions Taken list](../../artifacts/lab-04/screenshots/actions-taken/01-staff-list-desktop.png) |
| Create + validation (inline, under each field) | ![Create validation](../../artifacts/lab-04/screenshots/actions-taken/02-create-validation-desktop.png) |
| Edit / assign / status transition / complete / cancel | ![Edit mode](../../artifacts/lab-04/screenshots/actions-taken/03-edit-mode-desktop.png) — Status, Assigned To, *Start*, *Mark Completed*, *Cancel Action*; E2E `actions-taken-flow.spec.ts` drives plan → assign → edit → complete |
| Inactive-assignee rejection | The form only offers active staff; the backend still rejects inactive / Requester / unknown assignees (`actions-taken.api.test.ts` API-07) and the form shows the server's message under *Assigned To* (`ActionsTaken.test.tsx` UI-05) |
| Role restrictions | ![Requester read-only](../../artifacts/lab-04/screenshots/actions-taken/06-requester-read-only-desktop.png) ![Requester view panel](../../artifacts/lab-04/screenshots/actions-taken/07-requester-view-panel-desktop.png) — Requester API writes return 403 (API-02) |
| Safe failures | Entered data kept after a failure, Save disabled while saving, retry cannot duplicate (`clientRequestId`), stale edit → conflict banner with Reload (UI-05, UI-06, API-09, API-12) |
| Responsive | `actions-taken/*-tablet.png`, `*-mobile.png` (table on desktop, stacked cards on tablet/mobile) |

---

## Answer Part 7:

**Working Ticket workflow (5 points)**

| Requirement | Evidence |
|---|---|
| Permitted transitions only | specification §7; UI buttons come from one matrix helper (`TicketWorkflow.test.tsx` UI-08 checks every status × role); non-matrix transitions → 409 (WF-07) |
| Resolution gate | ![Resolution gate](../../artifacts/lab-04/screenshots/actions-taken/04-resolution-gate-desktop.png) — also enforced by the backend when the screen is bypassed (E2E `ticket-resolution.spec.ts`, WF-01) |
| Stable ordering | Actions Taken ordered by Action Date/Time then id (API-01); history ordered by time then id |
| Append-only behaviour | ![Status History](../../artifacts/lab-04/screenshots/actions-taken/05-status-history-desktop.png) — one row per change (WF-04); no edit or delete endpoint for history or Actions Taken (WF-09) |
| Role-appropriate visibility | History visible to the Requester and staff; Internal Notes never sent to Requesters; Requester actions limited to Confirm / Reject / Request Reopening |
| Concurrent changes | Stale `version` → 409 STALE_UPDATE; 3 simultaneous resolves → exactly one succeeds (WF-05, WF-06) |

---

## Answer Part 8:

**Working Requester Dashboard and final regression UI (5 points)**

| Requirement | Evidence |
|---|---|
| Requester-owned metrics, recent and attention-required tickets | ![Requester dashboard](../../artifacts/lab-04/screenshots/requester-dashboard/01-dashboard-desktop.png) |
| Drill-down | ![Drill-down: open tickets](../../artifacts/lab-04/screenshots/requester-dashboard/02-drill-down-open-desktop.png) |
| Ownership protection | DASH-01 (only own tickets in every metric/list), DASH-02 (staff → 403), E2E-05 (another Requester's ticket shows "Ticket not found") |

**Representative regression (Labs 1–3 still working in the Lab 4 app):**

| Feature | Screenshot |
|---|---|
| Authentication (invalid credentials) | ![](../../artifacts/lab-04/screenshots/regression/01-login-invalid-credentials.png) |
| Role protection | ![](../../artifacts/lab-04/screenshots/regression/02-requester-blocked-from-admin.png) |
| My Tickets | ![](../../artifacts/lab-04/screenshots/regression/03-requester-my-tickets.png) |
| Create Ticket validation | ![](../../artifacts/lab-04/screenshots/regression/04-requester-create-ticket-validation.png) |
| Ticket Detail + Public Comments | ![](../../artifacts/lab-04/screenshots/regression/05-requester-ticket-detail-public-comments.png) |
| Attachments | ![](../../artifacts/lab-04/screenshots/regression/06-requester-attachments.png) |
| IT Staff Ticket Queue | ![](../../artifacts/lab-04/screenshots/regression/07-staff-ticket-queue.png) |
| Internal Notes | ![](../../artifacts/lab-04/screenshots/regression/08-staff-internal-notes.png) |
| Administrator User Management | ![](../../artifacts/lab-04/screenshots/regression/09-admin-user-management.png) |
| Reference Data | ![](../../artifacts/lab-04/screenshots/regression/10-admin-reference-data.png) |

Automated regression: all Lab 1–3 server and client tests and the Lab 2–3 E2E specs still pass,
and `e2e/lab-04/regression-sweep.spec.ts` visits every screen and dashboard link for each role
with no console errors, failed API calls or broken links.

---

## Answer Part 9:

**Zen Green UI, responsive, accessibility, and final polish (5 points)**

- Rendered [`docs/lab-04/ui-spec.md`](ui-spec.md); the completed visual and accessibility
  checklist is in §10 (design consistency, dashboards, Actions Taken, editable vs read-only
  fields, validation placement, keyboard focus, clipping, overlap, horizontal overflow), together
  with the issues found and fixed.
- **Desktop / tablet / mobile** screenshots of every Lab 4 screen: `artifacts/lab-04/screenshots/`
  (`staff-dashboard/`, `requester-dashboard/`, `actions-taken/`, 37 files). The capture test
  fails if any page scrolls horizontally at 1280, 800 or 375 px.

| Screen | Desktop | Tablet | Mobile |
|---|---|---|---|
| IT Staff Dashboard | ![](../../artifacts/lab-04/screenshots/staff-dashboard/01-dashboard-desktop.png) | ![](../../artifacts/lab-04/screenshots/staff-dashboard/01-dashboard-tablet.png) | ![](../../artifacts/lab-04/screenshots/staff-dashboard/01-dashboard-mobile.png) |
| Requester Dashboard | ![](../../artifacts/lab-04/screenshots/requester-dashboard/01-dashboard-desktop.png) | ![](../../artifacts/lab-04/screenshots/requester-dashboard/01-dashboard-tablet.png) | ![](../../artifacts/lab-04/screenshots/requester-dashboard/01-dashboard-mobile.png) |
| Actions Taken | ![](../../artifacts/lab-04/screenshots/actions-taken/01-staff-list-desktop.png) | ![](../../artifacts/lab-04/screenshots/actions-taken/01-staff-list-tablet.png) | ![](../../artifacts/lab-04/screenshots/actions-taken/01-staff-list-mobile.png) |
| Action form (validation) | ![](../../artifacts/lab-04/screenshots/actions-taken/02-create-validation-desktop.png) | ![](../../artifacts/lab-04/screenshots/actions-taken/02-create-validation-tablet.png) | ![](../../artifacts/lab-04/screenshots/actions-taken/02-create-validation-mobile.png) |

- **Accessibility:** `e2e/lab-04/accessibility.spec.ts` scans every Lab 4 screen plus Login and
  Create Ticket with axe-core (WCAG 2.1 A/AA) — **0 violations** after fixing three colour-contrast
  problems — and completes the Actions Taken flow with the keyboard only.
