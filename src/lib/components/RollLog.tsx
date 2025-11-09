// src/components/RollLog.tsx

import React from "react";
import type { RollResult } from "@/lib/rules/rollDice";
import type { ActionButton } from "@/lib/types/ActionButton";

export interface LoggedRoll {
  id: string;
  result: RollResult;
  action: ActionButton;
}

interface RollLogProps {
  rolls: LoggedRoll[];
}

const RollLog: React.FC<RollLogProps> = ({ rolls }) => {
  if (rolls.length === 0) {
    return <p className="">No rolls yet.</p>;
  }

  return (
    <ul className="space-y-1 ">
      {[...rolls].reverse().map((entry) => {
        const { result, action } = entry;

        const [first, second] = result.rolls;

        return (
          <li key={entry.id} className="frame pad-2">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span>{action.label}</span>
                <div className="flex gap-x-2 items-center ">
                  <span>Roll:</span>
                  <span>
                    {result.advState === "normal" ? (
                      first
                    ) : (
                      <>
                        [{first}, {second}]
                      </>
                    )}
                  </span>
                  {(result.advState !== "normal" ||
                    result.isCrit ||
                    result.isFumble) && (
                    <span>
                      {result.advState === "adv" && "Advantage"}
                      {result.advState === "dis" && "Disadvantage"}
                      {result.isCrit && "Nat 20"}
                      {result.isFumble && "Nat 1"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-x-2">
                <span className=" self-center">
                  ({result.rawFormula.trim()})
                </span>
                <span
                  className={` ${
                    result.isCrit
                      ? "text-warning"
                      : result.isFumble
                      ? "text-danger"
                      : ""
                  }`}
                >
                  {result.total >= 0 ? "+" : ""}
                  {result.total}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default RollLog;
