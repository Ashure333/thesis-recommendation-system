/**
 * STATS DRAWER — the universal Statistics panel.
 *
 * Any page can publish what it just computed (pipeline + inputs);
 * the drawer shows the statistics, the live computation trace for
 * that published run, and plain-language interpretations of every
 * formula, linking to the Engine for the full treatment.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface StatsDrawerInputs {
  pipelineId: string;
  mode: "keyword" | "seed";
  query?: string;
  seedPaperId?: number;
  topK: number;
  mmrLambda?: number;
}

interface StatsDrawerValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** The most recent computation published by any page. */
  published: StatsDrawerInputs | null;
  publish: (inputs: StatsDrawerInputs | null) => void;
}

const StatsDrawerContext = createContext<StatsDrawerValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
  published: null,
  publish: () => {},
});

export function StatsDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [published, setPublished] = useState<StatsDrawerInputs | null>(null);

  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  const publish = useCallback((inputs: StatsDrawerInputs | null) => {
    setPublished(inputs);
  }, []);

  return (
    <StatsDrawerContext.Provider
      value={{ open, setOpen, toggle, published, publish }}
    >
      {children}
    </StatsDrawerContext.Provider>
  );
}

export function useStatsDrawer(): StatsDrawerValue {
  return useContext(StatsDrawerContext);
}