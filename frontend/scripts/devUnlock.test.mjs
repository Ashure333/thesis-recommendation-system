/**
 * Unit tests for the way out of Presentation mode.
 *
 *   npm run test:units
 */

import assert from "node:assert/strict";
import test from "node:test";

import { chordHeld, hashWord, isDevPassword } from "../src/utils/devUnlock.ts";

test("only the exact word opens the door", () => {
  assert.equal(isDevPassword("Tempest"), true);
  for (const wrong of ["tempest", "TEMPEST", "Tempest ", " Tempest", "", "Tempes", "Tempests"]) {
    assert.equal(isDevPassword(wrong), false, JSON.stringify(wrong));
  }
});

test("the word is not kept in the clear", () => {
  assert.notEqual(hashWord("Tempest"), hashWord("tempest"));
  assert.equal(typeof hashWord("Tempest"), "number");
});

test("the chord needs P, R and O held together", () => {
  assert.equal(chordHeld(new Set(["p", "r", "o"])), true);
  assert.equal(chordHeld(new Set(["p", "r", "o", "shift"])), true);
  assert.equal(chordHeld(new Set(["p", "r"])), false);
  assert.equal(chordHeld(new Set()), false);
});
