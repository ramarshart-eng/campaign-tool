DM Tooling Roadmap (DM-Side Only)
=================================

High-Level Goals
----------------

- Allow a DM to prep and run a full campaign entirely within this tool:
  - Capture rich notes with DM vs player visibility.
  - Plan campaigns, arcs, sessions, and scenes.
  - Design and run encounters, leveraging SRD monsters.
  - Use a battle-map maker for tactical encounters and spatial context.
  - Navigate everything from a unified DM Play Screen and Hub.
- Keep interfaces cohesive and predictable (navigation, layout, styles, forms).


1. Notes & Rich Editor
----------------------

### 1.1 Block Visibility & Player View

**Goal:** Select blocks in a note and mark them Player / DM only / per-player;
those flags must round-trip into `NoteDoc` and drive what appears in the Player
View.

- Toolbar shows current block visibility pill and buttons for “Player”, “DM
  only”, and optionally “Per-player”.
- Applying visibility to a selection updates all affected top-level blocks in
  the Lexical state and persists to `NoteDoc.visibility`.
- `NoteDocRenderer` behavior:
  - `mode="dm"` shows all blocks; optional DM-only highlighting when enabled.
  - `mode="player"` hides `dmOnly` blocks and any per-player content until we
    support per-player identities.
- Player Notes page filters notes to those with at least one player-visible
  block.

Acceptance:

- Marking a block “DM only” persists across reloads and is never shown on
  player pages.
- “Highlight DM blocks” in the editor visually distinguishes DM-only segments.

### 1.2 Entity Linking in Notes

**Goal:** Link entities (NPCs, locations, encounters, factions, maps, SRD
monsters) inside notes and make those links usable.

- Entity insertion bar:
  - Dropdown of existing entities from `DmContext`.
  - Buttons to create new NPCs/locations inline and insert a chip.
- Selecting an entity inserts an entity-link node/chip at the cursor.
- Rendering:
  - Chips render with kind + name.
  - Clicking a chip navigates to the appropriate DM page with that entity
    preselected (roster, encounters, maps, SRD reference, etc.).

Data alignment:

- `notes.EntityRef` and `dm.DmEntity` kinds stay in sync (including `map`,
  `faction`, and SRD monster references).
- A shared “entity chip” component encapsulates routing logic.

Acceptance:

- Chips created in the editor survive reloads and remain navigable.
- Creating an entity via the note editor immediately adds it to the roster and
  keeps the chip valid.

### 1.3 DM Notes Book UX

**Goal:** Provide a smooth experience for browsing and editing notes scoped to
campaigns and sessions, with sensible empty states and search.

- Scope tabs:
  - Campaign notes: `scopeType="campaign"` for current campaign.
  - Session notes: `scopeType="session"` for the selected session.
- Deep linking:
  - `?noteId=...` selects the appropriate note and, if it is session-scoped,
    selects the correct session.
- Search:
  - Filters by title and `plainText` body for notes in the current scope.
- Empty states:
  - No campaign notes: prompt to create a “Campaign Overview” note.
  - No sessions: guidance to create a session first.
  - No notes in scope: “No notes yet for this scope” with a primary “New note”
    button.

Acceptance:

- Switching scopes never leaves the active note in an invalid state.
- Deep links from Session Planner/Play to `dm-notes` reliably focus the right
  note.


2. Campaign Planner, Sessions & Scenes
--------------------------------------

### 2.1 Campaign Planner CRUD & Cascade Deletion

**Goal:** Manage campaigns, arcs, and sessions, with safe cascade deletes.

- Campaigns:
  - Create, rename, delete campaigns.
  - Deleting a campaign prompts whether to delete all sessions, notes,
    entities, encounters, beats, and maps for that campaign.
- Arcs:
  - Create/rename/recolor/reorder arcs.
  - Deleting an arc offers:
    - Delete associated sessions/beats/notes, or
    - Only remove the arc link.
- Sessions:
  - Create/rename sessions and assign them to arcs.
  - Deleting a session:
    - Prompts to either delete all children (scenes, notes, encounters, beats),
      or detach them while keeping data.

Data:

- `DmContext` provides typed helpers:
  - `deleteCampaign(campaignId, options)`
  - `deleteArc(arcId, options)`
  - `deleteSession(sessionId, options)`
- Notes/encounters/beats/maps referencing deleted items are either removed or
  safely de-scoped.

Acceptance:

- Deleting a session with “delete children” removes its scenes and notes, which
  disappear from both DM and player views.
- Player View never shows orphaned notes from deleted sessions or arcs.

### 2.2 Session Planner: Scenes & Beats

**Goal:** Provide a per-session scene list and beat tracker that connects
directly to Notes, Encounters, and Play.

- Scenes:
  - Scenes are notes with `scopeType="scene"` and `scopeId=sessionId`.
  - UI supports creating, renaming, deleting, and reordering scenes.
- Session note:
  - One primary “session note” per session for high-level prep.
- Beats:
  - Beats can reference arcs, sessions, scenes, encounters, and notes.
  - Beats have status: planned, in-progress, done.
  - Beats can be reordered within a session.

Integration with Play:

- “Run this scene” from Session Planner jumps to Play with that scene selected.
- Beat status changes made in Play reflect back into the planner.

Acceptance:

- Scenes reordering is stable and, if persisted, loads consistently.
- From Play, “Open in planner” navigates to the same session and highlights the
  current scene.


3. Encounters, SRD & Run Panel
------------------------------

### 3.1 Encounter Designer

**Goal:** Prepare encounters that combine SRD creatures and roster NPCs, with
useful metadata.

- Encounter form:
  - Fields: name, summary, environment, difficulty, tags.
  - Creature slots: each slot refers to an SRD monster and a count (plus XP).
  - NPC participants: choose NPCs from roster to include.
- Linking:
  - Encounters can link to sessions, scenes, and notes.
  - Linked encounters appear in notes and planner views for those scenes.

Data:

- `EncounterEntity.creatures: EncounterCreatureSlot[]` filled from SRD data.
- Utility functions compute XP budgets and suggested difficulty based on a
  party model (even if initially a simple heuristic).

Acceptance:

- Adding/removing SRD creatures updates XP totals and difficulty hints.
- Linked encounters for a scene appear in Notes Book and Session Planner with
  quick navigation to the encounter designer.

### 3.2 SRD Quick Reference (DM Play)

**Goal:** Provide a quick, in-Play lookup of SRD monsters and a way to add them
into encounters and run state.

- SRD panel in `/prototype/dm-play`:
  - Search by name/type/CR.
  - Simple CR filters (bands like 0–4, 5–10, 11+).
  - List with: name, CR, type, basic stats (HP, AC, speed).
  - Detail view with traits/actions for selected monster.
- Integration:
  - “Add to current encounter”:
    - If a run is active, add a new combatant.
    - If not, optionally add to a selected encounter or create a quick ad-hoc
      encounter and start it.

Data:

- SRD datasets provide both summary rows and detailed stat blocks.
- Helper functions map SRD monsters to `EncounterCreatureSlot` and
  `EncounterCombatant` structures.

Acceptance:

- Searching by partial name returns expected monsters.
- “Add to encounter” visibly updates the run panel with a new combatant row.

### 3.3 Run Panel Polish

**Goal:** Make running combat smooth and clear.

- Combatants:
  - Each combatant has its own row (no shared initiative for groups).
  - Columns: name, type (PC/monster/NPC/other), initiative, HP, controls.
- Initiative:
  - Sort button orders rows by initiative (desc) with tie-breaking by insertion
    order or name.
- Controls:
  - Buttons for damage/heal, toggle defeated, and edit initiative.
  - Current turn row is visually highlighted.
- Turn controls:
  - “Start encounter”, “Next turn”, “Next round”, “End encounter”.

Acceptance:

- Sorting by initiative updates the list predictably and persists across
  updates.
- Running through several rounds with many combatants remains readable and
  responsive.


4. Battle Maps & Map Maker
--------------------------

### 4.1 Map Entities

**Goal:** Treat maps as first-class campaign entities.

- DM Maps page lists maps for the current campaign with name, summary, and
  links to associated scenes/encounters/locations.
- Creating a map:
  - Fields: name, summary, type (battle/region), optional base image/texture.
  - Optional linking to locations, scenes, and encounters.

Acceptance:

- New maps appear in the DM Maps list and as linkable targets from scenes and
  encounters.

### 4.2 Battle Map Maker (Minimum Viable)

**Goal:** Provide a simple but useful battle-map editor for prep and live play,
with a path to a shared player-facing view later.

Feature set:

- Canvas & grid:
  - Pan/zoom with mouse + scroll; reset zoom button.
  - Toggle grid; configurable size/color/opacity; snap on/off per action.
  - Rulers/measuring tool with distance readout; optional diagonal mode.
- Drawing & areas:
  - Shape tools: rectangle, polygon, line templates (doors/walls), freehand
    annotation; fill + stroke color pickers; opacity slider.
  - Labels with font size/color and snap-to-center option.
  - Simple fog-of-war/hide: mask layer that can be painted/revealed in blocks.
- Tokens:
  - Add tokens from encounter combatants (pre-filled name/type/color/icon) or
    ad-hoc tokens; assign size (1x1, 2x2, etc.) and facing arrow.
  - Move/drag with snap; HP/status dots/conditions as small badges.
  - Duplicate, delete, lock (prevent accidental moves), and set visibility
    (DM-only vs player-visible).
- Layers & organization:
  - Layer ordering: background image, drawings/areas, fog, tokens, labels UI.
  - Quick "select layer" control; lock/hide layers; clear layer actions
    gated with confirmation.
- Assets & import:
  - Optional background upload (image or texture) with fit/size controls.
  - Token avatars can use existing NPC/monster art when available; fallback
    initials/color chips.
- Skinning-ready:
  - Use replaceable PNG assets for UI chrome (tool icons, cursors), grid/texture
    overlays, and token bases; single source of truth in an asset manifest with
    stable keys.
  - Layout/padding avoids baked-in art dimensions so future PNG swaps do not
    break hitboxes; support @1x/@2x variants.
  - Reserve slots for frame/nine-slice styling on panels/toolbars without
    coupling to logic.
  - Asset manifest (e.g., `public/assets/battlemap/manifest.json`) enumerates
    tool icons (select/move/draw/measure/grid/tokens/layers), cursors, grid
    textures, token bases/frames, and panel frames; each entry lists 1x/2x
    PNGs and recommended display size.
  - Default placeholder set lives at `public/assets/battlemap/default/` and can
    be swapped by updating manifest paths only; nine-slice panel frames declare
    inset sizes to prevent layout changes when art changes.
  - Manifest example:
    ```
    {
      "icons": {
        "select": {"1x": "/assets/battlemap/default/select.png", "2x": "...", "size": [24,24]},
        "draw.rectangle": {"1x": "...", "2x": "...", "size": [24,24]},
        "pan": {"1x": "...", "2x": "...", "size": [24,24]}
      },
      "cursors": {"draw": "...", "pan": "..."},
      "grid": {"default": {"1x": "...", "2x": "...", "size": [512,512]}},
      "tokens": {
        "base.pc": {"1x": "...", "2x": "...", "size": [64,64]},
        "frame.default": {"1x": "...", "2x": "...", "size": [80,80]}
      },
      "panels": {
        "toolbar": {"image": "...", "nineSlice": {"left":8,"right":8,"top":8,"bottom":8}}
      }
    }
    ```
  - Loader contracts: `battlemapAssetManifest` and helpers (`getResolvedBattlemapIcon`,
    `getResolvedBattlemapGrid`, `getResolvedBattlemapToken`, `getBattlemapPanel`,
    `validateBattlemapManifest`) supply src/srcSet/size and catch missing assets early.
- Integration:
  - From encounters and Play, "Open battle map" opens the linked map and
    pre-seeds tokens for current combatants.
  - Save map state to the map entity (grid settings, drawings, fog, tokens,
    camera position); load is deterministic.
  - Export static image (PNG) for quick sharing; copy link back to Play.
- UX/controls:
  - Keyboard shortcuts for select (V), move (M), draw (D), undo/redo,
    zoom in/out, and toggle grid.
  - Undo/redo stack with 20+ steps; autosave on significant actions.
  - Responsive layout: minimum viable on tablet; desktop-first controls stay
    legible at common resolutions.
- Data model guardrails:
  - Map schema stores `layers`, `tokens`, `visibility`, `links` to encounters
    and scenes; token IDs stable for updates.
  - Validation ensures missing token art gracefully degrades; references to
    deleted encounters/roster entries are detached with a warning.

Acceptance:

- DM can create a map, draw walls/areas, drop linked tokens, toggle grid snap,
  and save/restore the exact state (including zoom/fog) across reloads.
- Opening the map from Play with an encounter attaches combatants as tokens
  without extra manual setup.
- Exporting a static image reflects the current visible state (grid obeys
  toggle; hidden tokens stay hidden).
- Undo/redo reliably reverts recent edits (draw, move token, toggle fog) and
  does not lose encounter-linked token metadata.
- Swapping PNG assets (tool icons, textures, token frames) via the manifest does
  not affect interaction fidelity (hitboxes, snap, visibility) or saved maps.


### 4.3 Map Maker Brushes & Tileset Parameters

**Goal:** Define a brush parameter model (starting with rectangle) that maps
tileset pieces, rotations, and randomness into consistent placement.

- Brush schema:
  - `brushId`, `label`, `toolType` (rectangle/line/fill/stamp), `tilesetId`,
    optional `paletteVariant`.
  - Shared controls: `snap` (grid size/alignment), `randomness` (seed, jitter),
    `rotationMode` (fixed/auto/random/weighted), `flipMode` (allow H/V).
  - Layering: `layer`/`zIndex`, `overdraw` (allow spill past selection), and
    `previewStyle` (outline color/fill opacity).
- Tile specs (reusable shape parts): `{ tileId, rotation?, flip?, weight? }`
  with per-edge overrides and fallbacks when a tile is missing.
- Rectangle brush config:
  - `cornerTiles`: { tl, tr, bl, br } tile specs.
  - `borderTiles`: { top, bottom, left, right } tile specs, with optional
    `autoRotate` for vertical edges.
  - `fillTiles`: list of tile specs (weights optional) for interior.
  - `edgeMode`: solid/hollow/dashed pattern and `thickness` (in tiles).
  - Geometry guards: `padding` (inset/outset per side), `minSize`/`maxSize`,
    `autoJoin` to merge with adjacent strokes from the same brush.
- Validation & UX:
  - Preview shows corners/edges/fill with the configured tiles/rotations.
  - Invalid or missing tile refs flag warnings and fall back to defaults.
  - Brush definitions live alongside the tileset manifest and are hot-reloadable
    in the editor.
  - Provide a sample config (e.g. `/public/assets/battlemap/Tilesets/Dungeon/brushes.sample.json`)
    with floor and wall rectangle brushes to exercise corners, borders, and fills.
- Data shape (draft, TypeScript):
  ```ts
  type TileSpec = { tileId: string; rotation?: 0|90|180|270; flip?: 'h'|'v'; weight?: number };
  type EdgeSpec = TileSpec & { autoRotate?: boolean };
  type RectangleBrush = {
    brushId: string;
    label: string;
    toolType: 'rectangle';
    tilesetId: string;
    paletteVariant?: string;
    snap?: { size: number; align: 'cell'|'edge' };
    randomness?: { seed?: string; jitter?: number };
    rotationMode?: 'fixed'|'auto'|'random'|'weighted';
    flipMode?: 'none'|'h'|'v'|'both';
    layer?: string;
    zIndex?: number;
    overdraw?: boolean;
    previewStyle?: { stroke: string; fill: string; opacity?: number };
    cornerTiles: { tl: TileSpec; tr: TileSpec; bl: TileSpec; br: TileSpec };
    borderTiles: { top: EdgeSpec; bottom: EdgeSpec; left: EdgeSpec; right: EdgeSpec };
    fillTiles: TileSpec[];
    edgeMode?: { kind: 'solid'|'hollow'|'dashed'; pattern?: number[]; thickness?: number };
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
    minSize?: { w: number; h: number };
    maxSize?: { w: number; h: number };
    autoJoin?: boolean;
  };
  ```
  - Stored next to tileset manifest (`/public/assets/battlemap/tilesets/<id>/brushes.json`).
  - Editor sidebar loads brushes via manifest and hot-reloads when file changes.

Acceptance:

- Rectangle brush draws with configured corner/border/fill tiles and respects
  rotation/flip/randomness settings.
- Changing brush parameters updates the preview and the next stroke without
  needing a reload.
- Missing/misaligned tiles surface a clear warning and use defined fallbacks
  rather than breaking the stroke.


5. DM Play Screen Workflow
--------------------------

**Goal:** Make `/prototype/dm-play` the one-stop DM command center.

- Layout:
  - Left: session and scene selection, beats list.
  - Middle: scene note (RichNotesEditor/NoteDocRenderer), possibly session note.
  - Right: encounters/run panel, SRD quick reference, map quick access.
- Behavior:
  - Current session/scene is clearly marked and controls what content appears
    in the central and right columns.
  - Beats for the current session/scene are visible and their statuses can be
    changed directly in Play.
  - Linked encounters and maps are accessible from Play with one click.

Acceptance:

- Flow from Hub → Session Planner → Play maintains the same current session and
  (when applicable) scene.
- From Play, DM can reach notes, planner, encounters, and maps for the current
  session/scene without losing context.


6. Roster, NPCs & Factions
--------------------------

**Goal:** Maintain a clear roster with useful filters and cross-links.

- NPCs:
  - Fields: sex, importance, visibility, role, SRD link, faction, location.
  - Filters: by importance, faction, location.
- Factions:
  - Fields: scope, alignment, base location, attitude, visibility.
- Links:
  - NPC/faction chips in notes, planner, encounters, and Play navigate back to
    the roster entity.

Acceptance:

- Updating an NPC or faction updates all chips and references where it appears.
- Filters make it easy to focus on major NPCs and key factions.


7. Navigation, Layout & Style Cleanup (DM)
------------------------------------------

**Goal:** All DM pages feel cohesive and consistent.

- Navigation:
  - `DmNav` visible on all DM pages with correct active state.
  - Player View link points to the player notes page and works reliably.
- Layout:
  - Remove old center-column constraints; DM pages use full width with shared
    paddings.
  - Multi-column layouts (Play, planner, encounters, maps, roster) behave
    consistently.
- Styles:
  - Shared form controls: `.field-label`, `.field-input`, `.field-select`,
    `.field-textarea`.
  - Shared button styles: `.btn-primary` (and any secondary variants).
  - Lists and panels (notes sidebar, beats, encounters, roster) share a common
    style vocabulary.
  - Modals use shared classes and center-screen presentation.

Acceptance:

- No DM page uses ad-hoc input/button styles that clash with others.
- Visual alignment between Notes, Planner, Play, Encounters, Roster, Maps is
  clear.


8. Technical Cleanup & Guardrails
---------------------------------

**Goal:** Keep DM tooling maintainable and safe to extend.

- Types & context:
  - `EntityKind` unions in notes/dm types remain aligned.
  - `DmContext` exposes well-typed helpers for all core operations (create,
    update, delete, run, link).
- Lint & tests:
  - Resolve or quarantine legacy `BookShell` ref issues so eslint can be run
    confidently.
  - Keep `npm run lint` clean for new/modified DM files.
  - Add focused tests for critical helpers (encounter state transitions,
    cascade deletions) if test infrastructure exists.
