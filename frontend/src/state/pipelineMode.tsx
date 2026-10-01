import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  DEFAULT_DIAL_ALLOCATION,
  type DialAllocation,
} from "../data/pipelineConfigs";

// ============================================================
// SHARED PIPELINE MODE STATE
// ============================================================
//
// The header MODE badge and the Search / Recommendations pages
// all need to agree on which pipeline is active. Local useState
// kept them out of sync — the badge was frozen on FINAL BOSS.
// This provider gives every consumer one shared value,
// persisted across reloads.

const STORAGE_KEY = "paperrec_pipeline_mode";
const WEIGHTS_KEY = "paperrec_custom_weights";

const DEFAULT_PIPELINE = "tfidf_sbert_metadata";

interface PipelineModeValue {
  pipelineId: string;
  setPipelineId: (pipelineId: string) => void;
  /** Dial allocation used when pipelineId === "custom". */
  customWeights: DialAllocation;
  setCustomWeights: (weights: DialAllocation) => void;
}

const PipelineModeContext =
  createContext<PipelineModeValue | null>(null);

function readStoredPipeline(): string {
  try {
    const stored = window.localStorage.getItem(
      STORAGE_KEY
    );

    if (stored) {
      return stored;
    }
  } catch {
    // localStorage unavailable — fall through to the default.
  }

  return DEFAULT_PIPELINE;
}

function readStoredWeights(): DialAllocation {
  try {
    const raw = window.localStorage.getItem(WEIGHTS_KEY);

    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DialAllocation>;

      if (
        typeof parsed.tfidf === "number" &&
        typeof parsed.sbert === "number" &&
        typeof parsed.metadata === "number"
      ) {
        return {
          tfidf: parsed.tfidf,
          sbert: parsed.sbert,
          metadata: parsed.metadata,
        };
      }
    }
  } catch {
    // localStorage unavailable — fall through to the default.
  }

  return DEFAULT_DIAL_ALLOCATION;
}

export function PipelineModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pipelineId, setPipelineIdState] =
    useState<string>(readStoredPipeline);

  const [customWeights, setCustomWeightsState] =
    useState<DialAllocation>(readStoredWeights);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        pipelineId
      );
    } catch {
      // Persistence is best-effort only.
    }
  }, [pipelineId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WEIGHTS_KEY,
        JSON.stringify(customWeights)
      );
    } catch {
      // Persistence is best-effort only.
    }
  }, [customWeights]);

  return (
    <PipelineModeContext.Provider
      value={{
        pipelineId,
        setPipelineId: setPipelineIdState,
        customWeights,
        setCustomWeights: setCustomWeightsState,
      }}
    >
      {children}
    </PipelineModeContext.Provider>
  );
}

export function usePipelineMode(): PipelineModeValue {
  const value = useContext(PipelineModeContext);

  if (!value) {
    throw new Error(
      "usePipelineMode must be used inside PipelineModeProvider."
    );
  }

  return value;
}