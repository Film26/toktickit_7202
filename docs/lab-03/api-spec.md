# Lab 3 API Contract

All endpoints are JSON over HTTPS-in-production/HTTP-in-dev. Authenticated endpoints require
`Authorization: Bearer <token>`. `[existing]` endpoints are verified against the current code;
`[new]`/`[changed]` are this sprint's work (see `specification.md` §10 for the FR/BR mapping).

## Auth mechanism

- **Password hashing:** bcrypt, cost factor 10 (`bcryptjs`), on `User.passwordHash`. Never logged,
  never returned in any response.
- **Token:** JWT (`jsonwebtoken`), payload `{ userId }`, signed with `JWT_SECRET` env var,
  `JWT_EXPIRES_IN` env var (default `8h`). Client stores it in `localStorage` and sends it as a
  Bearer header (`client/src/auth/AuthContext.tsx`).
- **Decision (Issue #47):** `JWT_SECRET` currently falls back to a hardcoded dev string
  (`'dev-secret-change-me'`) if the env var is unset (`server/src/lib/jwt.ts:3`). Lab 3 hardens this:
  the server must refuse to start (fail fast) if `JWT_SECRET` is unset outside `NODE_ENV=test`, so a
  misconfigured deployment can never silently sign tokens with a public default.
- **Expiration/logout:** stateless — no server-side blocklist. `requireAuth` re-reads `isActive`
  from the database on every request, so deactivation takes effect immediately (see
  `specification.md` §11.3). Logout is a client-side token discard.
- **CSRF:** not applicable — the token is sent via an `Authorization` header set by JS, never an
  ambient cookie, so there is no cross-site request forgery surface for these endpoints.
- **Safe errors:** every handler below returns a generic message on `401`/`403`/`404` that never
  reveals whether a *specific* other user/resource exists.

## Auth endpoints

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | none | `{ email, password }` | `200 { token, user }` | `400` invalid shape; `401 { error: "Invalid credentials" }` for wrong password / unknown email / inactive account (identical response for all three) |
| POST | `/api/auth/change-password` | Bearer | `{ currentPassword, newPassword }` (`newPassword` ≥ 8 chars) | `200 { status: "ok" }` | `400` invalid shape; `401` current password wrong |
| GET | `/api/auth/me` | Bearer | — | `200 { user }` | `401` missing/invalid/expired token |

`[existing]` — all three, `server/src/controllers/auth.controller.ts`.

## Ticket endpoints (`server/src/routes/tickets.routes.ts`)

All routes below run `requireAuth` then `enforcePasswordChange` first (`403 PASSWORD_CHANGE_REQUIRED`
if the caller must still change their password).

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/api/tickets` | Requester | `[existing]` create; `itPriority` now defaults to `requestedPriority` `[changed]` |
| GET | `/api/tickets/mine` | Requester | `[existing]` own tickets; `status`, `search`, `sort`, `order`, `page`, `pageSize` |
| GET | `/api/tickets` | IT Staff, Admin | `[changed]` queue; adds `sort`, `order`, `page`, `pageSize` to the existing `status`, `ownerId`, `categoryId`, `q` |
| GET | `/api/tickets/:id` | any (ownership-checked) | `[existing]` `404` if a Requester requests a ticket they don't own; Internal Notes stripped for Requester viewers |
| PATCH | `/api/tickets/:id/priority` | Requester (owner) | `[existing]` only while `NEW`/`IN_PROGRESS` |
| PATCH | `/api/tickets/:id/requester-appears-resolved` | Requester (owner) | `[new]` body `{ appearsResolved: boolean }`; `409` if status is `RESOLVED`/`CLOSED`/`CANCELLED`; does not change `status` |
| POST | `/api/tickets/:id/confirm-resolution` | Requester (owner) | `[existing]` `RESOLVED → CLOSED`; `409` unless `RESOLVED` |
| POST | `/api/tickets/:id/reject-resolution` | Requester (owner) | `[existing]` `RESOLVED → REOPENED`; `409` unless `RESOLVED` |
| POST | `/api/tickets/:id/request-reopen` | Requester (owner) | `[existing]` `CLOSED → REOPENED`; `409` unless `CLOSED` |
| PATCH | `/api/tickets/:id/owner` | IT Staff, Admin | `[existing]` body `{ ownerId: number \| null }`; `400` if target isn't an active IT Staff/Admin |
| PATCH | `/api/tickets/:id/it-priority` | IT Staff, Admin | `[existing]` body `{ itPriority }` |
| PATCH | `/api/tickets/:id/status` | IT Staff, Admin | `[changed]` body `{ status }`; matrix extended per `specification.md` §7; `409` on a disallowed pair |
| POST | `/api/tickets/:id/cancel` | IT Staff, Admin | `[new]` only from `NEW`/`OPEN`; `409` otherwise |
| POST | `/api/tickets/:id/resolve` | IT Staff, Admin | `[existing]` body `{ resolutionSummary }`; only from `IN_PROGRESS`/`WAITING_FOR_REQUESTER` `[changed: add WAITING_FOR_REQUESTER]` |
| POST | `/api/tickets/:id/close` | IT Staff, Admin | `[existing]` only from `RESOLVED` |
| POST | `/api/tickets/:id/comments` | any (ownership-checked) | `[existing]` Public Comment, body `{ body }`, `min(1)` |
| POST | `/api/tickets/:id/notes` | IT Staff, Admin | `[existing]` Internal Note, body `{ body }`, `min(1)` |
| POST | `/api/tickets/:id/actions` | IT Staff, Admin | `[existing, out of Lab 3 scope]` Actions Taken — untouched |
| PATCH | `/api/tickets/:id/actions/:actionId` | IT Staff, Admin | `[existing, out of Lab 3 scope]` |
| POST | `/api/tickets/:id/attachments` | any (ownership-checked) | `[existing]` multipart file upload |

Response shapes for `PATCH .../status`, `.../owner`, `.../it-priority`, and the new `.../cancel` /
`.../requester-appears-resolved` all return the updated `Ticket` row (`200`). List endpoints
(`GET /api/tickets`, `GET /api/tickets/mine`) return `{ tickets: Ticket[], pagination: { page,
pageSize, totalCount, totalPages } }` once FR-11 lands — `GET /api/tickets` currently returns a bare
array and will be changed to this shape to match `/mine`.

**Sort/pagination contract (Issue #44):**
- `sort` ∈ `createdAt | ticketNumber | summary | status | requestedPriority | itPriority | updatedAt`
  (extends the existing `SORTABLE_FIELDS` with `itPriority`/`updatedAt` for the queue); default
  `createdAt`.
- `order` ∈ `asc | desc`; default `desc`.
- `page` ≥ 1 (default 1), `pageSize` 1–50 (default 10) — same clamping as `/mine`.
- An invalid `sort`/`order` value silently falls back to the default rather than erroring (matches
  existing `/mine` behavior — no `400` for unknown sort keys).

## User (Administrator) endpoints (`server/src/routes/users.routes.ts`)

All routes run `requireAuth`, `enforcePasswordChange`, then `requireRole('ADMINISTRATOR')` — any
other role gets `403` before the handler runs.

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/api/users` | query: `q?`, `role?`, `isActive?` | `200 User[]` | `[existing]` |
| POST | `/api/users` | `{ email, fullName, role, isActive? }` `[changed: isActive now optional, default true]` | `201 { user, temporaryPassword }` | `400` invalid shape; `409` duplicate email |
| GET | `/api/users/:id` | — | `200 User` | `404` |
| PATCH | `/api/users/:id` | `{ fullName?, email?, role? }` | `200 User` | `400`; `404`; `409` duplicate email `[confirm on edit path — Issue #45]`; `409 { error: "Cannot remove the last active Administrator" }` `[new]` |
| PATCH | `/api/users/:id/status` | `{ isActive }` | `200 User` | `404`; `403 { error: "Cannot deactivate your own account" }` `[new]`; `409 { error: "Cannot deactivate the last active Administrator" }` `[new]` |
| POST | `/api/users/:id/reset-password` | — | `200 { temporaryPassword }` | `404` |

`User` response shape (never includes `passwordHash`): `{ id, email, fullName, role, isActive,
mustChangePassword, createdAt }`.

**Self-deactivation / last-Administrator guard (Issue #45), exact behavior:**
- `PATCH /:id/status` with `{ isActive: false }` where `id === req.user!.id` → `403` (self-action,
  not a resource conflict — the actor is disallowed regardless of admin count).
- `PATCH /:id/status` with `{ isActive: false }` where `id` is an active `ADMINISTRATOR` and it is
  the *only* active Administrator → `409` (a resource-state conflict — the system cannot reach a
  state with zero active Administrators).
- `PATCH /:id` with `{ role: <non-ADMINISTRATOR> }` on the last active Administrator → same `409`
  as above (demotion has the same effect as deactivation for this rule).

## Safe-error conventions (applies to every table above)

| Situation | Status | Notes |
|---|---|---|
| No/garbled Authorization header | 401 | `{ error: "Missing or invalid Authorization header" }` |
| Expired/invalid/tampered token | 401 | `{ error: "Invalid or expired token" }` |
| Token valid but account inactive/deleted | 401 | `{ error: "Account is inactive or no longer exists" }` |
| `mustChangePassword` still true | 403 | `{ error: "PASSWORD_CHANGE_REQUIRED" }` |
| Authenticated, wrong role | 403 | `{ error: "Insufficient permissions" }` |
| Malformed/missing required fields | 400 | Zod-driven, field-specific message where safe |
| Resource doesn't exist / caller can't access it | 404 | Same body whether "truly missing" or "exists but not yours" — never distinguishable (BR-03 angle) |
| Valid state, disallowed transition or duplicate | 409 | Specific, safe message (never leaks other users' data) |
| Unexpected failure | 500 | Generic `{ error: "Internal server error" }`, logged server-side only |
