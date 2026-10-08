/**
 * The way back out of Presentation mode: hold P + R + O together, then give
 * the password.
 *
 * This is a door latch, not security: the site runs in the browser, so
 * anything it checks can be read there. Only a hash is kept so the word is
 * not sitting in the source in plain sight.
 *
 * Pure and dependency-free, so it runs under `node --test`.
 */

/** cyrb53: a small, fast, non-cryptographic string hash. */
export function hashWord(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);

    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const WORD_HASH = 7266297869939344;

export function isDevPassword(attempt: string): boolean {
  return hashWord(attempt) === WORD_HASH;
}

/** The chord that opens the prompt. */
export const CHORD = ["p", "r", "o"] as const;

/** True once every key of the chord is held at the same moment. */
export function chordHeld(down: ReadonlySet<string>): boolean {
  return CHORD.every((key) => down.has(key));
}
