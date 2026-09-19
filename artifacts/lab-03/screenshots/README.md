# Lab 3 screenshot evidence

Desktop (1280px) / tablet (800px) / mobile (375px) captures of every Lab 3 screen, taken by
`e2e/lab-03/visual-inspection.spec.ts` against the real dev-mode app (Issue #49, Part B). Organized
by the required `authentication/ | staff-queue/ | staff-ticket-detail/ | user-management/`
structure (see `docs/lab-03/ui-spec.md` §4).

- `authentication/` — Login (default + invalid-credentials error state), forced first-login
  Change Password screen.
- `staff-queue/` — IT Staff Ticket Queue with data, and its "no results" filtered-to-zero state.
- `staff-ticket-detail/` — Requester Ticket Detail (Public Comments), IT Staff Ticket Detail on
  both the Public Comments and Internal Notes tabs (the latter shows the amber-panel distinction
  added during this pass — see `docs/lab-03/ui-spec.md` §2.6).
- `user-management/` — Administrator User Management list, and the create-user success feedback
  state (temporary password banner).

The full visual-checklist write-up (what passed, what's partial, what's a known gap) lives in
`docs/lab-03/ui-spec.md` §6, not here — these images are the evidence it cites.

## Known gap: focus states not covered

Static screenshots can't show `:focus` styling. That checklist item is intentionally left
unverified rather than falsely marked pass — a manual keyboard walk-through (Tab through each
form) is still needed before final submission.
