# AI Use and Reflection — Lab 4

LLM used: Claude (Anthropic, Opus 5.5) via Claude Code in VS Code, working in this repository
(specification agent and coding agent in the same session, with the human reviewing each PR).

## Selected key prompts

| # | Prompt (paraphrased) | What it produced |
|---|---|---|
| 1 | (Uploaded the Lab 4 handout PDF + my Thai-language notes from class) "Do Lab 4 — it still needs PRs, Issues and a Project." | Read the handout and the notes, then read the real code first (`schema.prisma`, `tickets.controller.ts`, `TicketDetailView.tsx`, the Lab 3 spec) before planning. Found that `ActionTaken` already existed with only a description, that the "dashboards" were really list pages, and that Lab 3 had deferred the resolution gate to Lab 4. |
| 2 | (Same session) Set up the sprint. | Created the "TokTickIT Lab 4 Kanban" project (copied from the Lab 3 board so the Todo/In Progress/Done columns match), Issues #64–#70 following handout §11, and branch `lab4-staging`. |
| 3 | (Same session) Write the engineering contract before coding. | `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md` on `docs/issue-64-lab-04-contract`. Noticed that the grading table (Part 6) expects an assignee, action statuses and inactive-assignee rejection even though the stakeholder field list does not mention them, so they were added and justified in spec §14. |

*(More prompts are added as the sprint continues.)*

## My Reflection

*(Write this in your own words before submission — what helped, what you had to correct, and what
you would do differently with the specification agent vs. the coding agent.)*
