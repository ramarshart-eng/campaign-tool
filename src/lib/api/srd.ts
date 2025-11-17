/**
 * D&D 5e SRD API Client
 * API Documentation: https://www.dnd5eapi.co/docs/
 */

import type { SRDBackground, SRDClass, SRDRace, SRDSpell } from "@/lib/types/SRD";

const SRD_API_BASE = "https://www.dnd5eapi.co/api";

export class SRDApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "SRDApiError";
  }
}

/**
 * Generic fetch wrapper for SRD API
 */
async function fetchSRD<T>(endpoint: string): Promise<T> {
  const url = `${SRD_API_BASE}${endpoint}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new SRDApiError(
        `SRD API request failed: ${response.statusText}`,
        response.status
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof SRDApiError) {
      throw error;
    }
    throw new SRDApiError(
      `Failed to fetch from SRD API: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get list of all races
 */
export async function getRaces() {
  return fetchSRD<{ count: number; results: Array<{ index: string; name: string; url: string }> }>(
    "/races"
  );
}

/**
 * Get detailed information about a specific race
 */
export async function getRace(index: string) {
  return fetchSRD<SRDRace>(`/races/${index}`);
}

/**
 * Get list of all classes
 */
export async function getClasses() {
  return fetchSRD<{ count: number; results: Array<{ index: string; name: string; url: string }> }>(
    "/classes"
  );
}

/**
 * Get detailed information about a specific class
 */
export async function getClass(index: string) {
  return fetchSRD<SRDClass>(`/classes/${index}`);
}

/**
 * Get list of all backgrounds
 */
export async function getBackgrounds() {
  return fetchSRD<{ count: number; results: Array<{ index: string; name: string; url: string }> }>(
    "/backgrounds"
  );
}

/**
 * Get detailed information about a specific background
 */
export async function getBackground(index: string) {
  return fetchSRD<SRDBackground>(`/backgrounds/${index}`);
}

/**
 * Get list of all skills
 */
export async function getSkills() {
  return fetchSRD<{ count: number; results: Array<{ index: string; name: string; url: string }> }>(
    "/skills"
  );
}

/**
 * Get list of all ability scores
 */
export async function getAbilityScores() {
  return fetchSRD<{ count: number; results: Array<{ index: string; name: string; url: string }> }>(
    "/ability-scores"
  );
}

/**
 * Get starting equipment for a class
 */
export async function getStartingEquipment(classIndex: string) {
  return fetchSRD<Record<string, unknown>>(`/classes/${classIndex}/starting-equipment`);
}

/**
 * Get proficiencies for a class
 */
export async function getProficiencies(classIndex: string) {
  return fetchSRD<Record<string, unknown>>(`/classes/${classIndex}/proficiencies`);
}

/**
 * Get list of all spells
 */
export async function getSpells() {
  return fetchSRD<{ count: number; results: Array<{ index: string; name: string; url: string; level: number }> }>(
    "/spells"
  );
}

/**
 * Get detailed information about a specific spell
 */
export async function getSpell(index: string) {
  return fetchSRD<SRDSpell>(`/spells/${index}`);
}

/**
 * Get spells available to a specific class
 */
export async function getClassSpells(classIndex: string) {
  return fetchSRD<{ count: number; results: Array<{ index: string; name: string; url: string; level: number }> }>(
    `/classes/${classIndex}/spells`
  );
}
