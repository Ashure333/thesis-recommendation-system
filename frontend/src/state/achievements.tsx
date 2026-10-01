import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import {
  ACHIEVEMENTS,
  HUNT_TOTAL,
  type AchievementProgress,
} from "../data/achievements";

/* ============================================================
   ACHIEVEMENTS STATE
   Tracks which achievements are unlocked plus the counters they
   depend on (pet clicks, asks, drags), persists everything in
   localStorage, and broadcasts a window event on each new unlock
   so the pet can celebrate live, wherever it is mounted.
   ============================================================ */

const STORAGE_KEY = "paperrec_achievements";

/** Dispatched with { ids: string[] } when one or more achievements unlock. */
export const ACHIEVEMENT_UNLOCKED_EVENT = "paperrec:achievement-unlocked";

type CounterKey = "clicks" | "asks" | "drags";

interface AchievementState {
  unlocked: string[];
  progress: AchievementProgress;
}

const EMPTY_PROGRESS: AchievementProgress = {
  seen: 0,
  treasures: 0,
  treasureTotal: HUNT_TOTAL,
  huntComplete: false,
  clicks: 0,
  asks: 0,
  drags: 0,
};

interface AchievementsContextValue {
  unlocked: string[];
  progress: AchievementProgress;
  /** Merge new progress (e.g. seen tips, treasures) and re-check. */
  updateProgress: (patch: Partial<AchievementProgress>) => void;
  /** Increment a counter and re-check. */
  bump: (key: CounterKey) => void;
  reset: () => void;
}

const AchievementsContext = createContext<AchievementsContextValue>({
  unlocked: [],
  progress: EMPTY_PROGRESS,
  updateProgress: () => {},
  bump: () => {},
  reset: () => {},
});

function readState(): AchievementState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (parsed && typeof parsed === "object") {
      const unlocked = Array.isArray(parsed.unlocked)
        ? parsed.unlocked.filter(
            (value: unknown) =>
              typeof value === "string" &&
              ACHIEVEMENTS.some((item) => item.id === value),
          )
        : [];

      const rawProgress =
        parsed.progress && typeof parsed.progress === "object"
          ? parsed.progress
          : {};

      const numberFrom = (value: unknown, fallback: number) =>
        typeof value === "number" && Number.isFinite(value)
          ? value
          : fallback;

      return {
        unlocked,
        progress: {
          seen: numberFrom(rawProgress.seen, 0),
          treasures: numberFrom(rawProgress.treasures, 0),
          treasureTotal: numberFrom(rawProgress.treasureTotal, HUNT_TOTAL),
          huntComplete:
            typeof rawProgress.huntComplete === "boolean"
              ? rawProgress.huntComplete
              : false,
          clicks: numberFrom(rawProgress.clicks, 0),
          asks: numberFrom(rawProgress.asks, 0),
          drags: numberFrom(rawProgress.drags, 0),
        },
      };
    }
  } catch {
    // best-effort
  }

  return { unlocked: [], progress: EMPTY_PROGRESS };
}

function writeState(state: AchievementState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort
  }
}

/** Merge progress, unlock anything newly satisfied, persist, emit. */
function computeNext(
  state: AchievementState,
  patch: Partial<AchievementProgress>,
): AchievementState {
  const progress = { ...state.progress, ...patch };
  const unlocked = [...state.unlocked];
  const added: string[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (!unlocked.includes(achievement.id) && achievement.check(progress)) {
      unlocked.push(achievement.id);
      added.push(achievement.id);
    }
  }

  const next: AchievementState = { unlocked, progress };
  writeState(next);

  if (added.length > 0) {
    window.dispatchEvent(
      new CustomEvent(ACHIEVEMENT_UNLOCKED_EVENT, { detail: { ids: added } }),
    );
  }

  return next;
}

export function AchievementsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AchievementState>(readState);

  const updateProgress = useCallback((patch: Partial<AchievementProgress>) => {
    setState((current) => computeNext(current, patch));
  }, []);

  const bump = useCallback((key: CounterKey) => {
    setState((current) =>
      computeNext(current, {
        [key]: (current.progress[key] ?? 0) + 1,
      }),
    );
  }, []);

  const reset = useCallback(() => {
    setState({ unlocked: [], progress: EMPTY_PROGRESS });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best-effort
    }
  }, []);

  return (
    <AchievementsContext.Provider
      value={{
        unlocked: state.unlocked,
        progress: state.progress,
        updateProgress,
        bump,
        reset,
      }}
    >
      {children}
    </AchievementsContext.Provider>
  );
}

export function useAchievements(): AchievementsContextValue {
  return useContext(AchievementsContext);
}