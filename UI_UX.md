# UI / UX

## 1. Purpose

This document defines the user experience and interface principles for the competition platform.

The system has three main interfaces:

```text
PUBLIC WEB
ADMIN PANEL
BROADCAST / OVERLAYS
```

They serve different purposes and must not be treated as the same interface.

---

# 2. General Design Direction

The visual direction should feel:

* Professional
* Modern
* Esports-oriented
* Clean
* Fast
* Easy to understand
* Suitable for an official event

Avoid unnecessary decoration.

Information hierarchy is more important than visual effects.

---

# 3. Existing Frontend

An existing `index.html` has already been created as an initial visual foundation.

It currently contains:

* Home
* Classification
* Competition explanation

The existing structure and useful visual decisions should be preserved where possible.

However:

> The existing `index.html` is a visual starting point, not the final product architecture.

Claude must first inspect the existing implementation and identify:

* Reusable components
* Existing layout
* Existing styles
* Existing responsive behavior
* Existing navigation
* Existing classification UI
* Existing visual identity

The existing work should be extended rather than unnecessarily discarded.

If existing code conflicts with the requirements defined in `README.md` or the technical documentation, the documented requirements take priority.

---

# 4. Public Web

The public website should communicate the competition clearly to viewers.

Main sections:

```text
HOME
CLASSIFICATION
CURRENT MATCH
RESULTS
COMPETITION INFORMATION
```

Future sections may include:

```text
STATISTICS
HISTORY
RECORDS
```

These should not be implemented prematurely unless required.

---

# 5. Home

The Home page should immediately communicate:

* What the competition is
* Current competition status
* Current match/map
* Main classification
* Participating creators/teams
* Basic rules

The existing Home design should be reused where appropriate.

---

# 6. Classification

Classification is the main public competition view.

It should prioritize team standings.

Example:

```text id="w4yq3d"
┌────┬─────────────────────┬────────┐
│ #  │ TEAM                │ POINTS │
├────┼─────────────────────┼────────┤
│ 1  │ Creator Team        │ 142    │
│ 2  │ Creator Team        │ 137    │
│ 3  │ Creator Team        │ 121    │
│ 4  │ Creator Team        │ 108    │
│ 5  │ Creator Team        │ 97     │
└────┴─────────────────────┴────────┘
```

The classification must update in realtime.

Individual rankings may be available as secondary information but must not replace the team classification.

---

# 7. Current Match

The public website should clearly indicate:

```text id="u2u5tb"
MATCH 2
MAP 2
LIVE
```

It should also communicate which participants are currently playing.

Example:

```text id="2f8k27"
Creator 1 + Player 1
Creator 2 + Player 1
Creator 3 + Player 1
Creator 4 + Player 1
Creator 5 + Player 1
```

This is particularly important because the game itself does not necessarily make the team relationships obvious to viewers.

---

# 8. Admin Panel

The Admin Panel is the operational control center.

It must be optimized for live event operation.

The administrator should be able to understand the current state immediately.

---

# 9. Admin Dashboard

Recommended structure:

```text id="r3m2eq"
┌─────────────────────────────────────────────┐
│ MATCH 2                         ● LIVE       │
│                                             │
│ CURRENT MAP: P2M1                           │
│                                             │
│ [ RESULT ENTRY ]                            │
│                                             │
│ CURRENT CLASSIFICATION                      │
│                                             │
│ 1. Team Creator 3       142 pts             │
│ 2. Team Creator 1       137 pts             │
│ 3. Team Creator 5       121 pts             │
└─────────────────────────────────────────────┘
```

The exact layout can evolve during implementation.

The important requirement is operational clarity.

---

# 10. Result Entry

Result entry is one of the most important admin interactions.

The administrator should enter:

```text
Participant → Position / DNF
```

Not:

```text
Participant → Points
```

Points are calculated automatically.

Recommended interaction:

```text id="7x5a0v"
1. Participant A → 1st
2. Participant B → 2nd
3. Participant C → DNF
...
```

A position selector/dropdown or equivalent fast input method should be used.

---

# 11. Result Validation UI

Before confirmation, the interface should clearly show errors.

Examples:

```text
Position 4 is assigned twice.
```

```text
Participant X has no result.
```

```text
Participant Y cannot participate in this match.
```

The Confirm button should remain unavailable until the result is valid.

Backend validation remains mandatory.

---

# 12. Confirming a Map

The primary action should be obvious:

```text id="n8n1vl"
[ CONFIRM MAP RESULT ]
```

Because this action changes the official competition state, a confirmation step may be used if appropriate.

After confirmation:

```text id="m7d1g5"
P2M1 COMPLETED

P2M2 ACTIVE
```

The transition should be visually obvious.

---

# 13. Match Controls

The administrator should have explicit controls for:

```text
START MATCH
```

and, where appropriate:

```text
EDIT RESULT
```

The system should not require manual activation of each map.

Correct flow:

```text
Start Match
    ↓
Map 1 active
    ↓
Confirm result
    ↓
Map 2 active
    ↓
Confirm result
    ↓
Map 3 active
    ↓
Confirm result
    ↓
Match completed
```

---

# 14. Result Correction

Previously completed maps must be editable by the administrator.

The UI should clearly communicate that a correction will recalculate:

* Participant score
* Team score
* Ranking
* Historical data
* Realtime state

---

# 15. Team Management

Admin should provide interfaces for:

* Creating teams
* Editing team names
* Setting team logo
* Assigning creator
* Assigning Player 1
* Assigning Player 2

The system should clearly show:

```text id="8d8l9m"
TEAM CREATOR 1

CREATOR
Name

PLAYER 1
Name

PLAYER 2
Name
```

---

# 16. Match Configuration

The admin should be able to view the expected participation.

Example:

```text id="8m47cx"
MATCH 1

Creator 1 + Player 1
Creator 2 + Player 1
Creator 3 + Player 1
Creator 4 + Player 1
Creator 5 + Player 1
```

and:

```text id="1cl7lq"
MATCH 3

Creator 1 + Player 2
Creator 2 + Player 2
Creator 3 + Player 2
Creator 4 + Player 2
Creator 5 + Player 2
```

This reduces operational mistakes.

---

# 17. Responsive Design

Public web should work well on:

* Desktop
* Tablet
* Mobile

Admin is primarily desktop-oriented because it is an operational tool.

Broadcast overlays should be designed specifically for their OBS browser-source dimensions rather than treated as a generic responsive webpage.

---

# 18. Loading States

Every interface should handle:

* Loading
* Empty state
* Error state
* Reconnecting
* No active match
* Tournament completed

Avoid blank screens.

---

# 19. Realtime Feedback

Important live events should produce immediate visual feedback.

Examples:

```text
MAP COMPLETED
```

```text
NEXT MAP ACTIVE
```

```text
RANKING UPDATED
```

Animations should be subtle and informative.

Avoid excessive animation during live operation.

---

# 20. UX Priorities

Priority order:

```text
1. Correctness
2. Speed
3. Clarity
4. Error prevention
5. Visual quality
6. Animation
```

The admin panel especially must prioritize function over decoration.

---

# 21. Visual Consistency

The same competition identity should be recognizable across:

* Public website
* Admin panel
* Broadcast overlays

However, each interface can have its own layout optimized for its purpose.

---

# 22. Future-Proofing

The UI should be component-based.

Likely reusable components:

```text
TeamCard
ParticipantCard
RankingTable
MatchStatus
MapStatus
ResultTable
ScoreDisplay
CreatorBadge
TeamLogo
```

Do not build each page as one giant component.

The frontend should be structured so new statistics and broadcast views can be added without rebuilding the existing interface.
