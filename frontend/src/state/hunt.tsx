import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { HUNT_ITEMS } from "../data/hunt";

/* ============================================================
   SCAVENGER HUNT STATE
   Persists collected treasures in localStorage and broadcasts a
   window event on each new find so the pet can celebrate live,
   wherever it is mounted (auth + app layouts).
   ============================================================ */

const STORAGE_KEY = "paperrec_hunt_found";

/** Dispatched with { id } every time a new treasure is collected. */
export const HUNT_FOUND_EVENT = "paperrec:hunt-found";

interface HuntContextValue {
  found: string[];
  count: number;
  total: number;
  complete: boolean;
  collect: (id: string) => void;
  reset: () => void;
}

const HuntContext = createContext<HuntContextValue>({
  found: [],
  count: 0,
  total: HUNT_ITEMS.length,
  complete: false,
  collect: () => {},
  reset: () => {},
});

function readFound(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function HuntProvider({ children }: { children: ReactNode }) {
  const [found, setFound] = useState<string[]>(readFound);

  const count = found.length;
  const complete = count >= HUNT_ITEMS.length;

  const collect = useCallback((id: string) => {
    setFound((previous) => {
      if (previous.includes(id)) return previous;

      const next = [...previous, id];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // best-effort persistence
      }

      window.dispatchEvent(
        new CustomEvent(HUNT_FOUND_EVENT, { detail: { id } }),
      );

      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setFound([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best-effort
    }
  }, []);

  return (
    <HuntContext.Provider
      value={{ found, count, total: HUNT_ITEMS.length, complete, collect, reset }}
    >
      {children}
    </HuntContext.Provider>
  );
}

export function useHunt(): HuntContextValue {
  return useContext(HuntContext);
}