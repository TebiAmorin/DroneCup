# Database

## 1. Purpose

The database stores the complete competition state and all historical map results.

The database must preserve enough information to reconstruct:

* Current standings
* Previous standings
* Individual performance
* Team performance
* Every map result
* Match progression
* Future statistics
* CSV/JSON exports

The database is the persistent source of truth.

---

# 2. Main Relationships

```text
Tournament
   │
   ├── Teams
   │     │
   │     └── Participants
   │
   └── Matches
          │
          └── Maps
                 │
                 └── Results
```

Conceptually:

```text
TEAM
 ├── Creator
 ├── Player 1
 └── Player 2

MATCH
 ├── Map 1
 ├── Map 2
 └── Map 3

MAP
 └── Participant Results
```

---

# 3. Tournament

Represents the competition.

Suggested fields:

```text
id
name
status
current_match_id
current_map_id
created_at
updated_at
```

Possible tournament states:

```text
DRAFT
READY
LIVE
COMPLETED
```

The tournament contains the 4 main matches and future tiebreak phases.

---

# 4. Team

Represents one creator/community team.

Suggested fields:

```text
id
tournament_id
name
slug
logo_url
creator_name
created_at
updated_at
```

Example:

```text
Team Creator 1
Team Creator 2
Team Creator 3
Team Creator 4
Team Creator 5
```

The creator is the visual identity of the team.

---

# 5. Participant

Represents an individual competitor.

Suggested fields:

```text
id
team_id
name
slug
type
created_at
updated_at
```

Participant types:

```text
CREATOR
PLAYER_1
PLAYER_2
```

There are 15 participants in the main tournament:

```text
5 creators
5 player 1
5 player 2
```

---

# 6. Match

Represents one main competition match.

Suggested fields:

```text
id
tournament_id
match_number
phase
status
started_at
completed_at
created_at
updated_at
```

Main matches:

```text
Match 1
Match 2
Match 3
Match 4
```

Each match contains exactly 3 maps.

---

# 7. Match Participation

Participation should be represented explicitly rather than inferred only from participant type.

Suggested fields:

```text
id
match_id
participant_id
created_at
```

This makes eligibility explicit and allows future competition formats without changing the core participant model.

Expected participation:

```text
Match 1 → Creator + Player 1
Match 2 → Creator + Player 1
Match 3 → Creator + Player 2
Match 4 → Creator + Player 2
```

Each match therefore has 10 participants.

---

# 8. Map

Represents an individual map inside a match.

Suggested fields:

```text
id
match_id
map_index
code
status
started_at
completed_at
created_at
updated_at
```

Example codes:

```text
P1M1
P1M2
P1M3

P2M1
P2M2
P2M3
```

The code is primarily a human-facing identifier.

The database relationship must rely on IDs rather than parsing the code.

For example:

```text
match_id = Match 1
map_index = 1
code = P1M1
```

---

# 9. Map Result

This is one of the most important tables/entities in the system.

A result represents one participant's result on one map.

Suggested fields:

```text
id
map_id
participant_id
position
status
points
created_at
updated_at
```

Possible status:

```text
FINISHED
DNF
```

Rules:

* Position is `1–10` for finished participants.
* DNF has no position.
* DNF awards 0 points.
* Every eligible participant must have a result.
* Multiple participants may be DNF.
* Finished participants cannot share a position.

`points` is derived from the scoring engine and should not be manually editable.

---

# 10. Result Validation

Before a map result can be confirmed:

### Participant count

Exactly 10 eligible participants must have a result.

### Finished positions

Positions must be unique.

### Valid positions

Only:

```text
1
2
3
4
5
6
7
8
9
10
```

are valid.

### DNF

Any number of eligible participants may be DNF.

### Duplicate participant

A participant cannot appear twice in the same map.

### Eligibility

A participant must belong to the current match.

---

# 11. Scoring Configuration

The scoring table should not be hardcoded throughout the application.

A centralized scoring configuration should exist.

Example:

```text
position 1  → 25
position 2  → 18
position 3  → 15
position 4  → 12
position 5  → 10
position 6  → 8
position 7  → 6
position 8  → 4
position 9  → 2
position 10 → 1
DNF         → 0
```

Whether this is stored as database configuration or application configuration can be decided during implementation.

The important requirement is that there is only one scoring definition.

---

# 12. Score Calculation

Player score is derived from their map results.

Conceptually:

```text
Player Total
=
sum of points from all maps participated in
```

Team score is:

```text
Team Total
=
sum of all points earned by the team's participants
```

For the main tournament:

```text
Creator
+
Player 1
+
Player 2
=
Team Total
```

Only maps in which the participant is eligible and participated are included.

---

# 13. Ranking

The primary ranking is by team.

Example:

```text
1. Team Creator 3 — 142 pts
2. Team Creator 1 — 137 pts
3. Team Creator 5 — 121 pts
...
```

The individual ranking is secondary.

It may be generated dynamically from participant totals.

---

# 14. Ranking History

The system must preserve ranking progression after every completed map.

This allows future graphs such as:

```text
Map 1 → Team ranking
Map 2 → Team ranking
Map 3 → Team ranking
...
Map 12 → Final ranking
```

A ranking snapshot entity may be used.

Suggested fields:

```text
id
tournament_id
map_id
team_id
rank
total_points
created_at
```

This is derived historical information.

If implementation chooses to calculate history dynamically from immutable results, that is acceptable, but the system must still support retrieving standings at previous map checkpoints.

---

# 15. Tiebreak Phase

A tiebreak must be represented separately from the main tournament.

Suggested phase field:

```text
MAIN
TIEBREAK
```

The tiebreak consists of:

```text
3 maps
```

and uses the same scoring system.

Tiebreak results must not overwrite or merge with the original 12-map main tournament results.

They should remain independently identifiable.

---

# 16. Timestamps

Important entities should contain timestamps.

At minimum:

```text
created_at
updated_at
```

Competition events should additionally support:

```text
started_at
completed_at
```

This is important for:

* Auditability
* Statistics
* Timeline reconstruction
* Future content generation

---

# 17. Audit Considerations

Result corrections are important operational events.

The architecture should leave room for an audit/history system containing:

```text
entity
entity_id
action
old_value
new_value
created_at
```

This does not need to become a complex versioning system in the first implementation.

The primary requirement is that administrators can safely correct results and the system recalculates all derived data.

---

# 18. Data Integrity

The database must enforce relationships wherever practical.

Examples:

* A participant belongs to a team.
* A team belongs to a tournament.
* A match belongs to a tournament.
* A map belongs to a match.
* A result belongs to a map.
* A result participant must be eligible for that match.
* A map cannot have duplicate participant results.
* A map cannot have duplicate finished positions.

Business validation should exist in the backend even where database constraints cannot fully represent the rule.

---

# 19. No Manual Derived Data

The following should never be treated as independent manually editable values:

```text
Player total
Team total
Ranking
Points from position
```

The source data is:

```text
Participant
Match
Map
Result
Position / DNF
```

Everything else is derived.

---

# 20. Future Statistics Compatibility

The schema must allow future queries such as:

* Best map position
* Average position
* Total points
* DNF count
* Team progression
* Creator progression
* Player 1 performance
* Player 2 performance
* Match performance
* Map performance
* Biggest position changes
* Records

No special statistics tables should be introduced unless they provide a measurable performance benefit.

Prefer deriving statistics from authoritative competition data.

---

# 21. Database Philosophy

The database should be:

```text
Normalized enough to preserve integrity
Simple enough to maintain
Flexible enough for future statistics
Explicit enough for competition logic
```

Do not create unnecessary tables for data that can safely be derived.

The most important persisted information is the individual map result.
