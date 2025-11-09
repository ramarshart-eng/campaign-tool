// src/lib/types/ActionButton.ts

export type RollKind =
  | "attack"
  | "skill"
  | "save"
  | "initiative"
  | "spell"
  | "cantrip";

export interface ActionButton {
  id: string;
  label: string;
  kind: RollKind;
  /** Simple dice formula like "1d20 + 5" */
  formula: string;
  /** Whether advantage/disadvantage should be offered */
  advantageAllowed?: boolean;
}
