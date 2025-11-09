/**
 * Character Context - Global state management for characters
 */

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { Character } from "@/lib/types/Character";

interface CharacterContextValue {
  character: Character | null;
  setCharacter: (character: Character) => void;
  clearCharacter: () => void;
}

const CharacterContext = createContext<CharacterContextValue | undefined>(undefined);

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [character, setCharacterState] = useState<Character | null>(null);

  const setCharacter = (newCharacter: Character) => {
    setCharacterState(newCharacter);
    // Optionally save to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("currentCharacter", JSON.stringify(newCharacter));
    }
  };

  const clearCharacter = () => {
    setCharacterState(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("currentCharacter");
    }
  };

  // Load character from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("currentCharacter");
      if (saved) {
        try {
          setCharacterState(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load character from localStorage", e);
        }
      }
    }
  }, []);

  return (
    <CharacterContext.Provider value={{ character, setCharacter, clearCharacter }}>
      {children}
    </CharacterContext.Provider>
  );
}

export function useCharacter() {
  const context = useContext(CharacterContext);
  if (context === undefined) {
    throw new Error("useCharacter must be used within a CharacterProvider");
  }
  return context;
}
