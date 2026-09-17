# Realtime

## 1. Purpose

The realtime system synchronizes competition state between the backend and connected clients.

Clients include:

* Public website
* Creator overlays
* Global broadcast overlays
* Classification overlays
* Statistics displays
* Admin panel

The backend is always the source of truth.

---

# 2. Recommended Technology

Use:

```text
WebSocket / Socket.IO
```

The implementation should remain simple.

There is no need for a complex event infrastructure.

---

# 3. Event Flow

```text
Admin Action
     ↓
Backend
     ↓
Database
     ↓
Scoring
     ↓
Ranking
     ↓
Realtime Event
     ↓
Connected Clients
```

Example:

```text
Admin confirms P2M1
        ↓
Backend saves results
        ↓
Points calculated
        ↓
Team totals recalculated
        ↓
Ranking recalculated
        ↓
map.completed
ranking.updated
map.started
        ↓
Clients update
```

---

# 4. Event Types

Recommended events:

```text
competition.updated
match.started
match.completed
map.started
map.completed
result.updated
ranking.updated
```

Additional events may be introduced if required.

---

# 5. competition.updated

Sent when general tournament state changes.

Possible triggers:

* Tournament starts
* Tournament completes
* Current match changes
* Current map changes

Payload should contain the relevant current competition state.

---

# 6. match.started

Triggered when the administrator starts a match.

Payload should contain:

```text
matchId
matchNumber
status
participants
currentMap
```

Clients can use this to update:

* Public status
* Overlays
* Admin UI

---

# 7. map.started

Triggered when a map becomes active.

Payload should contain:

```text
mapId
matchId
mapCode
mapIndex
status
participants
```

Example:

```text
P3M2 → ACTIVE
```

---

# 8. map.completed

Triggered after a valid map result is confirmed.

Payload should contain:

```text
mapId
mapCode
results
updated participant totals
updated team totals
```

This event should allow clients to immediately display the completed map state.

---

# 9. result.updated

Used when a previously stored result is corrected.

Payload should contain:

```text
mapId
participantId
oldResult
newResult
```

Clients should not need to know how scoring works.

They simply receive the updated authoritative state.

---

# 10. ranking.updated

Triggered whenever team classification changes.

Payload should contain the current ranking:

```json
[
  {
    "rank": 1,
    "teamId": "team-1",
    "points": 100
  }
]
```

The public website can update its classification immediately.

---

# 11. match.completed

Triggered after the final map of a match is confirmed.

Payload:

```text
matchId
matchNumber
finalMap
currentRanking
```

The next match remains `UPCOMING` until an administrator starts it.

---

# 12. Event Ordering

For a confirmed map:

```text
result.updated
      ↓
map.completed
      ↓
ranking.updated
      ↓
map.started
```

If it was the final map:

```text
result.updated
      ↓
map.completed
      ↓
ranking.updated
      ↓
match.completed
```

The exact event order may be adjusted during implementation, but clients must always receive a consistent final state.

---

# 13. Reconnection

Clients must handle temporary disconnections.

When reconnecting:

1. Connect to realtime.
2. Request current authoritative state.
3. Replace local state.
4. Resume listening for events.

Clients must never assume that they received every event.

The API remains the recovery mechanism.

---

# 14. Client State

Frontend clients should maintain only the state necessary for their purpose.

Examples:

### Public Web

```text
Tournament
Current Match
Current Map
Ranking
```

### Creator Overlay

```text
Creator
Companion
Team
Points
Team Rank
```

### Admin

```text
Full operational state
```

The client should not recreate the entire backend domain model unnecessarily.

---

# 15. No Independent Scoring

Realtime clients must never calculate:

```text
Position → Points
```

They receive authoritative points from the backend.

This prevents inconsistencies between:

* Admin
* Public website
* Broadcast
* Statistics

---

# 16. Correction Handling

If an administrator corrects a result:

```text
Correction
   ↓
Backend recalculation
   ↓
ranking.updated
   ↓
Clients refresh
```

All connected clients must reflect the corrected state.

---

# 17. Broadcast Reliability

Broadcast overlays should be designed to tolerate:

* Temporary connection loss
* Delayed events
* Browser-source reloads
* OBS scene changes

When an overlay loads, it must request current state before waiting for realtime events.

This prevents an overlay from appearing empty simply because it loaded after an event occurred.

---

# 18. Realtime Philosophy

Realtime is a delivery mechanism, not a source of truth.

```text
Database
   ↓
Backend state
   ↓
Realtime
   ↓
Clients
```

If realtime fails temporarily, the competition itself must continue working.

The administrator must never depend on a broadcast client being connected for competition progression.
