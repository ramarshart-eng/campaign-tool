DM Tooling Docs
================

This folder describes the long-term plan and implementation checklist for the
Dungeon Master (DM) tooling in this project.

Files
-----

- `dm-roadmap.md`  
  Long-form narrative of the DM-side feature set: notes, campaign planner,
  session planner, encounters + SRD, battle maps, DM Play Screen, roster, and
  technical guardrails.

- `dm-checklist.md`  
  Actionable, bite-sized tasks grouped by the same sections as the roadmap.
  Use this as the primary source of “what to implement next” when driving work
  with Codex.

- `dm-play-flow.md`  
  Focused description of end-to-end flows through the DM tools (Hub → Planner
  → Notes → Play → Encounters → Maps → Player View). Use this when making
  changes that touch multiple pages.

- `maps-battlemap-design.md`  
  Design notes for the battle-map maker: grid, tokens, layers, and how it
  integrates with encounters and the Play Screen.

Usage
-----

- When planning new DM features, start with `dm-roadmap.md`.
- When implementing, pick specific items from `dm-checklist.md`.
- When working on flows that cross pages (Session Planner + Play + Notes),
  consult `dm-play-flow.md`.
- When extending map functionality, consult `maps-battlemap-design.md`.

