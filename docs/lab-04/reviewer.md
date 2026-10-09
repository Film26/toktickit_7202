# Peer Review Record — Lab 4

## Reviewer identity

- Reviewer: *(teammate name + GitHub handle — fill in when the first review is recorded)*
- Rule carried over from `docs/lab-03/reviewer.md`: a row's review columns are filled in only
  after the review is actually recorded on GitHub (`gh pr view <n> --json reviews`), never
  backfilled from memory. Lab 3's PRs #52–58 were merged with no GitHub review recorded; Lab 4
  PRs are **not** merged until a review is recorded.

## Branch flow

Each issue has its own branch; the PRs are **stacked** because each builds on the one before
(the contract, then the API, then the UI that uses it):

```
lab4-staging ← #71 docs/issue-64-lab-04-contract
                 ← #72 feat/issue-65-actions-taken-api
                     ← #73 feat/issue-66-actions-taken-ui
                         ← #74 feat/issue-67-ticket-workflow
                             ← #75 feat/issue-68-dashboards
                                 ← #76 feat/issue-69-hardening
```

Merge in order #71 → #76. When a base PR merges into `lab4-staging`, GitHub retargets the next
PR to `lab4-staging`, so every feature lands in `lab4-staging` through its own reviewed PR.
Then the release PR `lab4-staging → main` (Issue #70).
Kanban: https://github.com/users/Film26/projects/11

## Reviewed Pull Requests

| PR | Issue | Title | Reviewer comment (summary) | Author response | Review | Merged |
|---|---|---|---|---|---|---|
| [#71](https://github.com/Film26/toktickit_7202/pull/71) | #64 | Lab 4 engineering contract (spec, api-spec, ui-spec, tests) | *(awaiting review)* | | | No |
| [#72](https://github.com/Film26/toktickit_7202/pull/72) | #65 | Actions Taken foundation (migration, model, seed, API) | *(awaiting review)* | | | No |
| [#73](https://github.com/Film26/toktickit_7202/pull/73) | #66 | Actions Taken UI on Ticket Detail | *(awaiting review)* | | | No |
| [#74](https://github.com/Film26/toktickit_7202/pull/74) | #67 | Ticket workflow: resolution gate, status history, stale-update conflicts | *(awaiting review)* | | | No |
| [#75](https://github.com/Film26/toktickit_7202/pull/75) | #68 | Role dashboards with drill-down | *(awaiting review)* | | | No |
| [#76](https://github.com/Film26/toktickit_7202/pull/76) | #69 | Final hardening: Lab 4 E2E, visual inspection, README | *(awaiting review)* | | | No |
| *(release)* | #70 | `lab4-staging` → `main` | | | | |

## Suggested review focus (for the reviewer)

- #71: spec §14 decisions — assignee + action status added to match grading Part 6; resolution
  requires ≥1 Completed action.
- #74: the 8 Lab 1–3 tests changed to record a Completed action before resolving
  (`docs/lab-04/tests.md` §4) — confirm this is the new rule working, not a weakened test.
- #75: `/dashboard` is now a dashboard; My Tickets / Ticket Queue moved to `/tickets` / `/queue`.
