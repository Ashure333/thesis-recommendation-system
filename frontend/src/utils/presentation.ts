/**
 * Presentation mode: the build that ships.
 *
 * Entering it sets every local preference aside (skins, cheats, garden
 * progress, layout choices, Pro override, ...) so the site comes up exactly
 * as a first-time visitor sees it. Nothing is deleted: the old values are
 * kept under one backup key and put back when the mode is left.
 *
 * Sign-in and the mode choice itself are never touched.
 *
 * Pure over a Storage-like object, so it runs under `node --test`.
 */

export const MODE_KEY = "paperrec_site_mode";
export const BACKUP_KEY = "paperrec_presentation_backup";

const PREFIX = "paperrec_";

/** Who is signed in and the boot beat: these survive a reset. */
const KEEP = new Set([
  MODE_KEY,
  BACKUP_KEY,
  "paperrec_logged_in",
  "paperrec_user_email",
  "paperrec_user_name",
  "paperrec_remember_me",
  "paperrec_admin_session",
  "paperrec_booted",
]);

export interface KeyValueStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function preferenceKeys(store: KeyValueStore): string[] {
  const keys: string[] = [];

  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);

    if (key && key.startsWith(PREFIX) && !KEEP.has(key)) keys.push(key);
  }

  return keys;
}

/** Set every preference aside and make Presentation the site mode. */
export function enterPresentation(store: KeyValueStore): void {
  if (store.getItem(MODE_KEY) === "presentation") return;

  const saved: Record<string, string> = {};

  for (const key of preferenceKeys(store)) {
    const value = store.getItem(key);

    if (value !== null) saved[key] = value;
    store.removeItem(key);
  }

  store.setItem(BACKUP_KEY, JSON.stringify(saved));
  store.setItem(MODE_KEY, "presentation");
}

/** Drop what Presentation created, restore the saved preferences, set `next`. */
export function leavePresentation(
  store: KeyValueStore,
  next: "library" | "researcher",
): void {
  if (store.getItem(MODE_KEY) !== "presentation") {
    store.setItem(MODE_KEY, next);

    return;
  }

  let saved: Record<string, string> = {};

  try {
    const parsed = JSON.parse(store.getItem(BACKUP_KEY) ?? "{}");

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed;
  } catch {
    /* an unreadable backup restores nothing */
  }

  for (const key of preferenceKeys(store)) store.removeItem(key);
  for (const [key, value] of Object.entries(saved)) {
    if (key.startsWith(PREFIX) && !KEEP.has(key) && typeof value === "string") {
      store.setItem(key, value);
    }
  }

  store.removeItem(BACKUP_KEY);
  store.setItem(MODE_KEY, next);
}

/** True when the stored site mode is Presentation. Safe before React runs. */
export function isPresentationStored(): boolean {
  try {
    return window.localStorage.getItem(MODE_KEY) === "presentation";
  } catch {
    return false;
  }
}

/**
 * `?mode=presentation|library|researcher` in the address switches the mode
 * before anything reads storage. Returns true when it changed something.
 */
export function applyModeFromUrl(
  store: KeyValueStore,
  search: string,
): boolean {
  const wanted = new URLSearchParams(search).get("mode");

  if (wanted !== "presentation" && wanted !== "library" && wanted !== "researcher") {
    return false;
  }

  if (wanted === "presentation") enterPresentation(store);
  else leavePresentation(store, wanted);

  return true;
}
