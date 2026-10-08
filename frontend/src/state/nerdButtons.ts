/**
 * The "nerd buttons" switch (top bar, beside the theme button): while it is
 * on, every Stats for Nerds control shows. Switching it off breaks each one
 * apart with the pixel shatter and removes it everywhere.
 */

import { useCallback, useSyncExternalStore } from "react";

import { shatterElements } from "../utils/shatter";

const KEY = "paperrec_nerd_buttons";
const EVENT = "paperrec-nerd-buttons";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
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

/** Anything tagged `data-nerd` is a Stats for Nerds control. */
function shatterNerdControls(): void {
  shatterElements(Array.from(document.querySelectorAll("[data-nerd]")));
}

export function useNerdButtons(): { on: boolean; setOn: (on: boolean) => void } {
  const on = useSyncExternalStore(subscribe, read, () => true);

  const setOn = useCallback((next: boolean) => {
    // Copy the controls into pieces before the page removes them.
    if (!next && read()) shatterNerdControls();

    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* private mode: the switch just doesn't persist */
    }

    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { on, setOn };
}
