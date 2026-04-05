# API Contract: Todos

**Branch**: `014-engineer-todo-list` | **Date**: 2026-04-04  
**Base URL**: `http://localhost:<port>/api/todos`  
**Content-Type**: `application/json`

---

## Shared Types

### TodoItem (response shape)

```json
{
  "id": "uuid-v4-string",
  "userId": "default",
  "text": "Look into the session timeout issue",
  "done": false,
  "createdAt": "2026-04-04T22:00:00.000Z",
  "updatedAt": "2026-04-04T22:00:00.000Z"
}
```

### Error response (§XII structured contract)

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description of the problem.",
  "requestId": "uuid-v4-string"
}
```

---

## Endpoints

### GET /api/todos

List all todo items for the current user, ordered by `created_at` ascending (oldest first).

**Request**: No body, no query params.

**Response `200 OK`**:
```json
[
  {
    "id": "3f2e1d0c-...",
    "userId": "default",
    "text": "Fix the session timeout bug",
    "done": false,
    "createdAt": "2026-04-04T10:00:00.000Z",
    "updatedAt": "2026-04-04T10:00:00.000Z"
  }
]
```

Returns `[]` when no items exist.

---

### POST /api/todos

Create a new todo item.

**Request body**:
```json
{ "text": "Look into the memory leak" }
```

**Validation**:
- `text`: required, string, 1–500 characters. Rejects empty strings or whitespace-only.

**Response `201 Created`**:
```json
{
  "id": "new-uuid",
  "userId": "default",
  "text": "Look into the memory leak",
  "done": false,
  "createdAt": "2026-04-04T22:05:00.000Z",
  "updatedAt": "2026-04-04T22:05:00.000Z"
}
```

**Error `400 Bad Request`** (empty/missing text):
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Todo text is required and must not be empty.",
  "requestId": "req-uuid"
}
```

---

### PATCH /api/todos/:id

Toggle the completion state of a todo item.

**Request body**:
```json
{ "done": true }
```

**Validation**:
- `done`: required, boolean.
- `:id` must match an existing todo.

**Response `200 OK`**:
```json
{
  "id": "3f2e1d0c-...",
  "userId": "default",
  "text": "Fix the session timeout bug",
  "done": true,
  "createdAt": "2026-04-04T10:00:00.000Z",
  "updatedAt": "2026-04-04T22:10:00.000Z"
}
```

**Error `404 Not Found`**:
```json
{
  "error": "NOT_FOUND",
  "message": "Todo item not found.",
  "requestId": "req-uuid"
}
```

**Error `400 Bad Request`** (invalid payload):
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Field 'done' is required and must be a boolean.",
  "requestId": "req-uuid"
}
```

---

### DELETE /api/todos/:id

Delete a todo item permanently.

**Response `204 No Content`**: Empty body.

**Error `404 Not Found`**:
```json
{
  "error": "NOT_FOUND",
  "message": "Todo item not found.",
  "requestId": "req-uuid"
}
```

---

## Contract Test Requirements

| Test Case | Endpoint | Scenario |
|-----------|----------|----------|
| TC-001 | GET /api/todos | Returns empty array when no todos exist |
| TC-002 | GET /api/todos | Returns all todos in `created_at` ASC order |
| TC-003 | POST /api/todos | Creates item and returns 201 with full TodoItem |
| TC-004 | POST /api/todos | Returns 400 for empty `text` |
| TC-005 | POST /api/todos | Returns 400 for whitespace-only `text` |
| TC-006 | POST /api/todos | Returns 400 when `text` exceeds 500 chars |
| TC-007 | PATCH /api/todos/:id | Marks item done, updates `updatedAt` |
| TC-008 | PATCH /api/todos/:id | Marks item not-done (toggle back) |
| TC-009 | PATCH /api/todos/:id | Returns 404 for unknown id |
| TC-010 | PATCH /api/todos/:id | Returns 400 for missing `done` field |
| TC-011 | DELETE /api/todos/:id | Deletes item, returns 204 |
| TC-012 | DELETE /api/todos/:id | Returns 404 for unknown id |
