/**
 * Character Creation Page
 * Entry point for the character builder wizard
 */

import React from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import CharacterBuilder from "@/lib/components/CharacterBuilder/CharacterBuilder";
import type { Character } from "@/lib/types/Character";
import { useCharacter } from "@/lib/context/CharacterContext";

const CreateCharacterPage: NextPage = () => {
  const router = useRouter();
  const { setCharacter } = useCharacter();

  const handleComplete = (character: Character) => {
    console.log("Character created:", character);

    // Save character to context
    setCharacter(character);

    router.push("/prototype/character");
    router.push("/prototype/character");
  };

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel character creation?")) {
      router.push("/");
    }
  };

  return <CharacterBuilder onComplete={handleComplete} onCancel={handleCancel} />;
};

export default CreateCharacterPage;
