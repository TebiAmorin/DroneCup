# API

## 1. Purpose

This document defines the backend API used by:

* Admin Panel
* Public Web
* Broadcast Overlays
* Statistics
* Future integrations

The API must expose competition data without duplicating competition logic in clients.

The backend is responsible for:

* Validation
* Competition state
* Scoring
* Rankings
* Result persistence
* Match/map progression
* Realtime event generation

---

# 2. API Principles

The API should be:

* REST-based
* JSON-based
* Typed
* Predictable
* Explicit
* Easy to consume from React

Clients must never calculate official scores themselves.

---

# 3. Base Structure

Recommended structure:

```text
/api
```

Resources:

```text
/api/tournament
/api/teams
/api/participants
/api/matches
/api/maps
/api/results
/api/rankings
/api/overlays
/api/statistics
/api/export
```

Exact route naming may be adjusted during implementation if consistency is maintained.

---

# 4. Tournament

## Get tournament

```http
GET /api/tournament
```

Returns:

* Tournament information
* Current status
* Current match
* Current map
* Basic competition state

---

# 5. Teams

## List teams

```http
GET /api/teams
```

Returns all tournament teams.

## Get team

```http
GET /api/teams/:id
```

Returns:

* Team information
* Creator
* Player 1
* Player 2
* Current points
* Current ranking
* Historical performance

## Create team

```http
POST /api/teams
```

Admin only.

## Update team

```http
PUT /api/teams/:id
```

Admin only.

---

# 6. Participants

## List participants

```http
GET /api/participants
```

Optional filtering:

```text
team
type
match
```

## Get participant

```http
GET /api/participants/:id
```

Returns:

* Participant information
* Team
* Current points
* Map results
* Match participation
* Individual statistics

## Create participant

```http
POST /api/participants
```

Admin only.

## Update participant

```http
PUT /api/participants/:id
```

Admin only.

---

# 7. Matches

## List matches

```http
GET /api/matches
```

Returns all matches and their states.

## Get match

```http
GET /api/matches/:id
```

Returns:

* Match information
* Status
* Participating players
* Maps
* Current map
* Results
* Current scores

---

# 8. Start Match

```http
POST /api/matches/:id/start
```

Admin only.

Expected behavior:

1. Validate that the match can start.
2. Set match to `LIVE`.
3. Activate Map 1.
4. Update tournament current match/map.
5. Emit realtime events.

The frontend must not manually activate Map 1.

---

# 9. Maps

## List maps

```http
GET /api/matches/:matchId/maps
```

## Get map

```http
GET /api/maps/:id
```

Returns:

* Map state
* Match
* Map number
* Participants
* Results

---

# 10. Results

## Get map results

```http
GET /api/maps/:id/results
```

Returns every participant in the map.

Example:

```json
[
  {
    "participantId": "123",
    "participantName": "Creator 1",
    "position": 1,
    "status": "FINISHED",
    "points": 25
  }
]
```

---

# 11. Confirm Map Result

```http
POST /api/maps/:id/results
```

Admin only.

Request concept:

```json
{
  "results": [
    {
      "participantId": "1",
      "position": 1
    },
    {
      "participantId": "2",
      "position": 2
    },
    {
      "participantId": "3",
      "position": null,
      "status": "DNF"
    }
  ]
}
```

The backend must:

1. Validate all participants.
2. Validate positions.
3. Validate DNF entries.
4. Calculate points.
5. Persist results.
6. Recalculate totals.
7. Recalculate rankings.
8. Complete the map.
9. Activate the next map if applicable.
10. Complete the match if this was Map 3.
11. Emit realtime events.

The frontend must never send authoritative point values.

---

# 12. Correct Map Result

```http
PUT /api/maps/:id/results
```

Admin only.

The same validation and recalculation rules apply.

Changing a result must update:

* Participant totals
* Team totals
* Rankings
* Ranking history
* Statistics
* Realtime clients

---

# 13. Rankings

## Current ranking

```http
GET /api/rankings
```

Returns the current team classification.

Example:

```json
[
  {
    "rank": 1,
    "teamId": "team-1",
    "teamName": "Team Creator 1",
    "points": 125
  }
]
```

## Historical ranking

```http
GET /api/rankings/history
```

Allows the public site and statistics system to retrieve classification progression by map.

---

# 14. Public Competition State

A consolidated endpoint is recommended for public clients:

```http
GET /api/public/state
```

It may contain:

```text
Tournament
Current match
Current map
Teams
Current ranking
Current results
Relevant participants
```

This reduces unnecessary client requests for the main public interface.

---

# 15. Overlay State

A dedicated lightweight endpoint is recommended:

```http
GET /api/overlay/:creatorId
```

It should return only information required by that creator's overlay.

Example:

```json
{
  "creator": {
    "name": "Creator 1",
    "points": 64
  },
  "companion": {
    "name": "Player 1",
    "points": 38
  },
  "team": {
    "name": "Team Creator 1",
    "rank": 2,
    "points": 102
  }
}
```

The overlay should not need to understand the entire competition model.

---

# 16. Admin State

A dedicated endpoint may provide all information required by the live operator:

```http
GET /api/admin/state
```

Possible contents:

* Current tournament state
* Current match
* Current map
* Eligible participants
* Current results
* Current ranking
* Recent activity
* Match progression

This allows the admin interface to load its complete operational state efficiently.

---

# 17. Statistics

Statistics endpoints should be read-only.

Examples:

```http
GET /api/statistics/teams
GET /api/statistics/participants
GET /api/statistics/maps
GET /api/statistics/matches
```

Statistics are derived from authoritative competition data.

---

# 18. Export

Admin-only endpoints:

```http
GET /api/export/csv
GET /api/export/json
```

Exports should include sufficient information to reconstruct the competition history.

---

# 19. Authentication

The initial system only requires one permission level:

```text
ADMIN
```

Public endpoints require no authentication.

Admin endpoints require authentication.

The exact authentication implementation can be decided during development, but it must not introduce unnecessary role complexity.

---

# 20. Error Handling

API errors should use predictable JSON.

Example:

```json
{
  "error": "INVALID_RESULT",
  "message": "Every participant must have a result."
}
```

Useful error categories:

```text
INVALID_RESULT
INVALID_POSITION
DUPLICATE_POSITION
INVALID_PARTICIPANT
PARTICIPANT_NOT_ELIGIBLE
MAP_NOT_ACTIVE
MATCH_NOT_READY
MATCH_ALREADY_COMPLETED
UNAUTHORIZED
NOT_FOUND
```

---

# 21. API Rule

The API must enforce the competition rules.

Never rely on the frontend to prevent invalid competition states.

For example:

The frontend may disable the "Confirm Map" button, but the backend must still reject an invalid result if the request is sent manually.
