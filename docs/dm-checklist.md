DM Tooling Checklist (DM-Side)
==============================

Use this as the actionable list for implementation. Items are grouped to match
`dm-roadmap.md`. Mark items as completed as work lands.


1. Notes & Rich Editor
----------------------

- [x] 1.1 Block visibility: Lexical ��' NoteDoc.visibility mapping.
- [x] 1.1 Block visibility: NoteDocRenderer hides dmOnly in player mode.
- [x] 1.1 Block visibility: Player Notes page filters notes with only DM blocks.
- [x] 1.1 Block visibility: �?oHighlight DM blocks�?? visual treatment in editor.

- [x] 1.2 Entity linking: unify `EntityKind` between notes and DM types.
- [x] 1.2 Entity linking: confirm entity insertion bar uses `DmContext.entities`.
- [x] 1.2 Entity linking: chips created in editor render with labels and kinds.
- [x] 1.2 Entity linking: clicking chips routes to roster/encounters/maps/SRD.
- [x] 1.2 Entity linking: inline entity creation (NPC/location) from editor.

- [x] 1.3 Notes Book: ensure campaign/session scope filters work correctly.
- [x] 1.3 Notes Book: deep-link `?noteId=...` handling (including sessions).
- [x] 1.3 Notes Book: search uses title and `plainText` body.
- [x] 1.3 Notes Book: empty state for no campaign notes (prompt overview).
- [x] 1.3 Notes Book: empty state for no sessions / session notes.


2. Campaign Planner, Sessions & Scenes
--------------------------------------

- [x] 2.1 Campaign planner: campaign CRUD with confirmation on delete.
- [x] 2.1 Campaign planner: arc CRUD with optional cascade delete behavior.
- [x] 2.1 Campaign planner: session CRUD with cascade delete / detach options.
- [x] 2.1 Campaign planner: implement `DmContext` helpers for cascades.
- [x] 2.1 Campaign planner: ensure deleted sessions remove/hide their notes and
      scenes from all views (including player).

- [x] 2.2 Session planner: represent scenes as `scopeType="scene"` notes.
- [x] 2.2 Session planner: scene create/rename/delete UI.
- [x] 2.2 Session planner: scene reordering.
- [x] 2.2 Session planner: one primary session note per session.
- [x] 2.2 Session planner: beats with arc/session/scene/encounter/note links.
- [x] 2.2 Session planner: beat status and reordering UI.
- [x] 2.2 Session planner: �?oRun this scene�?? button ��' DM Play with scene
      selected.


3. Encounters, SRD & Run Panel
------------------------------

- [x] 3.1 Encounter designer: form for name/summary/environment/difficulty/tags.
- [x] 3.1 Encounter designer: SRD creature slots with XP/count.
- [x] 3.1 Encounter designer: NPC participant selection from roster.
- [x] 3.1 Encounter designer: link encounters to sessions/scenes/notes.
- [x] 3.1 Encounter designer: show linked encounters in Notes Book and Session
      Planner.
- [x] 3.1 Encounter designer: XP budget and difficulty hint calculation helpers.

- [x] 3.2 SRD quick reference: search field and filters (name/type/CR).
- [x] 3.2 SRD quick reference: list view with summary stats.
- [x] 3.2 SRD quick reference: detail view with traits/actions.
 - [x] 3.2 SRD quick reference: �?oAdd to current encounter�?? integration.

- [x] 3.3 Run panel: individual combatant rows (no grouped initiative).
- [x] 3.3 Run panel: initiative sort button with deterministic tie-breaking.
- [x] 3.3 Run panel: damage/heal and defeated/restore controls.
- [x] 3.3 Run panel: current turn highlighting.
- [x] 3.3 Run panel: start/next turn/next round/end encounter controls.
- [x] 3.3 Run panel: ensure layout handles large encounter lists gracefully.


4. Battle Maps & Map Maker
--------------------------

- [ ] 4.1 Maps: map entity CRUD in DM Maps page.
- [ ] 4.1 Maps: link maps to locations/scenes/encounters.
- [ ] 4.1 Maps: show linked maps in Session Planner and Notes Book.

- [ ] 4.2 Battle map maker: basic grid canvas with pan/zoom.
- [ ] 4.2 Battle map maker: tools for drawing simple rooms/areas.
- [ ] 4.2 Battle map maker: placing and moving tokens (PCs/monsters/NPCs).
- [ ] 4.2 Battle map maker: DM vs player visibility flags on tokens/areas.
- [ ] 4.2 Battle map maker: integration to open map from encounters and Play.
- [x] 4.2 Battle map maker: define asset manifest (paths/keys for tool icons,
      cursors, grid textures, token bases/frames, panel frames) with @1x/@2x.
- [x] 4.2 Battle map maker: ship placeholder PNG set and nine-slice inset
      definitions; swapping art must not change hitboxes or save/load fidelity.


5. DM Play Screen Workflow
--------------------------

- [x] 5.1 Layout: three-column Play layout (session/scenes, notes/beats,
      encounters/SRD/maps).
- [x] 5.1 Layout: ensure full-width usage (no center column constraints).
- [x] 5.2 Current session/scene selection drives notes, beats, and encounters.
- [ ] 5.2 Beats: status changes and ordering usable from Play.
- [ ] 5.3 Navigation: from Play, quick links to Notes Book, Session Planner,
      Encounters, Maps for the current session/scene.
- [ ] 5.3 Navigation: returning from those tools preserves the current context.


6. Roster, NPCs & Factions
--------------------------

- [x] 6.1 Roster: ensure NPC fields (sex, importance, visibility, role, SRD
      link, faction, location) are exposed and editable.
- [x] 6.1 Roster: filters for importance, faction, location.
- [x] 6.2 Factions: scope, alignment, base location, attitude, visibility
      fields and UI.
- [x] 6.3 Links: NPC/faction chips in notes/planner/encounters/play route back
      to the roster.


7. Navigation, Layout & Styles (DM)
-----------------------------------

- [x] 7.1 Navigation: `DmNav` included with correct active state on all DM
      prototype pages.
- [x] 7.1 Navigation: Player View link pointing to player notes and working.
- [x] 7.2 Layout: remove center-column constraints; ensure full-width layouts.
- [x] 7.2 Layout: consistent padding/margins across DM pages.
- [x] 7.3 Styles: consolidate DM-side forms onto `.field-*` classes.
- [x] 7.3 Styles: unify button styles (`.btn-primary`, etc.).
- [x] 7.3 Styles: consistent list/panel patterns for sidebars and tables.
- [x] 7.3 Styles: consistent modal styling for confirmations and forms.


8. Technical Cleanup & Guardrails
---------------------------------

- [x] 8.1 Types: keep `EntityKind` unions in notes and DM in sync.
- [ ] 8.1 Types: ensure `DmContext` public helpers cover all needed operations.
- [x] 8.2 Lint: resolve or quarantine `BookShell` ref warnings/errors.
- [ ] 8.2 Lint: keep `npm run lint` clean for new work.
- [ ] 8.3 Tests: add focused tests for encounter run state transitions.
- [ ] 8.3 Tests: add focused tests for cascade delete helpers.
