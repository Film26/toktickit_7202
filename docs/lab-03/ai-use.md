# AI Use and Reflection — Lab 3

LLM used: Claude (Anthropic, Sonnet 5), via Claude Code, in this repository on branch
`docs/lab-03-documentation` (off `lab3-staging`).

## Selected key prompts

| # | Prompt (paraphrased) | What it produced |
|---|---|---|
| 1 | (Uploaded the Lab 3 labsheet PDF, plus a personal Thai-language summary of it) "Read the lab carefully; here are the conditions the instructor set." | Read the full handout and cross-checked it against the user's own summary; identified this as the start of a large, multi-week deliverable rather than a single task. |
| 2 | Clarifying question: which part of Lab 3 to start with first. | User chose "set up GitHub Issues/Kanban" over writing the spec first, running database schema work first, or waiting. |
| 3 | (Implicit, from that choice) Decompose Lab 3 into GitHub Issues. | Before writing any issue, read the actual repository state first (`git log`, `git branch -a`, existing GitHub Issues #17–#28) instead of assuming Lab 3 started from a blank slate — this surfaced that real auth/RBAC/IT-Staff/Admin code had already been built ahead of schedule during Lab 2 and then partially decoupled (`docs/lab-02/specification.md` §11). Spawned a read-only Explore agent to produce a 12-point gap analysis (existing vs. wired-in vs. missing) before drafting a single issue, so the issues would describe real gaps instead of re-proposing work already done. Created 11 issues plus a new "TokTickIT Lab 3 Kanban" GitHub Project board. |
| 4 | "Why 11 issues when classmates have 9–10?" | Compared against this repo's own Lab 2 issue-density precedent (`#26`, `#28` — testing and release each tracked as one issue, not split further); proposed and, on confirmation, executed a merge of #46→#47 and #50→#49, closing the two originals as "not planned" with a comment pointing to the surviving issue, and removed them from the project board — landing at 9 issues without losing any scope. |
| 5 | "Continue — we need a teammate to PR this too." | Before writing `docs/lab-03/specification.md`, read the actual current code end to end — `schema.prisma`, every `routes`/`controllers`/`middleware` file under `server/src`, `ticketAccess.ts`, `client/src/router.tsx`, `client/src/components/TicketDetailView.tsx`, and the Lab 2 `seed.ts` — rather than writing the spec from the handout's mockups alone. This caught several things the handout-only reading would have missed or gotten wrong: Public Comments already work for Requesters (so Issue #43 was narrower than first scoped); the existing Confirm/Reject-Resolution loop is a *different* mechanism from the still-missing "Problem Appears Resolved" signal (BR-05) and the two must not be conflated; `itPriority` does not yet default-copy from `requestedPriority` at creation, contrary to handout §4.5; the JWT signing key silently falls back to a hardcoded dev default if unset. Created `lab3-staging` off the completed Lab 2 branch, a `docs/lab-03-documentation` feature branch, and wrote `specification.md`, `api-spec.md`, `ui-spec.md`, this file, and `reviewer.md` before opening a PR for teammate review — so the spec exists before any Lab 3 implementation PR, per the grading requirement. |

## My Reflection

*(Starter draft — replace with your own words before submission; this is Claude's summary of the
session, not a substitute for a personal reflection.)*

The single most useful habit in this session was refusing to plan Lab 3 against the handout alone.
The handout describes Lab 3 as if it starts from Lab 2's Requester-only baseline, but this repo's
actual `lab2-staging` branch already had real auth, RBAC, IT Staff screens, and Admin user
management built and live — a fact that would have been invisible from the PDF and would have led
straight to either duplicating existing work or, worse, writing a specification that claimed things
were "to be built" when they already existed and worked. Making the agent read the real schema,
routes, controllers, and React components before writing a single GitHub Issue or spec sentence is
what turned up that gap, and turned up smaller but real ones too — like the fact that two very
similar-sounding features (the existing Confirm/Reject-Resolution loop and the still-missing
"Problem Appears Resolved" signal from BR-05) are not actually the same thing, which the handout's
wording alone doesn't make obvious. The other habit worth keeping: when the issue count didn't match
what classmates reported, the right move was comparing against this project's own prior precedent
(how Lab 2's issues were actually sized) rather than either defending the original number or blindly
matching a peer's count — and then asking before merging anything, since collapsing issues changes
what a grader sees in the Kanban history.
