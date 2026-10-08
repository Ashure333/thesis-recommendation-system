/**
 * Which scenery layers the player has switched off. Everything is on by
 * default; the choice is kept in local storage and shared live between the
 * almanac (where it is made) and the garden (where it shows).
 */

import { useCallback, useSyncExternalStore } from "react";

import { PARTICLE_LAYERS } from "../data/charms";

const KEY = "paperrec_scene_layers_off";
const EVENT = "paperrec:scene-layers";

export function readLayersOff(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);

    /* nothing chosen yet: the stray particles start off, the rest on */
    if (raw === null) return [...PARTICLE_LAYERS].sort();

    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string").sort()
      : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The snapshot is a string so React can tell when it really changed. */
const snapshot = () => readLayersOff().join(",");

export function useSceneLayers() {
  const joined = useSyncExternalStore(subscribe, snapshot, () => "");
  const off = joined ? joined.split(",") : [];
  const toggle = useCallback((id: string) => {
    const next = new Set(readLayersOff());

    if (next.has(id)) next.delete(id);
    else next.add(id);

    try {
      window.localStorage.setItem(KEY, JSON.stringify([...next].sort()));
    } catch {
      /* private mode: the switch just doesn't persist */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const setAll = useCallback((on: boolean, ids: string[]) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(on ? [] : [...ids].sort()));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { off, isOn: (id: string) => !off.includes(id), toggle, setAll };
}
