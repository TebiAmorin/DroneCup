# Architecture

## 1. Purpose

This document defines the technical architecture of the drone racing competition platform.

The system must be designed around one principle:

> Competition data is the source of truth. Everything else consumes or derives from that data.

The platform will contain:

* Competition Core
* Scoring Engine
* Ranking Engine
* Admin Panel
* Public Web
* Realtime Layer
* Broadcast / Overlay System
* Statistics
* Data Export

The architecture must remain simple, maintainable and scalable without introducing unnecessary infrastructure.

---

# 2. High-Level Architecture

```text
                    ┌──────────────────────┐
                    │    ADMIN PANEL       │
                    │                      │
                    │ Teams / Players      │
                    │ Matches / Maps       │
                    │ Results              │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  COMPETITION CORE    │
                    │                      │
                    │ Tournament           │
                    │ Teams                │
                    │ Participants         │
                    │ Matches              │
                    │ Maps                 │
                    │ Results              │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    SCORING ENGINE    │
                    │                      │
                    │ Position → Points    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    RANKING ENGINE    │
                    │                      │
                    │ Player totals        │
                    │ Team totals          │
                    │ Ranking history      │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
          ┌───────────┐ ┌────────────┐ ┌─────────────┐
          │ PUBLIC WEB│ │ BROADCAST  │ │ STATISTICS  │
          └───────────┘ └─────┬──────┘ └─────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │  REALTIME   │
                       └─────────────┘
```

---

# 3. Core Principle

The map result is the canonical source of scoring information.

```text
Map Result
    ↓
Position
    ↓
Points
    ↓
Player Score
    ↓
Team Score
    ↓
Ranking
    ↓
History / Statistics / Broadcast
```

No frontend, overlay or public page may implement its own scoring calculations.

All scoring must be performed by the backend/domain logic.

---

# 4. Main Modules

## 4.1 Competition Core

Responsible for:

* Tournament configuration
* Teams
* Participants
* Matches
* Maps
* Match progression
* Map progression
* Eligibility
* Results

This module must not depend on the broadcast layer.

The competition must work correctly even if no public website or overlay is connected.

---

## 4.2 Scoring Engine

Responsible for converting map positions into points.

Input:

```text
Participant
Position
```

Output:

```text
Points
```

The scoring table is fixed:

| Position | Points |
| -------: | -----: |
|        1 |     25 |
|        2 |     18 |
|        3 |     15 |
|        4 |     12 |
|        5 |     10 |
|        6 |      8 |
|        7 |      6 |
|        8 |      4 |
|        9 |      2 |
|       10 |      1 |
|      DNF |      0 |

The engine must never accept manually entered points as the primary result.

---

## 4.3 Ranking Engine

Calculates:

* Individual participant totals
* Team totals
* Current team ranking
* Individual ranking
* Ranking history

The team ranking is the primary competition ranking.

Individual ranking is secondary information.

After every confirmed map:

```text
Result confirmed
→ scores recalculated
→ team ranking recalculated
→ ranking history updated
→ realtime event emitted
```

Corrections must trigger the same process.

---

# 5. Match and Map State

## Match

```text
UPCOMING
    ↓
LIVE
    ↓
COMPLETED
```

The administrator manually starts a match.

Starting a match automatically activates its first map.

## Map

```text
PENDING
    ↓
ACTIVE
    ↓
COMPLETED
```

Map progression is automatic.

Example:

```text
Start Match 1
    ↓
P1M1 ACTIVE
    ↓
Confirm result
    ↓
P1M2 ACTIVE
    ↓
Confirm result
    ↓
P1M3 ACTIVE
    ↓
Confirm result
    ↓
Match 1 COMPLETED
```

The next match does not start automatically.

The administrator must manually start it.

---

# 6. Result Processing

When an administrator confirms a map result:

1. Validate the result.
2. Persist the result.
3. Calculate points.
4. Recalculate participant totals.
5. Recalculate team totals.
6. Recalculate rankings.
7. Store ranking/history information.
8. Activate the next map if applicable.
9. Complete the match if the final map has been completed.
10. Emit realtime updates.

The operation must be atomic from the application's perspective.

A partially processed result must never be visible to clients.

---

# 7. Corrections

Administrators must be able to edit a previously confirmed map.

When a result changes:

```text
Edited Result
      ↓
Recalculate scores
      ↓
Recalculate rankings
      ↓
Recalculate dependent data
      ↓
Broadcast updated state
```

Derived values must never be manually edited.

The original map result remains the authoritative data point.

---

# 8. Realtime Architecture

Realtime clients include:

* Public leaderboard
* Creator overlays
* Global broadcast overlays
* Future statistics displays

The backend is the single source of realtime truth.

Recommended implementation:

```text
Backend
   ↓
WebSocket / Socket.IO
   ↓
Connected Clients
```

Events should represent meaningful competition changes, for example:

```text
competition.updated
match.started
map.started
map.completed
result.updated
ranking.updated
match.completed
```

Clients should not calculate competition state independently.

---

# 9. Public Web

The public website consumes competition data.

Main responsibilities:

* Home
* Current tournament status
* Current match/map
* Team classification
* Participant information
* Results
* Historical results
* Future statistics

The existing `index.html` may be reused as the visual foundation.

However:

> Existing frontend structure must not dictate the competition architecture.

If existing frontend code conflicts with the documented product requirements, the product requirements take priority.

---

# 10. Admin Panel

The admin panel is the operational control center.

Responsibilities:

* Configure tournament
* Manage teams
* Manage participants
* Configure matches
* Start matches
* View current map
* Enter results
* Correct results
* View current ranking
* View competition status
* Export data

There is only one permission level:

```text
ADMIN
```

Multiple operators may use the same administrative permissions.

The admin UI should prioritize:

1. Speed
2. Clarity
3. Error prevention
4. Reliability

Visual decoration is secondary.

---

# 11. Broadcast Architecture

Broadcast is a consumer of Competition Core data.

It must never contain independent competition logic.

```text
Competition Core
      ↓
Realtime State
      ↓
Broadcast Overlays
```

The system must support separate browser-source URLs for different broadcast purposes.

Examples:

```text
/overlay/creator-1
/overlay/creator-2
/overlay/global
/overlay/classification
/overlay/statistics
```

Exact visual designs will be defined later in `BROADCAST.md`.

---

# 12. Creator Overlay Data

Each creator overlay may display:

* Creator name
* Creator points
* Current companion name
* Companion points
* Current team position
* Team identity/logo

The creator overlay must not display the global leaderboard.

The overlay receives its data from the same canonical competition state as every other client.

---

# 13. Tiebreaker Architecture

A final team tie may occur.

The system must not automatically select a winner.

Instead:

```text
Final classification
       ↓
Tie detected
       ↓
Tiebreak phase
       ↓
3 maps
       ↓
Creators only
       ↓
Same scoring system
```

The tiebreaker must be represented as a separate competition phase and must not modify the original 12-map main tournament.

The exact participant behavior when more than two teams are tied should remain configurable until explicitly confirmed.

---

# 14. Statistics

Statistics must be generated from stored competition data.

Initial architecture should preserve enough information to support:

* Participant totals
* Team progression
* Map-by-map performance
* Position history
* Score progression
* Match performance
* Records
* Future "epic moment" detection

Statistics must not become a second source of truth.

---

# 15. Export

The admin panel must support:

```text
CSV
JSON
```

Exports should contain raw competition data and relevant derived values.

Exports are an admin function and are not required on the public website.

---

# 16. Recommended Technical Stack

Frontend:

* React
* TypeScript
* Vite
* CSS or Tailwind CSS

Backend:

* Node.js
* TypeScript

Database:

* PostgreSQL

API:

* REST

Realtime:

* WebSocket / Socket.IO

Broadcast:

* OBS Browser Sources

The implementation should avoid unnecessary infrastructure such as Redis, Docker orchestration or microservices unless a concrete requirement appears.

A modular monolith is preferred for the first version.

---

# 17. Architecture Philosophy

Prefer:

```text
Simple
Predictable
Centralized
Typed
Maintainable
```

Avoid:

```text
Overengineering
Duplicated logic
Duplicated scoring
Premature microservices
Unnecessary dependencies
Complex permission systems
```

The system should be capable of growing without requiring the first version to be unnecessarily complex.
