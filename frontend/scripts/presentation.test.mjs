/**
 * Unit tests for Presentation mode's reset and restore.
 *
 *   npm run test:units
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKUP_KEY,
  MODE_KEY,
  applyModeFromUrl,
  enterPresentation,
  leavePresentation,
} from "../src/utils/presentation.ts";

function makeStore(initial = {}) {
  const map = new Map(Object.entries(initial));

  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

const sample = () => ({
  paperrec_logged_in: "true",
  paperrec_user_email: "a@b.c",
  paperrec_site_mode: "researcher",
  paperrec_ui_custom: '{"skin":"gameboy"}',
  paperrec_pro_override_temp: "1",
  paperrec_sun: '{"fert":900}',
  unrelated: "keep me",
});

test("entering clears preferences but keeps sign-in and unrelated keys", () => {
  const store = makeStore(sample());

  enterPresentation(store);

  const now = store.dump();

  assert.equal(now[MODE_KEY], "presentation");
  assert.equal(now.paperrec_logged_in, "true");
  assert.equal(now.paperrec_user_email, "a@b.c");
  assert.equal(now.unrelated, "keep me");
  assert.equal(now.paperrec_ui_custom, undefined);
  assert.equal(now.paperrec_pro_override_temp, undefined);
  assert.equal(now.paperrec_sun, undefined);
  assert.ok(now[BACKUP_KEY]);
});

test("leaving restores exactly what was set aside", () => {
  const store = makeStore(sample());

  enterPresentation(store);
  store.setItem("paperrec_citation_style", "mla"); // made during the demo
  leavePresentation(store, "researcher");

  const now = store.dump();

  assert.equal(now[MODE_KEY], "researcher");
  assert.equal(now.paperrec_ui_custom, '{"skin":"gameboy"}');
  assert.equal(now.paperrec_pro_override_temp, "1");
  assert.equal(now.paperrec_sun, '{"fert":900}');
  assert.equal(now.paperrec_citation_style, undefined);
  assert.equal(now[BACKUP_KEY], undefined);
});

test("entering twice does not overwrite the backup with the empty state", () => {
  const store = makeStore(sample());

  enterPresentation(store);
  enterPresentation(store);
  leavePresentation(store, "library");

  assert.equal(store.dump().paperrec_ui_custom, '{"skin":"gameboy"}');
  assert.equal(store.dump()[MODE_KEY], "library");
});

test("a broken backup restores nothing and does not throw", () => {
  const store = makeStore({ [MODE_KEY]: "presentation", [BACKUP_KEY]: "{oops" });

  leavePresentation(store, "library");
  assert.equal(store.dump()[MODE_KEY], "library");
});

test("a backup cannot smuggle back sign-in or foreign keys", () => {
  const store = makeStore({
    [MODE_KEY]: "presentation",
    [BACKUP_KEY]: JSON.stringify({ paperrec_logged_in: "evil", other: "x", paperrec_sun: "1" }),
    paperrec_logged_in: "true",
  });

  leavePresentation(store, "library");

  const now = store.dump();

  assert.equal(now.paperrec_logged_in, "true");
  assert.equal(now.other, undefined);
  assert.equal(now.paperrec_sun, "1");
});

test("the mode query switches modes and ignores anything else", () => {
  const store = makeStore(sample());

  assert.equal(applyModeFromUrl(store, "?mode=nonsense"), false);
  assert.equal(applyModeFromUrl(store, ""), false);
  assert.equal(applyModeFromUrl(store, "?mode=presentation"), true);
  assert.equal(store.dump()[MODE_KEY], "presentation");
  assert.equal(applyModeFromUrl(store, "?mode=researcher"), true);
  assert.equal(store.dump()[MODE_KEY], "researcher");
  assert.equal(store.dump().paperrec_sun, '{"fert":900}');
});
