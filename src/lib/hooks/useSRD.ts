/**
 * React hooks for fetching D&D 5e SRD data
 */

import { useState, useEffect } from "react";
import {
  getRaces,
  getRace,
  getClasses,
  getClass,
  SRDApiError,
} from "@/lib/api/srd";
import type { SRDRace, SRDClass, APIReference } from "@/lib/types/SRD";
import { getAllBackgrounds, getBackgroundByIndex, type LocalBackground } from "@/lib/data/backgrounds";

interface UseSRDListResult<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
}

interface UseSRDDetailResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch list of all races
 */
export function useRaces(): UseSRDListResult<APIReference> {
  const [data, setData] = useState<APIReference[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        const result = await getRaces();
        if (mounted) {
          setData(result.results);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch details of a specific race
 */
export function useRace(index: string | null): UseSRDDetailResult<SRDRace> {
  const [data, setData] = useState<SRDRace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!index) {
      setData(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        const result = await getRace(index!);
        if (mounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, [index]);

  return { data, loading, error };
}

/**
 * Hook to fetch list of all classes
 */
export function useClasses(): UseSRDListResult<APIReference> {
  const [data, setData] = useState<APIReference[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        const result = await getClasses();
        if (mounted) {
          setData(result.results);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch details of a specific class
 */
export function useClass(index: string | null): UseSRDDetailResult<SRDClass> {
  const [data, setData] = useState<SRDClass | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!index) {
      setData(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        const result = await getClass(index!);
        if (mounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, [index]);

  return { data, loading, error };
}

/**
 * Hook to get list of all backgrounds (from local data)
 */
export function useBackgrounds(): UseSRDListResult<LocalBackground> {
  const [data, setData] = useState<LocalBackground[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate async for consistency with other hooks
    const timeout = setTimeout(() => {
      try {
        const backgrounds = getAllBackgrounds();
        setData(backgrounds);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, []);

  return { data, loading, error };
}

/**
 * Hook to get details of a specific background (from local data)
 */
export function useBackground(index: string | null): UseSRDDetailResult<LocalBackground> {
  const [data, setData] = useState<LocalBackground | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!index) {
      setData(null);
      setLoading(false);
      return;
    }

    // Simulate async for consistency with other hooks
    const timeout = setTimeout(() => {
      try {
        setLoading(true);
        const background = getBackgroundByIndex(index);
        if (background) {
          setData(background);
          setError(null);
        } else {
          setError(new Error(`Background not found: ${index}`));
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [index]);

  return { data, loading, error };
}
