/**
 * The chosen colour variant for each species, remembered in local storage
 * and shared live between everything that draws a tree (the garden, the
 * skin cards, the picker), so a pick shows everywhere at once.
 */

import { useCallback, useSyncExternalStore } from "react";

import {
  readVariantChoices,
  resolveVariant,
  writeVariantChoice,
} from "../utils/treeVariants";

const EVENT = "paperrec:tree-variant";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved variant id for a species ("original" when none or unknown). */
export function readTreeVariant(species: string): string {
  return resolveVariant(species, readVariantChoices()[species]).id;
}

export function useTreeVariant(species: string): [string, (id: string) => void] {
  const id = useSyncExternalStore(
    subscribe,
    () => readTreeVariant(species),
    () => "original",
  );
  const set = useCallback(
    (next: string) => {
      writeVariantChoice(species, resolveVariant(species, next).id);
      window.dispatchEvent(new Event(EVENT));
    },
    [species],
  );

  return [id, set];
}
