import React from "react";
import type { ActionButton } from "@/lib/types/ActionButton";
import type { AdvantageState, RollResult } from "@/lib/rules/rollDice";
import { rollDice } from "@/lib/rules/rollDice";

interface RollButtonProps {
  action: ActionButton;
  advState: AdvantageState;
  onRoll: (result: RollResult, action: ActionButton) => void;
  variant?: "default" | "compact";
  className?: string;
}

/**
 * RollButton â€” inline version with modifier shown alongside label.
 * Example: "Perception +4"
 */
const RollButton: React.FC<RollButtonProps> = ({
  action,
  advState,
  onRoll,
  variant = "default",
  className = "",
}) => {
  const handleClick = () => {
    const result = rollDice(action.formula, advState);
    onRoll(result, action);
  };

  // Extract dice and modifier, hide modifier if it's zero
  const diceMatch = action.formula.match(/(\d+d\d+)(?:([+-]\d+))?/);
  const diceBase = diceMatch?.[1] ?? action.formula;
  const modifier = diceMatch?.[2];

  const diceText = modifier ? `${diceBase}${modifier}` : diceBase;
  const displayModifier = modifier || "";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`dice-btn ${variant === "compact" ? "dice-btn-compact" : ""} ${className}`}
      >
        <span className="btn-default">
          <span>{action.label}</span>
          {displayModifier && (
            <span className="">{displayModifier}</span>
          )}
        </span>
        <span className="btn-dice ">
          {diceText}
        </span>
      </button>
    </>
  );
};

export default RollButton;
