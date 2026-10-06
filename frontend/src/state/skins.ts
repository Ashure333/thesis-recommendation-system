/* ============================================================
   SKINS — single source of truth for tree-skin ownership.

   Both the tree's seed bank and the shop panes read the same
   localStorage key and listen for the same change event, so a
   skin bought in either shop shows as owned everywhere
   instantly (and is never sold twice).
   ============================================================ */

import { useEffect, useState } from "react";

import {
  DEFAULT_SPECIES,
  TREE_SPECIES,
  type TreeSpeciesId,
} from "../data/knowledge";

export const SKINS_KEY = "paperrec_tree_skins";
export const SKINS_CHANGED = "paperrec-skins-changed";

export function readOwnedSkins(): TreeSpeciesId[] {
  try {
    const raw = window.localStorage.getItem(SKINS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((value) =>
        TREE_SPECIES.some((species) => species.id === value),
      ) as TreeSpeciesId[];
      if (valid.length > 0) return valid;
    }
  } catch {
    // best-effort
  }
  return [DEFAULT_SPECIES];
}

/** Buy a skin once: persist it and tell every shop to re-read. */
export function addOwnedSkin(id: TreeSpeciesId) {
  const next = Array.from(new Set([...readOwnedSkins(), id]));
  try {
    window.localStorage.setItem(SKINS_KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
  window.dispatchEvent(new Event(SKINS_CHANGED));
}

/** Live ownership, shared by the seed bank and the shop panes. */
export function useOwnedSkins(): TreeSpeciesId[] {
  const [skins, setSkins] = useState<TreeSpeciesId[]>(readOwnedSkins);

  useEffect(() => {
    const reload = () => setSkins(readOwnedSkins());
    window.addEventListener(SKINS_CHANGED, reload);
    window.addEventListener("focus", reload);
    return () => {
      window.removeEventListener(SKINS_CHANGED, reload);
      window.removeEventListener("focus", reload);
    };
  }, []);

  return skins;
}