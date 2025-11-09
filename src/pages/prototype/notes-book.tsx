// src/pages/prototype/notes-book.tsx

import React, { useEffect } from "react";
import type { NextPage } from "next";
import NotesBook from "@/lib/components/NotesBook";
import { useCharacter } from "@/lib/context/CharacterContext";
import type { Character } from "@/lib/types/Character";

const mockCharacter: Character = {
  id: "mock-notes-char",
  name: "Notebook Tester",
  className: "Fighter",
  raceName: "Human",
  level: 1,
  proficiencyBonus: 2,
  maxHp: 12,
  currentHp: 12,
  armorClass: 15,
  abilities: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
  skills: {},
  savingThrows: {
    STR: { proficient: false },
    DEX: { proficient: false },
    CON: { proficient: false },
    INT: { proficient: false },
    WIS: { proficient: false },
    CHA: { proficient: false },
  },
  actions: [],
  inventory: [],
  notes: ["", "", "", ""],
  notesTitles: ["", ""],
};

const NotesBookPrototypePage: NextPage = () => {
  const { character, setCharacter } = useCharacter();

  useEffect(() => {
    if (!character) {
      setCharacter(mockCharacter);
    }
  }, [character, setCharacter]);

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <div className="w-full p-4 flex-1 min-h-0">
        <NotesBook />
      </div>
    </main>
  );
};

export default NotesBookPrototypePage;

