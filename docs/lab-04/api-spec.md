# Lab 4 API Contract

Base path `/api`. All endpoints below require `Authorization: Bearer <JWT>` and pass
`requireAuth` → `enforcePasswordChange` (Lab 3). Auth mechanism, password rules and Lab 2/3
endpoints are unchanged — see `docs/lab-03/api-spec.md`; they remain part of this contract.

## Conventions

- **Error body:** `{ "error": string, "code"?: string, ... }`. `error` is a safe, human-readable
  message (never a stack trace, SQL, or another user's data). `code` values:
  `VALIDATION_ERROR`, `STALE_UPDATE`, `RESOLUTION_GATE`, `INVALID_TRANSITION`, `TICKET_LOCKED`.
- **Status codes:** `200` OK, `201` created, `400` validation, `401` no/invalid token, `403` wrong
  role or `PASSWORD_CHANGE_REQUIRED`, `404` not found *or* not yours (existence never leaked to a
  Requester), `409` business-rule/stale conflict, `500` unexpected (generic message only).
- **Dates:** ISO-8601 UTC strings in and out. The UI formats them in the browser's locale.
- **Concurrency:** resources carry an integer `version`. A write that sends `version` is applied
  only if it equals the stored value (`UPDATE … WHERE id=? AND version=?`), then `version + 1`.
  Mismatch → `409 { error, code: "STALE_UPDATE", current }` where `current` is the latest resource.

## Shared shapes

```ts
type Participant = { id: number; fullName: string; role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR' }
type ActionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

type ActionTaken = {
  id: number
  ticketId: number
  actionAt: string            // Action Date/Time
  description: string
  result: string | null
  status: ActionStatus
  followUpRequired: boolean
  followUpNote: string | null
  attachmentNotes: string | null
  performedBy: Participant    // automatic, from the token (column authorId)
  assignee: Participant | null
  version: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  cancelledAt: string | null
}

type StatusChange = {
  id: number
  fromStatus: TicketStatus | null
  toStatus: TicketStatus
  changedBy: Participant
  createdAt: string
}
```

## Actions Taken

### `GET /api/tickets/:id/actions`

| | |
|---|---|
| Roles | Requester (own Ticket only), IT Staff, Administrator |
| 200 | `ActionTaken[]` ordered `actionAt` asc, `id` asc |
| 400 | non-integer id |
| 404 | Ticket missing, or Requester is not its requester |

### `POST /api/tickets/:id/actions`

Roles: IT Staff, Administrator (Requester → `403`).

```json
{
  "actionAt": "2026-10-06T03:15:00.000Z",
  "description": "Replaced the laptop battery",
  "result": "Battery now holds 6h charge",
  "status": "COMPLETED",
  "assigneeId": 3,
  "followUpRequired": true,
  "followUpNote": "Check battery health again in 2 weeks",
  "attachmentNotes": "See battery-report.pdf in Attachments",
  "clientRequestId": "7b0c8f8e-…"
}
```

| Field | Rule |
|---|---|
| `description` | required, trimmed 1–2000 |
| `actionAt` | optional ISO datetime (default now); ≥ the minute of Ticket `createdAt`; ≤ now + 5 min unless `status = PLANNED` |
| `status` | optional, `PLANNED` (default) \| `IN_PROGRESS` \| `COMPLETED` |
| `result` | ≤ 2000; required non-blank when `status = COMPLETED` |
| `assigneeId` | optional int (default = caller); must be active `IT_STAFF`/`ADMINISTRATOR` |
| `followUpRequired` | optional boolean (default false) |
| `followUpNote` | ≤ 2000; required non-blank when `followUpRequired`; stored `null` otherwise |
| `attachmentNotes` | optional ≤ 500 |
| `clientRequestId` | optional string 8–100; idempotency key per Ticket |

Responses: `201 ActionTaken`; `200 ActionTaken` when `clientRequestId` was already used on this
Ticket (no new row); `400 VALIDATION_ERROR` with `fields: { [name]: message }`; `404` Ticket
missing; `409 TICKET_LOCKED` when the Ticket is Resolved, Closed or Cancelled.

### `PATCH /api/tickets/:id/actions/:actionId`

Roles: IT Staff, Administrator. Body = any subset of the POST fields (except `clientRequestId`)
plus **required** `version`. `status` may be any value permitted by:

| From | Allowed `status` |
|---|---|
| PLANNED | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED |
| IN_PROGRESS | IN_PROGRESS, COMPLETED, CANCELLED |
| COMPLETED, CANCELLED | — (read-only) |

Validation is applied to the **merged** result (stored values + patch), so e.g. setting
`followUpRequired: true` without a note on an action that has none fails.

Responses: `200 ActionTaken`; `400 VALIDATION_ERROR`; `404` Ticket or action missing (or action
belongs to another Ticket); `409 STALE_UPDATE` (`current` = latest action); `409
INVALID_TRANSITION` (terminal or illegal status move); `409 TICKET_LOCKED`. `performedBy` can
never be changed (a `performedById`/`authorId` field in the body is ignored).

There is **no DELETE**. Mistakes are Cancelled.

## Ticket workflow (changed)

All accept an optional `version` (number) in the body; the Lab 4 UI always sends it.

| Method | Path | Body | Roles | Success | Errors |
|---|---|---|---|---|---|
| PATCH | `/api/tickets/:id/status` | `{ status, version? }` | IT Staff, Admin | 200 Ticket | 400, 404, 409 `INVALID_TRANSITION` / `STALE_UPDATE` |
| POST | `/api/tickets/:id/resolve` | `{ resolutionSummary, version? }` | IT Staff, Admin | 200 Ticket | 400, 404, 409 `INVALID_TRANSITION` / **`RESOLUTION_GATE`** / `STALE_UPDATE` |
| POST | `/api/tickets/:id/close` | `{ version? }` | IT Staff, Admin | 200 | 404, 409 |
| POST | `/api/tickets/:id/cancel` | `{ version? }` | IT Staff, Admin | 200 (open actions → CANCELLED) | 404, 409 |
| PATCH | `/api/tickets/:id/owner` | `{ ownerId, version? }` | IT Staff, Admin | 200 | 400, 404, 409 `STALE_UPDATE` |
| PATCH | `/api/tickets/:id/it-priority` | `{ itPriority, version? }` | IT Staff, Admin | 200 | 400, 404, 409 `STALE_UPDATE` |
| POST | `/api/tickets/:id/confirm-resolution` | `{ version? }` | Requester (own) | 200 | 404, 409 |
| POST | `/api/tickets/:id/reject-resolution` | `{ version? }` | Requester (own) | 200 | 404, 409 |
| POST | `/api/tickets/:id/request-reopen` | `{ version? }` | Requester (own) | 200 | 404, 409 |

`RESOLUTION_GATE` body:
`{ "error": "Complete or cancel all open Actions Taken and record at least one Completed action before resolving", "code": "RESOLUTION_GATE", "openActions": 1, "completedActions": 0 }`.

Every status change writes one `TicketStatusChange` row in the same transaction. Transitions are
applied with `updateMany({ where: { id, status: from, version? } })`; `count = 0` → `409`, so two
concurrent identical transitions yield exactly one `200`.

### `GET /api/tickets/:id` (changed)

Adds `version: number`, `actionsTaken: ActionTaken[]` (full shape, ordered as above) and
`statusHistory: StatusChange[]` (oldest first). Requester viewers still never receive
`internalNotes`.

### List endpoints (changed — drill-down support)

- `GET /api/tickets/mine` (Requester): adds `statusGroup=open` (ignored when `status` is given).
- `GET /api/tickets` (IT Staff/Admin): adds `statusGroup=open` and
  `itPriority=LOW|MEDIUM|HIGH|URGENT|unset`.
- Unknown values are ignored (never `500`), response shape unchanged:
  `{ tickets, pagination: { page, pageSize, totalCount, totalPages } }`.

## Dashboards (new)

Time zone: **Asia/Bangkok** (UTC+7). `todayStart` = most recent 00:00 Bangkok, computed on the
server. Lists contain `TicketCard` only — never full Ticket collections.

```ts
type TicketCard = { id: number; ticketNumber: string; summary: string; status: TicketStatus;
                    itPriority: Priority | null; updatedAt: string; resolvedAt: string | null }
type Metric = { key: string; label: string; value: number; todayDelta: number | null; drillDown: string }
```

### `GET /api/dashboard/requester`

Roles: Requester only (IT Staff/Admin → `403`).

```json
{
  "generatedAt": "2026-10-06T05:00:00.000Z",
  "timeZone": "Asia/Bangkok",
  "metrics": [
    { "key": "open", "label": "My Open Tickets", "value": 3, "todayDelta": null, "drillDown": "/tickets?statusGroup=open" },
    { "key": "inProgress", "label": "In Progress", "value": 1, "todayDelta": null, "drillDown": "/tickets?status=IN_PROGRESS" },
    { "key": "waitingForMe", "label": "Waiting for Me", "value": 1, "todayDelta": null, "drillDown": "/tickets?status=WAITING_FOR_REQUESTER" },
    { "key": "resolved", "label": "Resolved", "value": 0, "todayDelta": null, "drillDown": "/tickets?status=RESOLVED" },
    { "key": "closed", "label": "Closed", "value": 1, "todayDelta": null, "drillDown": "/tickets?status=CLOSED" }
  ],
  "attentionRequired": [TicketCard],
  "recentTickets": [TicketCard],
  "recentlyResolved": [TicketCard]
}
```

### `GET /api/dashboard/staff`

Roles: IT Staff, Administrator (Requester → `403`).

```json
{
  "generatedAt": "…", "timeZone": "Asia/Bangkok",
  "metrics": [
    { "key": "new", "label": "New", "value": 4, "todayDelta": 1, "drillDown": "/queue?status=NEW" },
    { "key": "open", "label": "Open", "value": 1, "todayDelta": 0, "drillDown": "/queue?status=OPEN" },
    { "key": "inProgress", "label": "In Progress", "value": 2, "todayDelta": 0, "drillDown": "/queue?status=IN_PROGRESS" },
    { "key": "waitingForRequester", "label": "Waiting for Requester", "value": 1, "todayDelta": 0, "drillDown": "/queue?status=WAITING_FOR_REQUESTER" },
    { "key": "myAssigned", "label": "My Assigned", "value": 2, "todayDelta": null, "drillDown": "/queue?ownerId=me&statusGroup=open" },
    { "key": "unassigned", "label": "Unassigned", "value": 2, "todayDelta": null, "drillDown": "/queue?ownerId=unassigned&statusGroup=open" }
  ],
  "byItPriority": [ { "priority": "URGENT", "value": 0, "drillDown": "/queue?statusGroup=open&itPriority=URGENT" }, "… HIGH, MEDIUM, LOW, unset" ],
  "recentTickets": [TicketCard],
  "myOpenActions": { "total": 2, "items": [ { "id": 7, "ticketId": 1, "ticketNumber": "TKT-SAMPLE-000001", "description": "…", "status": "PLANNED", "actionAt": "…" } ] },
  "userCounts": { "activeRequesters": 4, "activeItStaff": 3, "activeAdministrators": 1, "inactive": 2 }
}
```

`userCounts` is `null` for IT Staff. Empty data → every `value` is `0`, every list `[]`, still `200`.

Errors for both: `401` no/invalid token, `403` wrong role or password change required, `500`
generic `{ error: "Unable to load dashboard" }` (the UI shows a safe-failure card with Retry).

## Health

`GET /api/health` → `200 { status: "ok", service: "TokTickIT API" }` (unchanged; used by E2E
`webServer` readiness).
