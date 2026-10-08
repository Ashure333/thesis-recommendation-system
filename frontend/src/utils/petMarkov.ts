/**
 * PET MARKOV — what the pet says while you chat.
 *
 * A word-level Markov chain, trained on the CURRENT pet form's own lines
 * (see getPetCorpus), supplies in-character phrasing. A chain is not
 * conditioned on anything by itself, so the conversation steers it in two
 * ways: the event (thinking, answered, fallback, error) picks a sentence
 * frame, and the conversation's key term fills the frame's topic slot.
 * The chain's short reaction fragment ("{r}") rides along in some frames.
 *
 * Pure and dependency-free on purpose: no imports, no browser APIs, a
 * seedable RNG, so it runs under `node --test` (see scripts/*.test.mjs).
 */

export type Rng = () => number;

/** Small deterministic RNG (mulberry32) for repeatable tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------ */
/* Markov chain                                                  */
/* ------------------------------------------------------------ */

const END = "\u0000";

export interface MarkovChain {
  order: number;
  /** Start states (the first `order` words of each line), one entry per line. */
  starts: string[];
  /** state (last `order` words) -> following words, END marks a line end. */
  next: Map<string, string[]>;
  /** One-word backoff used when an order-N state has no continuation. */
  next1: Map<string, string[]>;
}

function add(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);

  if (list) {
    list.push(value);
  } else {
    map.set(key, [value]);
  }
}

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export function buildChain(lines: string[], order = 2): MarkovChain {
  const chain: MarkovChain = {
    order,
    starts: [],
    next: new Map(),
    next1: new Map(),
  };

  for (const raw of lines) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);

    if (tokens.length < 2) continue;

    const startLen = Math.min(order, tokens.length);

    chain.starts.push(tokens.slice(0, startLen).join(" "));

    for (let i = startLen; i <= tokens.length; i++) {
      const state = tokens.slice(Math.max(0, i - order), i).join(" ");

      add(chain.next, state, i < tokens.length ? tokens[i] : END);
    }

    for (let i = 1; i <= tokens.length; i++) {
      add(chain.next1, tokens[i - 1], i < tokens.length ? tokens[i] : END);
    }
  }

  return chain;
}

function finish(text: string): string {
  const trimmed = text.replace(/[,;:]+$/, "").trim();

  return /[.!?…*")]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export interface GenerateOptions {
  minWords?: number;
  maxWords?: number;
  tries?: number;
  /**
   * Chance per step of continuing from the last word alone instead of the
   * last `order` words. Pure order-N walks on a small corpus can only copy
   * its lines; this lets lines that share a word cross over. Every step
   * still uses a word pair that occurs in the corpus. Kept low (0.2): on
   * the ~25-line per-form corpora more mixing mostly yields ungrammatical
   * fragments ("Let me anything!") rather than more variety.
   */
  mix?: number;
}

/**
 * A short fragment that ends where a corpus line ends. Returns "" for an
 * empty chain; falls back to a trimmed fragment if no walk ends naturally.
 */
export function generate(
  chain: MarkovChain,
  rng: Rng,
  options: GenerateOptions = {},
): string {
  const minWords = options.minWords ?? 2;
  const maxWords = options.maxWords ?? 5;
  const tries = options.tries ?? 40;
  const mix = options.mix ?? 0.2;

  if (chain.starts.length === 0) return "";

  let fallback = "";

  for (let attempt = 0; attempt < tries; attempt++) {
    const out = pick(chain.starts, rng).split(" ");
    let ended = false;

    while (out.length <= maxWords) {
      const state = out.slice(-chain.order).join(" ");
      const last = out[out.length - 1];
      const shortFirst = chain.order > 1 && rng() < mix;
      const choices =
        (shortFirst ? chain.next1.get(last) : chain.next.get(state)) ??
        chain.next.get(state) ??
        chain.next1.get(last) ?? [END];
      const word = pick(choices, rng);

      if (word === END) {
        ended = true;
        break;
      }

      out.push(word);
    }

    if (ended && out.length >= minWords && out.length <= maxWords) {
      return finish(out.join(" "));
    }

    if (!fallback && out.length >= minWords) {
      fallback = out.slice(0, maxWords).join(" ");
    }
  }

  return fallback ? `${fallback.replace(/[.,;:!?]+$/, "")}…` : "";
}

/* ------------------------------------------------------------ */
/* Key terms (same algorithm as app/services/chat_suggestions.py) */
/* ------------------------------------------------------------ */

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are as at be
  because been before being below between both but by can could did do does
  doing down during each few for from further had has have having he her here
  hers him his how i if in into is it its itself just me more most my no nor
  not now of off on once only or other our out over own same she should so
  some such than that the their them then there these they this those through
  to too under until up very was we were what when where which while who whom
  why will with would you your may might must shall likely often however
  therefore thus whereas although among per via`.split(/\s+/),
);

const GENERIC = new Set(
  `paper papers study studies result results source sources author authors
  research work works approach finding findings show shows shown showed find
  found use used using based report reports reported suggest suggests
  suggested evidence overall several many various different within across
  provide provides provided including include includes`.split(/\s+/),
);

function contentTokens(clause: string): (string | null)[] {
  const words = clause.match(/[A-Za-z][A-Za-z'-]+/g) ?? [];

  return words.map((word) => {
    const lowered = word.toLowerCase().replace(/^['-]+|['-]+$/g, "");

    return STOPWORDS.has(lowered) || GENERIC.has(lowered) || lowered.length < 3
      ? null
      : lowered;
  });
}

/** Top topic phrases: repeated bigrams first, then repeated or long words. */
export function keyTerms(text: string, k = 3): string[] {
  const unigrams = new Map<string, number>();
  const bigrams = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  let order = 0;

  for (const clause of (text || "").split(/[.,;:!?()[\]\n]+/)) {
    const tokens = contentTokens(clause);

    tokens.forEach((token, index) => {
      if (token === null) return;

      unigrams.set(token, (unigrams.get(token) ?? 0) + 1);

      if (!firstSeen.has(token)) firstSeen.set(token, order);

      order += 1;

      const following = tokens[index + 1];

      if (following !== null && following !== undefined) {
        const phrase = `${token} ${following}`;

        bigrams.set(phrase, (bigrams.get(phrase) ?? 0) + 1);

        if (!firstSeen.has(phrase)) firstSeen.set(phrase, order);
      }
    });
  }

  const candidates: { score: number; length: number; first: number; term: string }[] = [];

  for (const [phrase, count] of bigrams) {
    if (count >= 2) {
      candidates.push({
        score: count * 2,
        length: phrase.length,
        first: firstSeen.get(phrase) ?? 0,
        term: phrase,
      });
    }
  }

  for (const [word, count] of unigrams) {
    if (count >= 2 || word.length >= 7) {
      candidates.push({
        score: count,
        length: word.length,
        first: firstSeen.get(word) ?? 0,
        term: word,
      });
    }
  }

  candidates.sort(
    (a, b) => b.score - a.score || b.length - a.length || a.first - b.first,
  );

  const chosen: string[] = [];

  for (const { term } of candidates) {
    if (chosen.some((c) => c === term || c.split(" ").includes(term))) continue;

    chosen.push(term);

    if (chosen.length === k) break;
  }

  return chosen;
}

export interface ChatLike {
  role: "user" | "assistant";
  content: string;
}

/** An answer's prose: no reference list, [n] markers or (Author, 2020) cites. */
function proseOf(text: string): string {
  return text
    .replace(/\n\n(?:References|Works Cited|Bibliography)\n[\s\S]*$/, "")
    .replace(/\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]/g, " ")
    .replace(/\([^()]*\d{4}[^()]*\)/g, " ");
}

/**
 * The conversation's current topic. The newest question usually names it,
 * which also makes a change of subject win immediately; only a bare
 * follow-up falls back to the recent turns.
 */
export function contextTerm(messages: ChatLike[]): string | undefined {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const named = lastUser ? keyTerms(lastUser.content, 1)[0] : undefined;

  if (named) return named;

  // A bare follow-up ("and why?") names no topic: use the recent turns.
  return keyTerms(
    messages
      .slice(-4)
      .map((message) => proseOf(message.content))
      .join(". "),
    1,
  )[0];
}

/* ------------------------------------------------------------ */
/* Lines                                                         */
/* ------------------------------------------------------------ */

export type PetChatKind = "thinking" | "answered" | "fallback" | "error";

export interface PetChatContext {
  kind: PetChatKind;
  /** The conversation's current topic, if one could be found. */
  term?: string;
  /** Sources used by the answer. */
  sources?: number;
  /** How many questions have been asked in this conversation. */
  turn?: number;
}

/** The speech bubble is ~220px wide and two lines tall. */
export const MAX_LINE_CHARS = 64;
const MAX_TERM_CHARS = 28;

const FRAMES: Record<PetChatKind, { withTerm: string[]; plain: string[] }> = {
  thinking: {
    withTerm: [
      "Digging through the stacks for {term}…",
      "{r} Hunting down {term}…",
      "Sniffing out papers on {term}…",
    ],
    plain: ["{r} Checking the stacks…", "Let me look…"],
  },
  answered: {
    withTerm: [
      "{n} on {term}. {r}",
      "Found {n} on {term}! {r}",
      "{r} {n} on {term}.",
    ],
    plain: ["Found {n}! {r}", "{r} {n} in the stacks."],
  },
  fallback: {
    withTerm: [
      "The big brain is napping. Raw evidence on {term}.",
      "No synthesis, just sources on {term}. {r}",
    ],
    plain: ["The big brain is napping. {r}", "Raw evidence only this time."],
  },
  error: {
    withTerm: [],
    plain: ["The line went dead. Try again? {r}", "Something broke. {r}"],
  },
};

const LONG_CHAT_FRAMES = [
  "Round {turn} on {term}. Still hungry!",
  "{turn} questions deep on {term}. {r}",
];

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+([.,!?…])/g, "$1").trim();
}

export function composeChatLine(
  chain: MarkovChain,
  context: PetChatContext,
  rng: Rng,
): string {
  const term = context.term?.trim().slice(0, MAX_TERM_CHARS);
  const sources = context.sources ?? 0;
  const turn = context.turn ?? 1;
  const frames = FRAMES[context.kind];

  let pool = term ? frames.withTerm : frames.plain;

  if (context.kind === "answered" && term && turn >= 3 && rng() < 0.4) {
    pool = LONG_CHAT_FRAMES;
  }

  if (pool.length === 0) pool = frames.plain;

  const fill = (frame: string, withFragment: boolean): string =>
    tidy(
      frame
        .replace("{term}", term ?? "")
        .replace("{n}", `${sources} source${sources === 1 ? "" : "s"}`)
        .replace("{turn}", String(turn))
        .replace(
          "{r}",
          withFragment ? generate(chain, rng, { minWords: 2, maxWords: 4 }) : "",
        ),
    );

  const frame = pick(pool, rng);
  const full = fill(frame, true);

  if (full.length <= MAX_LINE_CHARS) return full;

  const bare = fill(frame, false);

  return bare.length <= MAX_LINE_CHARS ? bare : `${bare.slice(0, MAX_LINE_CHARS - 1)}…`;
}
