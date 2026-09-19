# Peer Review Record — Lab 3

## Reviewer identity

- Reviewer: a classmate/peer (per-PR reviewer identity not recorded on GitHub for #52–58 — see the
  gap noted below).
- This file is updated after each Lab 3 PR is actually reviewed on GitHub — it is not
  pre-written or backfilled from memory, per the lesson learned in `docs/lab-02/reviewer.md`
  (PR #35: a release was approved with a known gap still open, and PRs #36/#37 merged without
  review at all before that was caught and corrected).

## Known gap: PRs #52–58 have no recorded GitHub review

Checked via `gh pr view <n> --json reviews,reviewDecision` for each: all seven came back with an
empty `reviews` array and no `reviewDecision`, and were merged by the author (`Film26`) with no
review recorded on GitHub. Peer review of this work did happen (informally, with a classmate,
outside the PR itself), but it isn't captured as a GitHub review/approval/comment thread on any of
these PRs — which is the same failure mode this doc already calls out for Lab 2 (PR #35–37).
Logged here honestly rather than fabricated after the fact; going forward (#59, #60, and the final
release PR), get the review recorded as an actual GitHub review before merging.

## Reviewed Pull Requests

| PR | Title | Reviewer comment (summary) | Author response | Review | Merged |
|---|---|---|---|---|---|
| [#52](https://github.com/Film26/toktickit_7202/pull/52) | Lab 3 engineering contract: specification, api-spec, ui-spec | *(not recorded on GitHub — see gap above)* | — | *(none recorded)* | Yes |
| [#53](https://github.com/Film26/toktickit_7202/pull/53) | Issue #42: Ticket status workflow (Open, Waiting for Requester, Cancelled) | *(not recorded on GitHub — see gap above)* | — | *(none recorded)* | Yes |
| [#54](https://github.com/Film26/toktickit_7202/pull/54) | Issue #45: Administrator safety rules | *(not recorded on GitHub — see gap above)* | — | *(none recorded)* | Yes |
| [#55](https://github.com/Film26/toktickit_7202/pull/55) | Issue #43: Requester "Problem Appears Resolved" signal | *(not recorded on GitHub — see gap above)* | — | *(none recorded)* | Yes |
| [#56](https://github.com/Film26/toktickit_7202/pull/56) | Issue #47: Auth & authorization hardening | *(not recorded on GitHub — see gap above)* | — | *(none recorded)* | Yes |
| [#57](https://github.com/Film26/toktickit_7202/pull/57) | Issue #44: IT Staff Queue sort + pagination parity | Had a real merge conflict against `lab3-staging` (STATUSES/SORTABLE_FIELDS both touched by #53 and #57) — resolved by combining both arrays, verified by re-running the full test suite before merging. | Conflict resolved, tests re-verified, then merged. | Conflict review (not a GitHub PR review) | Yes |
| [#58](https://github.com/Film26/toktickit_7202/pull/58) | Issue #48: Extend seed data to Lab 3 minimums + idempotency tests | *(not recorded on GitHub — see gap above)* | — | *(none recorded)* | Yes |
| [#59](https://github.com/Film26/toktickit_7202/pull/59) | Issue #49 (Part A): Lab 3 E2E test coverage | Adds `e2e/lab-03/{authentication,staff-ticket-flow,user-administration}.spec.ts`. Found and fixed a real bug via E2E: the Owner-reassignment dropdown called the Administrator-only `GET /api/users`, so it silently failed for any plain IT Staff session — fixed with a new staff-gated `GET /api/tickets/assignable-owners` endpoint instead of loosening `/api/users/*`. | — | *(open — awaiting review)* | No |
| [#60](https://github.com/Film26/toktickit_7202/pull/60) | Issue #49 (Part B): Lab 3 visual inspection + screenshots | Captures desktop/tablet/mobile screenshots of every Lab 3 screen; found `docs/lab-03/ui-spec.md` described several components (`RoleBadge`, `ForbiddenAlert`, sort-header toggles, a copy-to-clipboard button, a separate Edit User panel) that were never built, and corrected the doc; found and fixed a real gap where Internal Notes had no visual distinction from Public Comments (handout §8.4). | — | *(open — awaiting review)* | No |

## Note on scope

This record covers Pull Requests opened against `lab3-staging` for this repository's Lab 3
increment. Every feature branch listed in the Lab 3 Kanban board
(https://github.com/users/Film26/projects/10) should have a row here before Issue #51 (release
integration) closes. #59 and #60 are still open — this table will be updated with their actual
review outcome once reviewed and merged, not backfilled in advance.
