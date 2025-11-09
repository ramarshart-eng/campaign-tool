## Architecture Overview

This document maps the major parts of the app and how data flows between them.

### High‑Level
- Pages (Next.js Pages Router) render top‑level views and prototypes
- Components under `src/lib/components` implement UI for builder, sheet, notes
- `CharacterContext` owns character state and exposes actions to update it
- Helpers in `rules/` and `utils/` keep logic testable and framework‑agnostic

### Key Modules
- `src/lib/context/CharacterContext.tsx`
  - Central store for character data used across builder + sheet
  - Provides context provider and hooks for reading/updating

- `src/lib/components/CharacterBuilder/*`
  - Step components for race/class/background/ability scores/equipment
  - Compose into `CharacterBuilder.tsx` stepper flow

- `src/lib/components/CharacterSheet.tsx` and `src/lib/components/PlayArea.tsx`
  - Display character info and actions; tabbed hotbar style navigation
  - Uses small UI primitives (e.g., `Panel`, `RollButton`, `RollLog`)

- `src/lib/rules/rollDice.ts`, `src/lib/rules/computeModifiers.ts`
  - Encapsulate dice and modifier math; pure functions for easy testing

- `src/lib/api/srd.ts` + `src/lib/hooks/useSRD.ts`
  - SRD fetching/parsing helpers (type safe via `src/lib/types`)

### Types & Data
- `src/lib/types/*` defines core shapes: `Character`, `Item`, `SRD`, `ActionButton`
- `src/lib/data/*` holds static data: `backgrounds`, `weapons`

### Styling
- Tailwind v4 for utilities
- Global tokens and reusable classes live in `src/styles/globals.css`
- Prefer utilities; add minimal global classes for shareable UI primitives (panel, tabs, buttons)

### Page Flow
1. User builds a character in builder steps
2. State persists in `CharacterContext`
3. Character Sheet / Play Area consume the same state
4. Actions (e.g., roll dice) use helpers in `rules/` and log via `RollLog`

### Testing Guidance (to add)
- Unit test pure helpers in `rules/` and `utils/`
- Component tests for critical flows (builder step transitions, action rolls)

### Future Extensions
- Persist characters (localStorage or backend)
- Import/export character JSON
- Real SRD source integration and filtering
- Multi‑character management

