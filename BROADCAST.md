# Broadcast

## 1. Purpose

The broadcast system provides browser-source overlays for OBS and other production software.

Broadcast is a consumer of the Competition Core.

It must never contain independent competition logic.

---

# 2. Broadcast Philosophy

The broadcast should provide viewers with context that the game itself does not provide.

In particular:

* Who is the creator?
* Who is their current companion?
* How is their team performing?
* What is happening in the competition?

The broadcast should complement the game rather than duplicate the public website.

---

# 3. Overlay Types

The architecture should support multiple overlay types.

Initial categories:

```text
CREATOR CAMERA
GLOBAL
CLASSIFICATION
STATISTICS
```

Exact visual layouts will be designed separately.

---

# 4. Creator Camera Overlay

Each creator receives a personalized overlay.

Example:

```text id="k9f8xb"
/overlay/creator-1
```

The overlay is connected to the creator's camera scene in OBS.

It should display:

```text id="4u1g6c"
CREATOR NAME
CREATOR POINTS

CURRENT COMPANION
COMPANION POINTS

TEAM POSITION
TEAM POINTS
```

It may also use:

* Creator logo
* Team branding
* Team colors
* Event identity

---

# 5. Creator Overlay Rules

The creator overlay must:

* Be personalized
* Be lightweight
* Update in realtime
* Work independently from the public website
* Not display the full global leaderboard

The overlay should only request the information relevant to that creator.

---

# 6. Creator / Companion Relationship

The game does not necessarily communicate clearly to viewers that the creator and community player belong to the same team.

The broadcast therefore needs to make this relationship visually obvious.

Example:

```text id="qu1j8e"
TEAM CREATOR 1

CREATOR
Tebi

WITH
Player 1
```

The exact visual treatment will be designed later.

---

# 7. Global Overlay

A global overlay may be used to communicate competition information.

Potential content:

* Current map
* Current match
* Event status
* Map result
* Selected statistics
* Selected participant information

It should not become a permanent full leaderboard.

The public website remains the main destination for complete classification.

---

# 8. Classification Overlay

A dedicated classification overlay may be used during broadcast segments.

It can display:

* Team ranking
* Team points
* Recent changes
* Relevant competition context

The exact design and triggering mechanism will be defined later.

---

# 9. Statistics Overlay

A statistics overlay can later display:

* Participant statistics
* Team statistics
* Map performance
* Records
* Historical progression

This should consume the same statistics API used by the public website.

No statistics should be manually entered into an overlay.

---

# 10. Overlay Routing

Each overlay should have a predictable URL.

Examples:

```text id="4ex9pi"
/overlay/creator/creator-1
/overlay/creator/creator-2
/overlay/creator/creator-3
/overlay/creator/creator-4
/overlay/creator/creator-5

/overlay/global
/overlay/classification
/overlay/statistics
```

Exact routing can be adjusted during implementation.

---

# 11. OBS Browser Sources

Every overlay should be usable directly as an OBS Browser Source.

Requirements:

* No visible browser navigation
* Transparent background where appropriate
* Correct fixed dimensions
* Fast loading
* Realtime updates
* No dependency on admin interaction after loading

---

# 12. Transparency

Overlays should support transparent backgrounds where required.

The visual system must assume that the overlay will be rendered over:

* Gameplay
* Creator camera
* Broadcast scenes
* Event graphics

---

# 13. Live State

When an overlay loads:

1. Request current state from the backend.
2. Render current information.
3. Connect to realtime.
4. Listen for updates.

It must not wait for a new event before displaying information.

---

# 14. Connection Failure

If realtime disconnects:

* Keep the last valid state visible.
* Attempt reconnection.
* Refresh authoritative state after reconnecting.

The overlay should not break the broadcast because of a temporary network issue.

---

# 15. Overlay Data Source

All overlays use:

```text id="j9c3fa"
Competition Core
      ↓
Backend API
      ↓
Realtime
      ↓
Overlay
```

Never:

```text id="j9c3fb"
Admin → Overlay directly
```

The admin modifies competition state.

The backend distributes the resulting state.

---

# 16. No Independent Scoring

Broadcast code must never contain logic such as:

```text
if position === 1 then points = 25
```

Scoring belongs exclusively to the backend/domain layer.

This prevents discrepancies between:

* Admin
* Public Web
* Overlay
* Statistics

---

# 17. Broadcast Priority

During development, the broadcast system should be built only after:

1. Competition Core works
2. Scoring works
3. Ranking works
4. Admin works
5. Realtime works

This avoids building overlays against unstable competition logic.

---

# 18. Future Broadcast Features

The architecture should allow future support for:

* Animated score changes
* Position changes
* Team progression
* Record notifications
* Epic moments
* Statistics cards
* Special tournament phases

These should be added only after the core system is stable.

---

# 19. Design Direction

Broadcast visuals should feel:

* Professional
* Esports-oriented
* Clean
* Readable at broadcast resolution
* Consistent with the event identity

The overlay must never sacrifice readability for decoration.

---

# 20. Important Separation

The broadcast system is not the competition system.

```text
COMPETITION
     │
     ├── ADMIN
     ├── PUBLIC WEB
     ├── BROADCAST
     └── STATISTICS
```

All four consume the same authoritative competition state.

The broadcast must never become the source of competition data.
