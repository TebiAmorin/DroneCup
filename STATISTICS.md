# Statistics

## 1. Purpose

The statistics system provides historical and analytical information generated from the competition's authoritative data.

Statistics are a secondary layer.

They must never become a separate source of truth.

The primary source remains:

```text
Map Results
```

---

# 2. Main Principle

All statistics must be derivable from stored competition data.

```text
Map Results
    ↓
Scoring
    ↓
Participant / Team Totals
    ↓
Statistics
```

No statistic should require manual input unless explicitly defined as an event-specific metadata field.

---

# 3. Initial Statistics

The first statistics implementation should focus on reliable, useful information.

## Participant

Possible statistics:

* Total points
* Maps played
* Maps won
* Best position
* Average position
* DNF count
* Position history
* Points per map

## Team

Possible statistics:

* Total points
* Current position
* Position history
* Points per map
* Points per match
* Team progression

---

# 4. Map Statistics

Every map should be independently queryable.

Example:

```text
P2M3

1. Participant A — 25 pts
2. Participant B — 18 pts
3. Participant C — 15 pts
...
10. Participant J — 1 pt
DNF — 0 pts
```

The complete map result must remain available even after the tournament finishes.

---

# 5. Match Statistics

A match contains three maps.

Statistics may include:

* Total points earned during the match
* Team ranking after each map
* Participant performance
* Position changes
* Match totals

Example:

```text
MATCH 2

P2M1 → Team A 1st
P2M2 → Team C 1st
P2M3 → Team A 1st
```

---

# 6. Progression

One of the most important future statistics is team progression.

Example:

```text
Map       Team A    Team B    Team C
P1M1       25        18        15
P1M2       43        40        27
P1M3       58        52        44
...
```

This allows graphs showing:

* Total points over time
* Ranking over time
* Position changes
* Momentum

---

# 7. Position History

Every participant's position can be represented chronologically.

Example:

```text
Participant A

P1M1 → 2nd
P1M2 → 1st
P1M3 → DNF
P2M1 → 4th
```

This allows future analysis without modifying the original result data.

---

# 8. Team Position History

The team classification after each completed map should be recoverable.

Example:

```text
P1M1 → 3rd
P1M2 → 2nd
P1M3 → 1st
P2M1 → 2nd
```

This is useful for:

* Public graphs
* Broadcast graphics
* Content
* Tournament recaps

---

# 9. Records

The system should eventually support records such as:

* Highest points on one map
* Most first places
* Most top 3 finishes
* Most DNFs
* Highest total score
* Biggest ranking climb
* Biggest ranking drop
* Longest period in first place

Records must always be generated from authoritative results.

---

# 10. Epic Moments

Future versions may identify notable competition moments such as:

* Major comeback
* Large ranking jump
* Team taking first place
* Team losing first place
* Exceptional map score
* Consecutive victories
* Unexpected DNF
* Final-map classification changes

The initial system does **not** need automatic epic-moment detection.

The database should simply preserve enough information to make it possible later.

---

# 11. No Video Association

Statistics do not need to be linked to:

* Clips
* Replays
* Videos
* VOD timestamps

Those systems are outside the initial scope.

---

# 12. Statistics API

Statistics should be exposed through read-only endpoints.

Examples:

```text
/api/statistics/teams
/api/statistics/participants
/api/statistics/maps
/api/statistics/matches
/api/statistics/progression
/api/statistics/records
```

Exact endpoints may evolve during implementation.

---

# 13. Statistics UI

Statistics can eventually appear in:

### Public Web

* Team profiles
* Participant profiles
* Tournament history
* Graphs
* Records

### Broadcast

* Statistics cards
* Player performance
* Team progression
* Records

### Admin

* Detailed competition analysis
* Export preparation
* Result verification

---

# 14. Graphs

The system should eventually support automatic graphs.

Potential graphs:

### Team Points

```text
Points
  │
  │       ╭────
  │    ╭──╯
  │ ╭──╯
  └──────────────── Map
```

### Team Position

```text
Position
  │
  │  1 ─────────
  │
  │  2     ╲────
  │
  │  3 ─╮
  └──────────────── Map
```

Graphs must use real stored data.

---

# 15. Statistics Performance

Initially, statistics should preferably be calculated from existing data.

Do not create large denormalized statistics tables prematurely.

If the tournament or future tournaments become large enough to require optimization, derived aggregates can be introduced later.

---

# 16. Historical Integrity

Once a map result has been stored, its historical significance must remain reconstructable.

Corrections are allowed.

When a correction occurs, all derived statistics must reflect the corrected authoritative result.

---

# 17. Statistics Philosophy

Statistics should answer questions such as:

```text
Who scored the most?
Which team improved the most?
How did the classification change?
Who had the best map?
Which maps changed the tournament?
```

The system should provide the data without inventing interpretations or narratives.
