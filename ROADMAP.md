# Roadmap

## 1. Objective

Build the competition platform incrementally.

The priority is to have a reliable competition system before investing heavily in broadcast polish, advanced statistics or secondary features.

---

# 2. Development Principle

Build in this order:

```text
Competition
    ↓
Administration
    ↓
Realtime
    ↓
Public Web
    ↓
Broadcast
    ↓
Statistics
    ↓
Export / Advanced Features
```

Each phase should produce a functional system before moving to the next.

---

# 3. Phase 0 — Existing Frontend Analysis

Before modifying the existing application:

* Inspect the existing `index.html`
* Inspect its structure
* Inspect existing CSS
* Inspect existing components
* Identify reusable elements
* Identify current Home
* Identify current Classification
* Identify existing navigation
* Identify existing visual identity

Do not discard useful existing work without reason.

---

# 4. Phase 1 — Project Foundation

Set up:

* Frontend
* Backend
* Database
* TypeScript
* Environment configuration
* Basic API structure
* Basic frontend routing
* Database connection

Target:

```text
Frontend ↔ Backend ↔ Database
```

---

# 5. Phase 2 — Competition Core

Implement:

* Tournament
* Teams
* Participants
* Match structure
* Match participation
* Maps
* Match states
* Map states
* Main tournament phases
* Tiebreak phase structure

Target:

The system knows exactly who participates in every map.

---

# 6. Phase 3 — Scoring Engine

Implement the centralized scoring system:

```text
1st  → 25
2nd  → 18
3rd  → 15
4th  → 12
5th  → 10
6th  → 8
7th  → 6
8th  → 4
9th  → 2
10th → 1
DNF  → 0
```

Implement:

* Position validation
* DNF validation
* Point calculation
* Participant totals
* Team totals

No frontend scoring.

---

# 7. Phase 4 — Ranking Engine

Implement:

* Team ranking
* Individual ranking
* Ranking updates after every map
* Ranking history
* Tie detection
* Tiebreak phase support

The main competition ranking remains team-based.

---

# 8. Phase 5 — Admin Panel

Implement the operational control center.

Required functionality:

* Tournament overview
* Team management
* Participant management
* Match overview
* Current map
* Start match
* Result entry
* Result validation
* Confirm map
* Automatic next map
* Match completion
* Result correction
* Current classification

This phase is critical.

The administrator must be able to operate the complete tournament without touching the database manually.

---

# 9. Phase 6 — Realtime

Implement:

* WebSocket / Socket.IO
* Connection handling
* Reconnection
* Competition events
* Map events
* Result events
* Ranking events

Test multiple clients simultaneously.

Example:

```text
Admin
  ↓
Backend
  ↓
Public Web
  ↓
Overlay
```

All should update correctly.

---

# 10. Phase 7 — Public Web

Expand the existing frontend.

Required:

* Home
* Classification
* Current match
* Current map
* Competition explanation
* Results

Preserve useful existing design work.

Do not rebuild the existing frontend purely for the sake of changing it.

---

# 11. Phase 8 — Broadcast

Implement:

* Creator overlays
* Global overlay
* Classification overlay
* Statistics overlay foundation

Creator overlay must support:

* Creator
* Creator points
* Companion
* Companion points
* Team position
* Team points
* Team identity

All overlays consume realtime competition data.

---

# 12. Phase 9 — Statistics

Implement:

* Participant statistics
* Team statistics
* Map statistics
* Match statistics
* Position history
* Team progression
* Basic graphs

Do not build automatic epic-moment detection yet.

---

# 13. Phase 10 — Export

Implement admin-only:

```text
CSV
JSON
```

Exports should include:

* Teams
* Participants
* Matches
* Maps
* Results
* Points
* Rankings
* Historical data

---

# 14. Phase 11 — Advanced Features

Only after the core platform is stable:

* Advanced graphs
* Records
* Epic moments
* Animated broadcast transitions
* Advanced overlay controls
* Content-oriented statistics
* Additional tournament phases

---

# 15. Testing Milestones

Each major phase must be tested before moving forward.

## Competition Core

Verify:

```text
5 teams
15 participants
4 matches
12 maps
```

## Participation

Verify:

```text
Match 1 → Creator + Player 1
Match 2 → Creator + Player 1
Match 3 → Creator + Player 2
Match 4 → Creator + Player 2
```

## Scoring

Verify all positions and DNF.

## Result Validation

Verify:

* Duplicate positions rejected
* Missing participant rejected
* Invalid participant rejected
* Multiple DNF accepted
* Exactly 10 results required

## Progression

Verify:

```text
Start Match
→ Map 1
→ Map 2
→ Map 3
→ Match complete
```

## Correction

Verify that changing a previous result recalculates everything.

## Realtime

Verify multiple connected clients receive identical authoritative state.

---

# 16. Acceptance Test

A complete end-to-end test should simulate:

```text
Create tournament
      ↓
Create 5 teams
      ↓
Create 15 participants
      ↓
Configure participation
      ↓
Start Match 1
      ↓
Enter P1M1
      ↓
Confirm
      ↓
P1M2 automatically activates
      ↓
Enter P1M2
      ↓
Confirm
      ↓
P1M3 automatically activates
      ↓
Enter P1M3
      ↓
Confirm
      ↓
Match 1 completed
      ↓
Start Match 2
      ↓
...
      ↓
Complete Match 4
      ↓
Final classification
```

If teams are tied:

```text
Tie detected
      ↓
Tiebreak phase
      ↓
3 maps
      ↓
Final result
```

---

# 17. Definition of Done

The core system is considered ready when:

* An admin can configure the tournament.
* All participants are correctly assigned.
* A match can be started.
* Maps progress automatically.
* Results can be entered manually.
* Invalid results are rejected.
* Points are calculated automatically.
* Team totals are correct.
* Rankings update after every map.
* Public clients receive realtime updates.
* Results can be corrected.
* Corrections recalculate derived values.
* Match 4 can be completed.
* Final classification is available.
* Tiebreak structure exists.
* Data can be exported.

---

# 18. Development Priority

If time becomes limited, prioritize:

```text
1. Competition Core
2. Scoring
3. Ranking
4. Admin
5. Realtime
6. Public Classification
7. Broadcast
8. Statistics
9. Export
10. Advanced features
```

A fully reliable competition system is more important than a visually impressive but fragile platform.

---

# 19. Explicit Non-Goals

Do not add without explicit approval:

* Game API integration
* Automatic game result ingestion
* Complex user roles
* Social system
* User accounts for viewers
* Clips/replay management
* Automatic video processing
* Automatic epic-moment detection
* Complex microservices
* Unnecessary infrastructure
* Unrequested gamification

---

# 20. Final Product

The final system should allow two operators to run the entire competition from the Admin Panel while simultaneously providing:

```text
                 ┌─────────────┐
                 │    ADMIN    │
                 └──────┬──────┘
                        │
                        ▼
                ┌───────────────┐
                │   COMPETITION │
                │     CORE      │
                └───────┬───────┘
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
       PUBLIC WEB    BROADCAST   STATISTICS
           │            │            │
           └────────────┴────────────┘
                        │
                     REALTIME
```

The platform should feel like a professional competition control system rather than a simple leaderboard website.
