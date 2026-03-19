# Meeting Platform — API Reference

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URLs & Configuration](#base-urls--configuration)
4. [CORS](#cors)
5. [REST API](#rest-api)
   - [Users](#users)
   - [Meetings](#meetings)
   - [Media (LiveKit)](#media-livekit)
6. [WebSocket / STOMP](#websocket--stomp)
   - [Connection](#connection)
   - [Message Handler](#message-handler)
   - [Subscriptions](#subscriptions)
   - [Disconnect Behavior](#disconnect-behavior)
7. [Data Models](#data-models)
   - [Request DTOs](#request-dtos)
   - [Response DTOs](#response-dtos)
   - [Enums](#enums)
8. [Error Handling](#error-handling)

---

## Overview

Meeting Platform is a Spring Boot application that provides REST APIs for user/meeting management and a STOMP-over-WebSocket layer for real-time signaling (WebRTC P2P + LiveKit SFU fallback).

- **Server port:** `8081`
- **Base REST path:** `/api/**`
- **WebSocket endpoint:** `/ws/meeting`
- **Identity provider:** Keycloak (`http://localhost:8080/realms/meeting-realm`)

---

## Authentication

All protected REST endpoints require a valid Keycloak JWT passed as a Bearer token.

```
Authorization: Bearer <access_token>
```

The JWT `sub` claim is used as the `userId` throughout the system. On every authenticated request, the system auto-provisions the user in the local database (sync from Keycloak) if they do not yet exist.

> **Public endpoints** (no token required): `/ws/meeting/**`, `/api/v1/media/**`, `/api/meetings/**`, `/api/public/**`, `/api/auth/**`, `/swagger-ui/**`, `/v3/api-docs/**`
>
> All other endpoints require a valid JWT.

---

## Base URLs & Configuration

| Resource | Value |
|---|---|
| REST base URL | `http://localhost:8081` |
| WebSocket endpoint | `ws://localhost:8081/ws/meeting` |
| Keycloak issuer | `http://localhost:8080/realms/meeting-realm` |
| Swagger UI | `http://localhost:8081/swagger-ui.html` |
| OpenAPI spec | `http://localhost:8081/v3/api-docs` |

---

## CORS

| Setting | Value |
|---|---|
| Allowed origins | `http://localhost:3000`, `http://localhost:4200`, `http://127.0.0.1:5500` |
| Allowed methods | `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS` |
| Allowed headers | `*` |
| Allow credentials | `true` |

---

## REST API

### Users

#### GET `/api/users/me` — Get current user profile

Returns the profile of the authenticated user.

**Headers**
```
Authorization: Bearer <access_token>
```

**Response `200 OK`**
```json
{
  "id": "a1b2c3d4-...",
  "email": "user@example.com",
  "fullName": "Nguyen Van A",
  "avatarUrl": "https://example.com/avatar.png"
}
```

---

#### PUT `/api/users/me` — Update current user profile

Updates the `fullName` and/or `avatarUrl` of the authenticated user.

**Headers**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request body**
```json
{
  "fullName": "Nguyen Van B",
  "avatarUrl": "https://example.com/new-avatar.png"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `fullName` | string | Yes | Not blank, max 255 characters |
| `avatarUrl` | string | No | — |

**Response `200 OK`** — same shape as `GET /api/users/me`
```json
{
  "id": "a1b2c3d4-...",
  "email": "user@example.com",
  "fullName": "Nguyen Van B",
  "avatarUrl": "https://example.com/new-avatar.png"
}
```

**Response `400 Bad Request`** — when `fullName` is blank or exceeds 255 characters (Spring validation error).

---

### Meetings

#### POST `/api/meetings/create` — Create a meeting

Creates a new meeting. The authenticated user becomes the host. Returns `201 Created` with the meeting details.

**Headers**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request body**
```json
{
  "title": "Sprint Planning Q2",
  "description": "Discuss and plan backlog for Q2",
  "startTime": "2026-04-01T09:00:00",
  "isWaitingRoomEnabled": true
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | Yes | Display name of the meeting |
| `description` | string | No | Optional description |
| `startTime` | ISO-8601 datetime | No | Scheduled start time |
| `isWaitingRoomEnabled` | boolean | No | Defaults to `false` |

**Response `201 Created`**
```json
{
  "id": "e5f6a7b8-...",
  "meetingCode": "abc-xyz-123",
  "title": "Sprint Planning Q2",
  "description": "Discuss and plan backlog for Q2",
  "hostId": "a1b2c3d4-...",
  "status": "SCHEDULED",
  "startTime": "2026-04-01T09:00:00",
  "isWaitingRoomEnabled": true,
  "createdAt": "2026-03-17T08:30:00"
}
```

---

#### PUT `/api/meetings/{meetingCode}/end` — End a meeting

Ends an ongoing meeting. Only the host should call this.

**Headers**
```
Authorization: Bearer <access_token>
```

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `meetingCode` | string | The unique meeting code (e.g., `abc-xyz-123`) |

**Response `200 OK`**
```json
{
  "id": "e5f6a7b8-...",
  "meetingCode": "abc-xyz-123",
  "title": "Sprint Planning Q2",
  "description": "Discuss and plan backlog for Q2",
  "hostId": "a1b2c3d4-...",
  "status": "ENDED",
  "startTime": "2026-04-01T09:00:00",
  "isWaitingRoomEnabled": true,
  "createdAt": "2026-03-17T08:30:00"
}
```

---

### Media (LiveKit)

#### GET `/api/v1/media/join/{meetingCode}` — Get media connection info

Returns connection details for WebRTC. The server determines the connection mode (P2P or SFU) based on the current number of participants in the room:

- **P2P** — few participants; no LiveKit token issued.
- **SFU** — threshold exceeded; a LiveKit JWT token and server URL are returned.

**Headers**
```
Authorization: Bearer <access_token>
```

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `meetingCode` | string | The unique meeting code |

**Response `200 OK` — P2P mode**
```json
{
  "mode": "P2P",
  "token": null,
  "serverUrl": null,
  "iceServers": {
    "stunUrl": "stun:stun.l.google.com:19302",
    "turnUrl": "turn:your-turn-server.com:3478",
    "username": "turnuser",
    "credential": "turnpassword"
  }
}
```

**Response `200 OK` — SFU mode**
```json
{
  "mode": "SFU",
  "token": "<livekit-jwt>",
  "serverUrl": "ws://localhost:7880",
  "iceServers": {
    "stunUrl": "stun:stun.l.google.com:19302",
    "turnUrl": "turn:your-turn-server.com:3478",
    "username": "turnuser",
    "credential": "turnpassword"
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `mode` | `"P2P"` \| `"SFU"` | Connection strategy decided by server |
| `token` | string \| null | LiveKit JWT. Present only in SFU mode |
| `serverUrl` | string \| null | LiveKit server URL. Present only in SFU mode |
| `iceServers.stunUrl` | string | STUN server URL |
| `iceServers.turnUrl` | string | TURN server URL |
| `iceServers.username` | string | TURN credential username |
| `iceServers.credential` | string | TURN credential password |

---

## WebSocket / STOMP

### Connection

Connect using STOMP over WebSocket (SockJS supported).

```
ws://localhost:8081/ws/meeting
```

**SockJS fallback:**
```
http://localhost:8081/ws/meeting
```

> **Note:** WebSocket authentication at the STOMP CONNECT level is currently disabled. The server does not validate the JWT during the initial STOMP handshake, but REST calls to `/api/v1/media/join/{meetingCode}` (which sets up LiveKit) do require a token.

---

### Message Handler

**Client sends to:** `/app/meeting.signal`

All WebSocket messages share a single destination. The server dispatches outbound messages based on the `category` field.

**Payload — `SignalingMessage`**
```json
{
  "category": "PRESENCE",
  "type": "JOIN",
  "senderId": "a1b2c3d4-...",
  "targetId": null,
  "meetingCode": "abc-xyz-123",
  "payload": {},
  "timestamp": "2026-03-17T09:00:00"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `category` | `MessageCategory` | Yes | `PRESENCE`, `SIGNALING`, or `ACTION` |
| `type` | string | Yes | See enum tables below |
| `senderId` | string | Yes | User ID of the sender (Keycloak `sub`) |
| `targetId` | string | No | Target user ID — required only for `SIGNALING` (P2P direct messages) |
| `meetingCode` | string | Yes | Identifies the room |
| `payload` | object | No | Flexible content (SDP, ICE candidates, chat text, poll data, etc.) |
| `timestamp` | ISO-8601 datetime | No | Message timestamp |

---

### Subscriptions

#### Room broadcast — `/topic/meeting.{meetingCode}`

Subscribe to this topic to receive all presence events and action broadcasts for a room.

```
/topic/meeting.abc-xyz-123
```

Messages delivered here:
- `PRESENCE` events: `JOIN`, `RECONNECTING`, `LEAVE`, `USER_LIST_SYNC`
- `ACTION` events: `CHAT`, `MEETING_ENDED`, `START_POLL`, `WHITEBOARD_DRAW`

#### Direct signaling — `/user/queue/signaling`

Subscribe to receive P2P WebRTC signaling messages addressed specifically to the current user.

```
/user/queue/signaling
```

Messages delivered here:
- `SIGNALING` events: `OFFER`, `ANSWER`, `ICE_CANDIDATE`, `SWITCH_TO_SFU`

---

### Signaling Flows

#### Join a room
1. Client connects to `/ws/meeting`.
2. Client subscribes to `/topic/meeting.{meetingCode}` and `/user/queue/signaling`.
3. Client sends to `/app/meeting.signal`:
```json
{
  "category": "PRESENCE",
  "type": "JOIN",
  "senderId": "a1b2c3d4-...",
  "meetingCode": "abc-xyz-123",
  "payload": {},
  "timestamp": "2026-03-17T09:00:00"
}
```
4. Server adds the user to the Redis presence set (`room:{meetingCode}:users`), stores `meetingCode` and `userId` in the STOMP session, then broadcasts a `USER_LIST_SYNC` message (and optionally a `SWITCH_TO_SFU` signal if the SFU threshold is met) to `/topic/meeting.{meetingCode}`.

#### P2P WebRTC offer/answer
```json
// Caller sends OFFER to target
{
  "category": "SIGNALING",
  "type": "OFFER",
  "senderId": "a1b2c3d4-...",
  "targetId": "e5f6a7b8-...",
  "meetingCode": "abc-xyz-123",
  "payload": { "sdp": "v=0\r\no=..." },
  "timestamp": "2026-03-17T09:01:00"
}
```
Server forwards the message directly to `/user/{targetId}/queue/signaling`.

```json
// Target answers
{
  "category": "SIGNALING",
  "type": "ANSWER",
  "senderId": "e5f6a7b8-...",
  "targetId": "a1b2c3d4-...",
  "meetingCode": "abc-xyz-123",
  "payload": { "sdp": "v=0\r\no=..." },
  "timestamp": "2026-03-17T09:01:02"
}
```

#### ICE candidate exchange
```json
{
  "category": "SIGNALING",
  "type": "ICE_CANDIDATE",
  "senderId": "a1b2c3d4-...",
  "targetId": "e5f6a7b8-...",
  "meetingCode": "abc-xyz-123",
  "payload": { "candidate": "candidate:...", "sdpMid": "0", "sdpMLineIndex": 0 },
  "timestamp": "2026-03-17T09:01:03"
}
```

#### Upgrade to SFU
When the room hits the SFU threshold the server broadcasts to all members:
```json
{
  "category": "SIGNALING",
  "type": "SWITCH_TO_SFU",
  "senderId": "SERVER",
  "meetingCode": "abc-xyz-123",
  "payload": {},
  "timestamp": "2026-03-17T09:05:00"
}
```
Clients should then call `GET /api/v1/media/join/{meetingCode}` to obtain a LiveKit token and reconnect via SFU.

#### Room action broadcast
```json
// Chat message
{
  "category": "ACTION",
  "type": "CHAT",
  "senderId": "a1b2c3d4-...",
  "meetingCode": "abc-xyz-123",
  "payload": { "text": "Hello everyone!" },
  "timestamp": "2026-03-17T09:10:00"
}
```
Server relays to `/topic/meeting.{meetingCode}`.

---

### Disconnect Behavior

When a client's WebSocket connection drops:

1. `SessionDisconnectEvent` is fired by Spring.
2. Server reads `meetingCode` and `userId` from the STOMP session attributes.
3. User is moved to a **reconnecting** state in Redis (`pending:room:{meetingCode}:{userId}`, TTL 60 s).
4. Server broadcasts to `/topic/meeting.{meetingCode}`:
```json
{
  "category": "PRESENCE",
  "type": "RECONNECTING",
  "senderId": "a1b2c3d4-...",
  "meetingCode": "abc-xyz-123",
  "payload": {},
  "timestamp": "2026-03-17T09:15:00"
}
```
5. If the user re-joins (sends `PRESENCE/JOIN`) within 60 s, the pending key is removed. Otherwise the user is considered as having left.

---

## Data Models

### Request DTOs

#### `MeetingCreateRequest`

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | Yes | — |
| `description` | string | No | — |
| `startTime` | ISO-8601 datetime | No | — |
| `isWaitingRoomEnabled` | boolean | No | Defaults to `false` |

#### `UserUpdateRequest`

| Field | Type | Required | Constraints |
|---|---|---|---|
| `fullName` | string | Yes | `@NotBlank`, max 255 characters |
| `avatarUrl` | string | No | — |

#### `SignalingMessage`

| Field | Type | Required | Notes |
|---|---|---|---|
| `category` | `MessageCategory` | Yes | `PRESENCE \| SIGNALING \| ACTION` |
| `type` | string | Yes | Matches a `PresenceType`, `SignalingType`, or `ActionType` value |
| `senderId` | string | Yes | Keycloak user sub |
| `targetId` | string | No | Required for `SIGNALING` category |
| `meetingCode` | string | Yes | Format: `xxx-xxx-xxx` |
| `payload` | object | No | Arbitrary JSON |
| `timestamp` | ISO-8601 datetime | No | — |

---

### Response DTOs

#### `MeetingResponse`

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Internal database ID |
| `meetingCode` | string | Public room code (`xxx-xxx-xxx`) — used across REST and WebSocket |
| `title` | string | — |
| `description` | string | — |
| `hostId` | string | Keycloak `sub` of the creator |
| `status` | `MeetingStatus` | `SCHEDULED \| ONGOING \| ENDED` |
| `startTime` | ISO-8601 datetime | — |
| `isWaitingRoomEnabled` | boolean | — |
| `createdAt` | ISO-8601 datetime | — |

#### `UserProfileResponse`

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Internal database ID |
| `email` | string | From Keycloak |
| `fullName` | string | Display name |
| `avatarUrl` | string | Profile picture URL |

#### `MediaJoinResponse`

| Field | Type | Notes |
|---|---|---|
| `mode` | string | `"P2P"` or `"SFU"` |
| `token` | string \| null | LiveKit JWT — present only in SFU mode |
| `serverUrl` | string \| null | LiveKit WebSocket URL — present only in SFU mode |
| `iceServers.stunUrl` | string | e.g., `stun:stun.l.google.com:19302` |
| `iceServers.turnUrl` | string | e.g., `turn:your-turn-server.com:3478` |
| `iceServers.username` | string | TURN credential |
| `iceServers.credential` | string | TURN credential |

---

### Enums

#### `MessageCategory`
| Value | Description |
|---|---|
| `PRESENCE` | User joining, leaving, or roster sync events |
| `SIGNALING` | WebRTC signaling messages (SDP offers, answers, ICE candidates) |
| `ACTION` | Room-level actions visible to all participants |

#### `PresenceType` (used when `category = PRESENCE`)
| Value | Description |
|---|---|
| `JOIN` | User joined the room |
| `RECONNECTING` | User disconnected but may return (60 s grace period) |
| `LEAVE` | User left the room |
| `USER_LIST_SYNC` | Server broadcasts updated participant list to all members |

#### `SignalingType` (used when `category = SIGNALING`)
| Value | Description |
|---|---|
| `OFFER` | WebRTC SDP offer (P2P) |
| `ANSWER` | WebRTC SDP answer (P2P) |
| `ICE_CANDIDATE` | ICE candidate (P2P) |
| `SWITCH_TO_SFU` | Server notifies all clients to upgrade to LiveKit SFU |

#### `ActionType` (used when `category = ACTION`)
| Value | Description |
|---|---|
| `CHAT` | Chat message broadcast to the room |
| `MEETING_ENDED` | Host ended the meeting |
| `START_POLL` | Host started a poll |
| `WHITEBOARD_DRAW` | Whiteboard drawing event |

#### `MeetingStatus`
| Value | Description |
|---|---|
| `SCHEDULED` | Meeting created but not yet started |
| `ONGOING` | Meeting is active |
| `ENDED` | Meeting has been ended by the host |

---

## Error Handling

The API returns standard Spring Boot error responses.

**Validation error (400)**
```json
{
  "timestamp": "2026-03-17T09:00:00.000+00:00",
  "status": 400,
  "error": "Bad Request",
  "path": "/api/users/me"
}
```

**Unauthorized (401)** — Missing or invalid JWT
```json
{
  "timestamp": "2026-03-17T09:00:00.000+00:00",
  "status": 401,
  "error": "Unauthorized",
  "path": "/api/users/me"
}
```

**Common HTTP status codes**

| Code | Meaning |
|---|---|
| `200 OK` | Successful read or update |
| `201 Created` | Resource created (meeting) |
| `400 Bad Request` | Validation failure |
| `401 Unauthorized` | Missing or expired JWT |
| `403 Forbidden` | Authenticated but insufficient permissions |
| `404 Not Found` | Resource not found |
| `500 Internal Server Error` | Unexpected server error |
