// src/lib/rules/rollDice.ts

export type AdvantageState = "normal" | "adv" | "dis";

export interface RollResult {
  total: number;
  rolls: number[]; // d20s for now
  modifier: number;
  advState: AdvantageState;
  isCrit: boolean;
  isFumble: boolean;
  rawFormula: string;
}

/**
 * Very simple parser for formulas like "1d20 + 5" or "1d20+3".
 * We only care about one die and one flat modifier for Prototype 1.
 */
export function rollDice(
  formula: string,
  advState: AdvantageState
): RollResult {
  const trimmed = formula.replace(/\s+/g, "");
  const match = trimmed.match(/(\d+)d(\d+)([+\-]\d+)?/i);

  if (!match) {
    // Failsafe – shouldn't happen with our own formulas
    const roll = d(20);
    return {
      total: roll,
      rolls: [roll],
      modifier: 0,
      advState,
      isCrit: roll === 20,
      isFumble: roll === 1,
      rawFormula: formula,
    };
  }

  const [, , sidesStr, modStr] = match;
  const sides = Number(sidesStr);
  const modifier = modStr ? Number(modStr) : 0;

  const singleRoll = () => d(sides);

  let rolls: number[] = [];
  rolls = [singleRoll()];
  if (advState !== "normal") {
    rolls.push(singleRoll());
  }

  const chosen =
    advState === "adv"
      ? Math.max(...rolls)
      : advState === "dis"
      ? Math.min(...rolls)
      : rolls[0];

  const total = chosen + modifier;

  return {
    total,
    rolls,
    modifier,
    advState,
    isCrit: sides === 20 && chosen === 20,
    isFumble: sides === 20 && chosen === 1,
    rawFormula: formula,
  };
}

function d(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}
