# AI Use and Reflection

LLM used: Claude (Anthropic), via Claude Code, in this repository's `dev/full-app` working tree.

## Selected key prompts

| # | Prompt (paraphrased) | What it produced |
|---|---|---|
| 1 | Read `package.json` for both `client/` and `server/`, and `docs/lab-02/api-spec.md`; fix the root `README.md` so npm script names, folder-structure paths, and the endpoint table match reality; list any script the README references but package.json doesn't have — don't add it; delete the leftover Vite template `client/README.md`. | Rewrote the root `README.md` against the real `package.json` scripts and real Express routes (since `docs/lab-02/api-spec.md` didn't exist yet at that point); deleted `client/README.md`. |
| 2 | (After uploading the Lab 2 labsheet PDF) "Help with the remaining steps, and give a link for a friend's PR." | Prompted a comparison between the labsheet's required Requester-only MVP and the actual `dev/full-app` code, which had already gone past Lab 2 scope (real auth, IT Staff, Admin) while also falling short of some Lab 2 requirements (attachment validation/removal, My Tickets search/sort/pagination, Zen Green theme). |
| 3 | Clarifying question: how to reconcile the repo/labsheet mismatch, and what "PR link for a friend" means. | User chose: write the Lab 2 docs retroactively against the real code, and open a real PR on GitHub now. |
| 4 | (Implicit, from the above decision) Produce `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `reviewer.md`, `ai-use.md` under `docs/lab-02/`, matching actual code rather than the labsheet's mockups. | Six documents written by reading the real Prisma schema, controllers, routes, React pages/components, and existing Vitest/Supertest suites — cross-checked against the labsheet's required sections, with every gap (missing attachment validation, missing search/sort/pagination, missing Zen Green theme, two untested endpoints) called out explicitly instead of omitted. |
| 5 | Open a real PR on GitHub and share the link. | Created a `docs/lab-02-documentation` branch off `dev/full-app`, committed the six files, pushed, and opened a PR via `gh pr create`. |

## My Reflection

*(Starter draft — replace with your own words before submission; this is Claude's summary of the session, not a substitute for a personal reflection.)*

Using an AI agent to write Lab 2's documentation *after* the code already existed, on a branch that had moved well past Lab 2's intended scope, surfaced a real risk: it would have been easy to ask for "Lab 2 compliance docs" and get back documents that quietly claimed things were done when they weren't (attachment validation, My Tickets search, the Zen Green theme, two untested endpoints). The useful check was making the agent read the actual controllers, schema, and test files rather than paraphrasing the handout, and requiring it to flag every place the code diverged from the spec instead of writing around the gaps. The final documents are only as trustworthy as that verification step — I still need to read them myself before submitting, and decide whether to close the gaps (implement real attachment validation, add search/sort/pagination, apply the Zen Green theme) or submit with the gaps disclosed as they are.
