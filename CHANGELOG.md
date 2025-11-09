# Changelog

All notable changes to this project will be documented in this file.

## Unreleased — Character Builder UX Overhaul

Highlights:
- Fixed-size builder panel and pinned Previous/Next footer on every step
- Prefetch next step data (lists + selected details) to avoid staggered loads
- Unified layout helpers (`builder-panel`, `builder-content`, `builder-step`, `builder-footer`)
- Denser spacing and consistent grids (`grid-tight`) for selection lists

Details:
- Race/Class steps
  - Prefetch races/classes and currently selected details before switching steps
  - Two-column detail layout to reduce vertical scroll
- Background step
  - 4-column options grid for better fit
- Personality step
  - Suggestions for traits/ideals/bonds/flaws always visible by default
  - Textareas default to two rows (compact)
- Equipment step
  - Removed per-item selection; common gear included by default
  - 3-column grid for gear; simplified quantity display
- Review step
  - Compact header line and inline ability score chips
  - 3-column equipment list
- General
  - Removed success alert after creation; navigate directly to character page
  - Show full data by default (e.g., full class proficiencies — no "…and N more")

