import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

/* ============================================================
   LAYOUT PREFERENCES — shared across tabs.
   Which panels are visible on the multi-pane pages (Repository,
   Search): the left sidebar (filters / query controls) and the
   right details pane (paper details / similar-papers graph).
   Persisted per browser, so a change on one tab applies to all.
   ============================================================ */

export type LayoutPreset = "full" | "list" | "filters" | "details";

export interface LayoutPrefs {
  sidebar: boolean;
  details: boolean;
}

const STORAGE_KEY = "paperrec_layout_prefs";

const PRESETS: Record<LayoutPreset, LayoutPrefs> = {
  full: { sidebar: true, details: true },
  list: { sidebar: false, details: false },
  filters: { sidebar: true, details: false },
  details: { sidebar: false, details: true },
};

const DEFAULTS: LayoutPrefs = PRESETS.full;

function readPrefs(): LayoutPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LayoutPrefs>;
      return {
        sidebar: typeof parsed.sidebar === "boolean" ? parsed.sidebar : DEFAULTS.sidebar,
        details: typeof parsed.details === "boolean" ? parsed.details : DEFAULTS.details,
      };
    }
  } catch {
    // best-effort
  }
  return DEFAULTS;
}

function presetFor(prefs: LayoutPrefs): LayoutPreset {
  if (prefs.sidebar && prefs.details) return "full";
  if (!prefs.sidebar && !prefs.details) return "list";
  return prefs.sidebar ? "filters" : "details";
}

interface LayoutPrefsContextValue {
  prefs: LayoutPrefs;
  preset: LayoutPreset;
  setPreset: (preset: LayoutPreset) => void;
}

const LayoutPrefsContext = createContext<LayoutPrefsContextValue>({
  prefs: DEFAULTS,
  preset: "full",
  setPreset: () => {},
});

export function LayoutPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<LayoutPrefs>(readPrefs);

  const setPreset = useCallback((preset: LayoutPreset) => {
    setPrefs((current) => {
      const next = PRESETS[preset];
      if (next.sidebar === current.sidebar && next.details === current.details) {
        return current;
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // best-effort
      }
      return next;
    });
  }, []);

  return (
    <LayoutPrefsContext.Provider
      value={{ prefs, preset: presetFor(prefs), setPreset }}
    >
      {children}
    </LayoutPrefsContext.Provider>
  );
}

export function useLayoutPrefs(): LayoutPrefsContextValue {
  return useContext(LayoutPrefsContext);
}

export { PRESETS };