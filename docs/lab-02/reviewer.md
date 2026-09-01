# Peer Review Record

## Reviewer identity

- Reviewer: **jaruwan18** (GitHub handle)
- Reviewed 8 Pull Requests between 2026-08-30 and 2026-09-01, each with a substantive comment and an explicit **Approved** review before merge.

## Reviewed Pull Requests

| PR | Title | Reviewer comment (summary) | Author response | Review | Merged |
|---|---|---|---|---|---|
| [#16](https://github.com/Film26/toktickit_7202/pull/16) | Docs/lab 02 documentation | Spec/tests docs were written after the code; asked for timeline evidence that they predate implementation, and flagged that the PR targets `dev/full-app` instead of `lab2-staging` per the required branch flow. | Added a "Timeline Evidence" section with real timestamps to `specification.md`, plus a scope note explaining the branch flow. | APPROVED (2026-08-30) | 2026-08-31 |
| [#29](https://github.com/Film26/toktickit_7202/pull/29) | Add test coverage for priority update and reject-resolution | Noted that priority-update / reject-resolution / Reopened are IT Staff / post-creation lifecycle features excluded from Lab 2 scope; asked whether this test coverage belongs in a later sprint, and repeated the `lab2-staging` branch-flow note. | Added scope notes to BR-05/BR-06 clarifying this is pre-existing code from before Lab 2, not new Lab 2 scope. | APPROVED (2026-08-30) | 2026-08-31 |
| [#30](https://github.com/Film26/toktickit_7202/pull/30) | Apply the Zen Green UI theme | Colors matched the Zen Green spec; asked to confirm responsive behavior at all 3 breakpoints, especially no horizontal overflow on mobile. | Verified all 3 viewport sizes with Playwright; confirmed no page-level horizontal overflow. | APPROVED (2026-08-30) | 2026-08-31 |
| [#31](https://github.com/Film26/toktickit_7202/pull/31) | Add search, sort, and pagination to My Tickets | Search/sort/pagination looked complete; asked for a status-filter test and for the no-results state (search finds nothing) to be distinguished from the empty state (no tickets at all), per the labsheet. | Added status-filter tests (client + server) and separated the two empty-state messages. | APPROVED (2026-08-30) | 2026-08-31 |
| [#32](https://github.com/Film26/toktickit_7202/pull/32) | Implement attachment upload validation and soft removal | Soft removal and blocked download looked correct; asked to also confirm removed attachments can't be previewed, not just downloaded. | Confirmed there is no separate preview route or static file serving for removed attachments, and added a test for it. | APPROVED (2026-08-30) | 2026-08-31 |
| [#33](https://github.com/Film26/toktickit_7202/pull/33) | Seed an inactive requester user | The seeded inactive requester was correct, but noted the login-rejection test may be testing more than Lab 2 needs, since Lab 2 doesn't use real login — the key check should be that the inactive requester is excluded from the Development Requester Selector. | Added a note that the existing test is the "closest equivalent" available at the time, since no real selector endpoint existed yet to test directly. | APPROVED (2026-08-30) | 2026-08-31 |
| [#34](https://github.com/Film26/toktickit_7202/pull/34) | Create Ticket: per-field validation and inline attachment upload | Field-level validation matched the labsheet; asked to confirm required-field asterisks and the Submit button's busy/disabled state per Section 8.3. | Added red asterisks to Category/Summary/Description; confirmed busy+disabled Submit state was already present. | APPROVED (2026-08-30) | 2026-08-31 |
| [#35](https://github.com/Film26/toktickit_7202/pull/35) | Lab 2 release: merge lab2-staging into main | Flagged that the release's "known gaps" section admitted there was no real Development Requester Selector and real auth was used instead — noted this needed to be fixed before merge, since the labsheet requires a dedicated test-only selector and treats authentication as out of scope. | (Merged with the gap still open; tracked as follow-up.) | APPROVED (2026-09-01) | 2026-09-01 |

## Outstanding review gap (being addressed now)

- [#36](https://github.com/Film26/toktickit_7202/pull/36) ("Add a real Development Requester Selector") and [#37](https://github.com/Film26/toktickit_7202/pull/37) merged **without** a jaruwan18 review — and #36 is the PR that reviewer feedback on #35 had specifically asked for, yet it still wired the selector through real email/password login (`POST /api/auth/login`) rather than a password-free testing mechanism.
- This has since been corrected: the selector now calls a dedicated no-password endpoint (`POST /api/requesters/dev-select`) that only ever sessions an active `REQUESTER` account, addressing jaruwan18's #35 comment. That fix, plus the test/documentation restructuring and expanded seed data below, is going up as a new PR and **still needs an actual peer review before merge** — this file will be updated with that review once it happens.

## Note on scope

This record covers Pull Requests actually opened and reviewed on GitHub for this repository. It does not retroactively claim review of commits that predate PR #16 (the earlier `auth`, ticket-lifecycle, IT Staff/Admin code merged directly to `dev/full-app` before the Lab 2 documentation pass began).
