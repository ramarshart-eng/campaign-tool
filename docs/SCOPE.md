## Project Scope

Purpose: Align on what we’re building, what we aren’t, and how we’ll phase it so two contributors can work in parallel with clear acceptance criteria.

---

### Goals

- Build a fast, simple 5e‑style character tool focused on session play.
- Provide an opinionated character builder that outputs a consistent sheet.
- Enable play with a hotbar, dice rolls, and a persistent roll log.
- Offer a two‑page notes book with quick navigation.
- Ship with zero backend to start; later, add optional persistence.

### Non‑Goals (for now)

- Virtual tabletop (maps, grids, tokens, lighting, initiative trackers).
- Realtime collaboration/multiplayer.
- Rules beyond SRD‑compatible basics (spells, subclass depth beyond MVP).
- Authentication/authorization and user accounts.
- Full PDF export/print layout polish.

### Assumptions

- Target: 5e SRD‑compatible content and terminology.
- Persistence begins as in‑browser (localStorage/IndexedDB) before any backend.
- Next.js Pages Router is acceptable (already in use).
- Tailwind v4 + small custom classes in `globals.css`.

### Risks

- SRD coverage/accuracy (licensing and data completeness).
- Scope creep in builder options (depth per class/background).
- Performance on lower‑end devices (rich UI, lots of state).
- Next/Tailwind major updates changing APIs.

---

## MVP (Phase 1)

Deliverable: A user can create a level‑1 character, open a sheet/play area, roll basic checks/saves/attacks, and take notes. No login. Data persists locally.

### Epics and Acceptance Criteria

1. Character Model + Local Persistence

- Define `Character` shape (abilities, prof bonus, class, race, background, inventory, AC/HP, actions).
- Local save/load (auto‑save on change; restore on reload).
- Import/export character JSON.

2. Character Builder (Level 1)

- Steps: Name → Race → Class → Background → Ability Scores → Equipment → Review.
- Ability score assignment with point buy or standard array.
- Derived stats: modifiers, proficiency bonus, AC baseline, HP at level 1.
- Review step shows complete summary → “Create Character” writes to context.

3. Character Sheet + Play Area

- Display core stats (AC, HP, level, proficiency, abilities).
- Actions hotbar with simple actions (ability checks, simple weapon attacks).
- Tabs present and interactive; state shared with builder output.

4. Dice + Roll Log

- d20 ability checks with advantage/disadvantage toggle.
- Damage roll support for simple weapon (e.g., 1d8/1d6 + mod).
- Persistent session roll log with timestamps and labels.

5. Notes Book

- Two‑page layout with page navigation and page numbers.
- Lined textarea styling, content persists locally.
- Basic index list with page labels.

6. Styling & Accessibility

- Use tokens from `globals.css` for surfaces/fg.
- Keyboard focus states for interactive elements.
- Color contrast AA for text and key UI.

7. Packaging & Docs

- Updated README with features, scripts, structure.
- CONTRIBUTING and ARCHITECTURE docs (added).
- GitHub setup script and initial push (done).

### Out‑of‑Scope for MVP

- Leveling beyond level 1.
- Spell management, conditions, complex features.
- Multi‑character dashboard.

---

## Phase 2: Quality + Depth

8. Expanded Builder Depth

- Basic class features/spellcasting scaffolding for a subset (e.g., Fighter, Wizard).
- Background features and equipment kits.

9. Inventory & Equipment Polish

- Equip/unequip flow affects actions and AC.
- Encumbrance (lightweight) optional toggle.

10. More Actions and Checks

- Saves, skill proficiencies, initiative, passive perception.
- Custom actions (user‑defined with dice formulas).

11. Export/Share

- Export to shareable JSON; basic printable view.

12. Testing & Performance

- Unit tests for rules/utils (dice, modifiers, derived stats).
- Simple component tests for builder flow.

---

## Phase 3: Persistence & Collaboration (Optional)

13. Persistence backend (optional)

- API for character CRUD; auth optional.
- Sync notes and roll history per character.

14. Team Collaboration (optional)

- Invite collaborator to a character; view‑only or edit.

---

## Work Breakdown (Initial Tasks)

- Data Model

  - Finalize `Character` interface (src/lib/types/Character.ts) [MVP]
  - Add import/export helpers [MVP]

- Builder

  - Wire ability score modes: standard array + point buy [MVP]
  - Derive stats on review (AC/HP/Proficiency) [MVP]
  - Persist created character to context + localStorage [MVP]

- Sheet/Play

  - Show stat card block (AC/Prof/HP/Level) [MVP]
  - Hotbar actions for ability checks + weapon attacks [MVP]
  - Advantage/disadvantage toggle [MVP]

- Dice/Log

  - Ensure roll formulas and labels are consistent [MVP]
  - Persist log in memory for the session [MVP]

- Notes Book

  - Index, page labels, content persistence [MVP]

- Styling/Accessibility

  - Focus states, hover clarity, min contrast [MVP]

- Docs/Release
  - README/CONTRIBUTING/ARCHITECTURE completed (done)
  - GitHub repo and push (pending push)

---

## Success Metrics

- Create → Play in < 2 minutes for a new user.
- 0 critical console errors in a typical session.
- Lighthouse performance > 90 on desktop for core screens.
- TypeScript build clean; ESLint errors = 0 on PRs.

## Milestones & Timeline (suggested)

- Week 1: MVP Builder + Model + Sheet basics
- Week 2: Dice/Log + Notes Book + Styling/Accessibility polish
- Week 3: Stabilization, tests for rules/utils, printable view
