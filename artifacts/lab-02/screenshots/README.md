# Lab 2 screenshot evidence

This directory holds the committed copies of the Lab 2 submission screenshots, organized by the
required `create-ticket/ | my-tickets/ | ticket-detail/` structure. They are copies of the real
captures in `docs/lab-02/submission-screenshots/part6-create-ticket/`, `part7-my-tickets/`, and
`part8-ticket-detail/` respectively (that directory is intentionally untracked; these copies are
what actually gets committed).

## Known gap: Dev Requester Selector and responsive screenshots are stale

`docs/lab-02/submission-screenshots/part5-login/` and `part9-responsive/` were **not** copied here.
Both predate this session's fix to the Development Requester Selector: the flow they show is the
old real email/password login screen, which has since been replaced with a no-password
`POST /api/requesters/dev-select` flow (see `client/src/pages/DevRequesterSelectPage.tsx` and
`server/src/controllers/requesters.controller.ts`). Presenting those old screenshots as current
evidence would misrepresent how the app behaves today.

**Before final submission**, retake:

- Dev Requester Selector screenshots (select a Development Requester from the dropdown, confirm no
  password field is present anywhere on the screen, land on the dashboard).
- Responsive/viewport screenshots (same views as `part9-responsive/`, captured against the
  current, post-fix app).

Then add them here as a new `dev-requester-select/` (and, if the course structure calls for it, a
`responsive/`) subfolder alongside `create-ticket/`, `my-tickets/`, and `ticket-detail/`.
