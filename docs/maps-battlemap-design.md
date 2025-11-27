Maps & Battle-Map Design
========================

Overview
--------

The goal is to provide a lightweight but useful battle-map maker for the DM,
integrated with encounters and the Play Screen.

Map Types
---------

- Battle maps: tactical grids used for encounters.
- Region maps: larger-scale area maps used for exploration and context.

Core Concepts
-------------

- Canvas with pan/zoom and optional grid overlay.
- Areas/tiles drawn as simple shapes with color and labels.
- Tokens representing PCs, monsters, NPCs, and landmarks.
- Visibility flags for DM vs player content.

Integration Points
------------------

- Encounters:
  - Encounters can be linked to a battle map.
  - From the encounter designer and Play Screen, DM can open the linked map.

- Notes:
  - Notes can reference maps via entity links.

- Play Screen:
  - Right column or an auxiliary panel can host a map view for the active
    scene/encounter.

Future Enhancements
-------------------

- Per-player visibility and fog-of-war style features.
- Syncing combatant positions on the map with encounter run state (initiative
  order, defeated state, etc.).

