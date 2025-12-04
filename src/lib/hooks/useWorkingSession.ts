import { useRouter } from "next/router";
import { useCallback, useMemo } from "react";

/**
 * Working session state that tracks the current DM context.
 * All values are optional - pages can read/write what they need.
 */
export interface WorkingSession {
  campaignId?: string;
  sessionId?: string;
  sceneId?: string;
  encounterId?: string;
}

/**
 * Hook for managing the "working session" state via URL query parameters.
 * Uses shallow routing so back/forward buttons restore previous state
 * without full page reloads.
 *
 * @example
 * ```tsx
 * const { workingSession, setWorkingSession, clearWorkingSession } = useWorkingSession();
 *
 * // Read current state
 * const { campaignId, sessionId } = workingSession;
 *
 * // Update state (merges with existing)
 * setWorkingSession({ sessionId: "session-123" });
 *
 * // Clear specific keys
 * setWorkingSession({ sceneId: undefined, encounterId: undefined });
 *
 * // Clear all working session state
 * clearWorkingSession();
 * ```
 */
export function useWorkingSession() {
  const router = useRouter();

  const workingSession: WorkingSession = useMemo(() => {
    const query = router.query;
    return {
      campaignId: typeof query.campaignId === "string" ? query.campaignId : undefined,
      sessionId: typeof query.sessionId === "string" ? query.sessionId : undefined,
      sceneId: typeof query.sceneId === "string" ? query.sceneId : undefined,
      encounterId: typeof query.encounterId === "string" ? query.encounterId : undefined,
    };
  }, [router.query]);

  /**
   * Update the working session state. Merges provided values with existing state.
   * Pass undefined for a key to remove it from the URL.
   */
  const setWorkingSession = useCallback(
    (partial: Partial<WorkingSession>) => {
      const newQuery = { ...router.query };

      // Merge in new values
      for (const [key, value] of Object.entries(partial)) {
        if (value === undefined) {
          delete newQuery[key];
        } else {
          newQuery[key] = value;
        }
      }

      router.replace(
        {
          pathname: router.pathname,
          query: newQuery,
        },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  /**
   * Clear all working session parameters from the URL.
   */
  const clearWorkingSession = useCallback(() => {
    const newQuery = { ...router.query };
    delete newQuery.campaignId;
    delete newQuery.sessionId;
    delete newQuery.sceneId;
    delete newQuery.encounterId;

    router.replace(
      {
        pathname: router.pathname,
        query: newQuery,
      },
      undefined,
      { shallow: true }
    );
  }, [router]);

  /**
   * Build a URL with the current working session state preserved.
   * Use this for navigation links that should maintain context.
   */
  const buildUrl = useCallback(
    (pathname: string, additionalQuery?: Record<string, string | undefined>) => {
      const query: Record<string, string> = {};

      // Preserve working session params
      if (workingSession.campaignId) query.campaignId = workingSession.campaignId;
      if (workingSession.sessionId) query.sessionId = workingSession.sessionId;
      if (workingSession.sceneId) query.sceneId = workingSession.sceneId;
      if (workingSession.encounterId) query.encounterId = workingSession.encounterId;

      // Add any additional query params
      if (additionalQuery) {
        for (const [key, value] of Object.entries(additionalQuery)) {
          if (value !== undefined) {
            query[key] = value;
          }
        }
      }

      const queryString = new URLSearchParams(query).toString();
      return queryString ? `${pathname}?${queryString}` : pathname;
    },
    [workingSession]
  );

  return {
    workingSession,
    setWorkingSession,
    clearWorkingSession,
    buildUrl,
  };
}

export default useWorkingSession;
