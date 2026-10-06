# AI Use and Reflection — Lab 4

LLM used: **Claude (Anthropic, Opus 5.5)** via Claude Code in VS Code, working directly in this
repository. The same session acted as the specification agent (writing the contract first) and
the coding agent (implementing each issue on its own branch); the human owner reviewed the plan,
and each PR is reviewed by a teammate before merging.

## Selected key prompts

| # | Prompt (paraphrased) | What it produced |
|---|---|---|
| 1 | (Uploaded the Lab 4 handout PDF + my Thai-language class notes) "Do Lab 4 — it still needs PRs, Issues and a Project." | Read the real code before planning (`schema.prisma`, `tickets.controller.ts`, `TicketDetailView.tsx`, the Lab 3 spec). Found that `ActionTaken` already existed with only a description, that the "dashboards" were really the My Tickets / Queue list pages, and that Lab 3 had deferred the resolution gate to Lab 4. |
| 2 | (Same request) Set up the sprint the same way as Labs 2–3. | Copied the Lab 3 board into "TokTickIT Lab 4 Kanban" (same Todo / In Progress / Done columns), created Issues #64–#70 following handout §11, and branch `lab4-staging`. |
| 3 | Write the engineering contract before coding. | `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md` (PR #71, opened before any implementation PR). Noticed that grading Part 6 expects an assignee, action statuses and inactive-assignee rejection although the stakeholder field list omits them; added and justified them in spec §14. |
| 4 | "ทำต่อเลยค่ะ" (continue) — implement Issue #65. | Additive migration + backfill, verified on both databases by snapshotting every table's row count before and after. Discovered that a global `DATABASE_URL` for a different project silently overrode `server/.env`, so every Prisma command was explicitly pointed at the TokTickIT databases (documented in README). |
| 5 | (Continuing) Issue #67 — the resolution gate. | Gate + status history + conditional updates. The gate made 8 Lab 1–3 tests fail; checked that every failure was exactly `409 RESOLUTION_GATE` before changing them, and logged each change in `tests.md` §4. Also found that comment/resolve forms cleared the user's text even when saving failed, and fixed it. |
| 6 | (Continuing) Issue #68 — dashboards. | Off-by-one mismatches between dashboard values and DB counts were traced to test files running in parallel on one shared database (each file passed alone), not to the dashboard code; made server test files run sequentially. |
| 7 | (Continuing) Issue #69 — E2E and screenshots. | The new E2E found a real bug (an action dated "now" in the same minute the ticket was created was rejected); the overflow check found the Actions Taken table breaking the page at tablet width. Both fixed and recorded. Final run: 372/372 tests. |

## My Reflection

*(Write this in your own words before submission — e.g. what the specification agent helped
you decide, where you had to check or correct the coding agent, and what you would do
differently next time.)*
