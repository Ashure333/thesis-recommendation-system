/* ============================================================
   HELP LIBRARY, the pet chatbot brain
   Unlocked once every scavenger-hunt treasure is found. The pet
   answers free-text questions by keyword-matching them against
   every tip (base + deep) plus a few special entries.

   Matching is deliberately lightweight: tokenize the question,
   score each entry by how many of its keywords hit, return the
   best match. Zero hits falls back to a topic-listing answer.
   ============================================================ */

import { TIPS, EXTRA_TIPS } from "./tips";
import { HUNT_ITEMS } from "./hunt";

export interface HelpEntry {
  title: string;
  keywords: string[];
  body: string;
}

const FALLBACK: HelpEntry = {
  title: "HELP LIBRARY",
  keywords: [],
  body:
    "I didn't quite catch that. Try asking about pipelines, TF-IDF, " +
    "S-BERT, imports, filters, themes, evaluation, or the scavenger " +
    "hunt, or just ask \"help\".",
};

/* Special entries that aren't tips. */
const SPECIAL_ENTRIES: HelpEntry[] = [
  {
    title: "HELP LIBRARY",
    keywords: [
      "help",
      "library",
      "abilities",
      "what can",
      "guide",
      "usage",
      "manual",
      "chat",
    ],
    body:
      "I'm the help library for Re:Search. Ask me about any feature: " +
      "the six pipelines and their math, importing references, " +
      "filters, themes, evaluation metrics, or the scavenger hunt " +
      "that unlocked me.",
  },
  {
    title: "WHO AM I",
    keywords: ["who", "your name", "introduce", "yourself", "about you", "pet"],
    body:
      "I.m the Re:Search pet, the arcade companion of the thesis " +
      "recommendation system. I started as a tip guide, and after " +
      "you found every treasure I grew into this help library.",
  },
  {
    title: "SCAVENGER HUNT",
    keywords: [
      "hunt",
      "treasure",
      "scavenger",
      "secret",
      "unlock",
      "lock",
      "find all",
      "items",
    ],
    body:
      `There are ${HUNT_ITEMS.length} hidden treasures, one per page. ` +
      "Each is a small dim sparkle. Spot it and click it. The pet " +
      "whispers hints for the ones you're missing, and finding all " +
      `${HUNT_ITEMS.length} unlocks the deep tips and this chat.`,
  },
  {
    title: "RESET PROGRESS",
    keywords: ["reset", "restart", "wipe", "clear", "progress"],
    body:
      "Once the library is unlocked, a tiny RESET appears in the " +
      "bubble footer. It clears your discovered tips and treasure " +
      "progress so you can replay the hunt.",
  },
];

/* Every tip becomes a help entry; the deep tips carry their own
   chat keywords. */
function tipToEntry(title: string, keywords: string[], body: string): HelpEntry {
  return { title: title.toUpperCase(), keywords, body };
}

export const HELP_ENTRIES: HelpEntry[] = [
  ...SPECIAL_ENTRIES,
  ...TIPS.map((tip) =>
    tipToEntry(
      tip.title,
      tip.title
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 2),
      tip.body,
    ),
  ),
  ...EXTRA_TIPS.map((tip) => tipToEntry(tip.title, tip.keywords, tip.body)),
];

/* Aliases so "sbert" and "s-bert" and "bert" all hit the same
   entry without editing every keyword list. */
const ALIASES: Record<string, string[]> = {
  tfidf: ["tf", "idf", "lexical"],
  sbert: ["s", "bert", "semantic", "embedding"],
  meta: ["metadata", "year", "signal"],
};

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    // Hyphens are separators too, so "TF-IDF" tokenizes into
    // ["tf", "idf"] and still matches the "tfidf" keyword.
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function answerQuestion(query: string): HelpEntry {
  const tokens = tokenize(query);
  if (tokens.length === 0) return FALLBACK;

  let best: HelpEntry = FALLBACK;
  let bestScore = 0;

  for (const entry of HELP_ENTRIES) {
    let score = 0;

    for (const keyword of entry.keywords) {
      const needle = keyword.toLowerCase();

      for (const token of tokens) {
        const expanded =
          token.length >= 3 ? [token, ...(ALIASES[token] ?? [])] : [token];

        for (const alias of expanded) {
          if (needle.includes(alias) || alias.includes(needle)) {
            score += 1;
            break;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best;
}