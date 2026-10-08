/**
 * Runs before anything else reads localStorage: a `?mode=` address switches
 * the site mode (and sets preferences aside or back) first, then drops the
 * parameter so a refresh does not repeat it.
 */

import { applyModeFromUrl } from "./utils/presentation";

try {
  if (applyModeFromUrl(window.localStorage, window.location.search)) {
    const url = new URL(window.location.href);

    url.searchParams.delete("mode");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
} catch {
  /* storage unavailable: the site opens in its default mode */
}
