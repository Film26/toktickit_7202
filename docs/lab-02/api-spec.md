# API Contract — Requester-Facing Slice

Documents the API surface relevant to Lab 2's Requester scope, as actually implemented in `server/src/routes/*` and `server/src/controllers/*`. All routes are mounted under `/api`. Every route below except `POST /api/auth/login`, `GET /api/health`, `GET /api/categories`, and `GET /api/related-systems` requires `Authorization: Bearer <jwt>`; the JWT is issued by `/api/auth/login`, not by a Development Requester selector (see `specification.md` Section 11).

## Auth

### POST /api/auth/login
Request: `{ "email": string, "password": string }`
Success `200`: `{ "token": string, "user": { "id", "email", "fullName", "role", "mustChangePassword" } }`
Errors: `400` malformed body; `401` unknown email, inactive user, or wrong password.

## Reference data

### GET /api/categories
Public. Returns active categories only: `[{ "id": number, "name": string }]`. `200` always.

### GET /api/related-systems
Public. Same shape/rules as categories.

## Tickets

### POST /api/tickets
Role: `REQUESTER`. Request: `{ "categoryId": number, "relatedSystemId"?: number, "summary": string (1-200), "description": string (min 1), "requestedPriority"?: "LOW"|"MEDIUM"|"HIGH"|"URGENT" }`
Success `201`: the created ticket row, including the generated `ticketNumber` (format `TKT-YYYY-NNNNNN`), `status: "NEW"`.
Errors: `400` validation failure (missing/invalid fields, or an invalid `categoryId`/`relatedSystemId`); `403` caller is not a Requester.

### GET /api/tickets/mine
Role: `REQUESTER`. Query: `status?` (one of the five status enum values; anything else is silently ignored). Returns the caller's own tickets, newest first, each including `category: {id, name}` and `owner: {id, fullName} | null`. No pagination — the full result set is returned.
Success `200`: `Ticket[]`.

### GET /api/tickets/:id
Roles: any authenticated user; a Requester may only fetch a ticket they own.
Success `200`: full ticket detail including `requester`, `owner`, `category`, `relatedSystem`, `publicComments[]`, `actionsTaken[]`, `attachments[]`. `internalNotes` is present for staff and omitted entirely for a Requester viewer.
Errors: `400` non-numeric id; `404` ticket does not exist, or exists but is not owned by the calling Requester (ownership failure and not-found are indistinguishable by design).

### PATCH /api/tickets/:id/priority
Role: `REQUESTER`, must own the ticket. Request: `{ "requestedPriority": "LOW"|"MEDIUM"|"HIGH"|"URGENT" }`
Success `200`: updated ticket.
Errors: `400` invalid id/body; `404` not found / not owned; `409` ticket is not `NEW` or `IN_PROGRESS`.

### POST /api/tickets/:id/confirm-resolution
Role: `REQUESTER`, must own the ticket. No body.
Success `200`: ticket with `status: "CLOSED"`, `closedAt` set.
Errors: `404` not found/owned; `409` ticket is not `RESOLVED`.

### POST /api/tickets/:id/reject-resolution
Role: `REQUESTER`, must own the ticket. No body.
Success `200`: ticket with `status: "REOPENED"`, `resolvedAt` cleared.
Errors: `404` not found/owned; `409` ticket is not `RESOLVED`.

### POST /api/tickets/:id/request-reopen
Role: `REQUESTER`, must own the ticket. No body.
Success `200`: ticket with `status: "REOPENED"`.
Errors: `404` not found/owned; `409` ticket is not `CLOSED`.

### POST /api/tickets/:id/comments
Roles: any authenticated user with access to the ticket (owning Requester, or IT Staff/Administrator). Request: `{ "body": string (min 1) }`
Success `201`: created comment with `author: {id, fullName, role}`.
Errors: `400` empty body; `404` ticket not found / not accessible.

### POST /api/tickets/:id/attachments
Roles: any authenticated user with access to the ticket. Request: `{ "filename": string (min 1), "url": string (must be a valid URL) }`
Success `201`: created attachment record with `uploader: {id, fullName, role}`.
Errors: `400` missing filename or invalid URL; `404` ticket not found / not accessible.

**Known gap:** this is a metadata-only record — the client sends a URL it already has, not a file. There is no multipart upload endpoint, no server-side MIME-type or size check, no 5-attachments-per-ticket cap, no download endpoint, and no removal (soft or otherwise). The Lab 2 attachment rules (5 MB limit, JPG/JPEG/PNG/WEBP/PDF only, soft removal, blocked download after removal) are **not implemented** by this endpoint. Documented here rather than glossed over.

## Status codes in use

| Status | Meaning in this API |
|---|---|
| 200 | Successful read or state-changing update |
| 201 | Resource created (ticket, comment, attachment record) |
| 400 | Validation failure (Zod schema rejection, bad id) |
| 401 | Missing/invalid JWT, or bad login credentials |
| 403 | Authenticated but wrong role for this action |
| 404 | Resource does not exist, or exists but caller has no ownership/access (these two cases are intentionally not distinguished) |
| 409 | Valid request, but the ticket's current `status` does not allow this transition |
