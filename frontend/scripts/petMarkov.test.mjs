/**
 * Unit tests for the pet's Markov chain and chat-context helpers.
 *
 *   npm run test:units
 *
 * Runs on Node's built-in test runner; the .ts module is loaded with
 * --experimental-strip-types, so it has to stay dependency-free.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_LINE_CHARS,
  buildChain,
  composeChatLine,
  contextTerm,
  generate,
  keyTerms,
  mulberry32,
} from "../src/utils/petMarkov.ts";

const CORPUS = [
  "Hold still.",
  "One clean cut.",
  "I will tidy this up.",
  "Hold on, partner!",
  "This is fun.",
  "I will find it.",
  "One more try!",
  "Leave it to me.",
];

function pairs(lines) {
  const set = new Set();

  for (const line of lines) {
    const words = line.split(/\s+/);

    for (let i = 0; i < words.length - 1; i++) set.add(`${words[i]} ${words[i + 1]}`);
  }

  return set;
}

test("mulberry32 is deterministic and stays in [0, 1)", () => {
  const a = mulberry32(7);
  const b = mulberry32(7);

  for (let i = 0; i < 50; i++) {
    const value = a();

    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }

  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test("generated fragments only use word pairs found in the corpus", () => {
  const chain = buildChain(CORPUS);
  const known = pairs(CORPUS);

  for (let seed = 1; seed <= 60; seed++) {
    const text = generate(chain, mulberry32(seed), { minWords: 2, maxWords: 5 });
    const words = text.split(" ");

    assert.ok(text.length > 0);
    assert.ok(words.length >= 2 && words.length <= 5, text);
    assert.match(text, /[.!?…]$/);

    for (let i = 0; i < words.length - 1; i++) {
      assert.ok(known.has(`${words[i]} ${words[i + 1]}`), `${text} :: ${words[i]} ${words[i + 1]}`);
    }
  }
});

test("same seed, same fragment; different seeds give variety", () => {
  const chain = buildChain(CORPUS);

  assert.equal(
    generate(chain, mulberry32(11)),
    generate(chain, mulberry32(11)),
  );

  const seen = new Set();

  for (let seed = 1; seed <= 40; seed++) seen.add(generate(chain, mulberry32(seed)));

  assert.ok(seen.size >= 4, `only ${seen.size} distinct fragments`);
});

test("lines that share words can cross over into new lines", () => {
  const shared = [
    "I will find the treasure!",
    "You will find the paper!",
    "I will eat the paper!",
    "You will eat the treasure!",
  ];
  const chain = buildChain(shared);
  const original = new Set(shared);
  const known = pairs(shared);
  const novel = new Set();

  for (let seed = 1; seed <= 300; seed++) {
    const text = generate(chain, mulberry32(seed), { minWords: 4, maxWords: 5 });

    if (!original.has(text)) novel.add(text);

    const words = text.split(" ");

    for (let i = 0; i < words.length - 1; i++) assert.ok(known.has(`${words[i]} ${words[i + 1]}`), text);
  }

  assert.ok(novel.size > 0, "chain only ever repeats corpus lines");
});

test("mix = 0 is a pure order-2 walk, which only copies a tiny corpus", () => {
  const chain = buildChain(CORPUS);
  const original = new Set(CORPUS);

  for (let seed = 1; seed <= 100; seed++) {
    assert.ok(original.has(generate(chain, mulberry32(seed), { mix: 0 })));
  }
});

test("an empty chain, or one-word lines, produce nothing", () => {
  assert.equal(generate(buildChain([]), mulberry32(1)), "");
  assert.equal(generate(buildChain(["Hi", "Yo"]), mulberry32(1)), "");
});

test("maxWords is respected", () => {
  const chain = buildChain(CORPUS);

  for (let seed = 1; seed <= 40; seed++) {
    const words = generate(chain, mulberry32(seed), { minWords: 2, maxWords: 3 }).split(" ");

    assert.ok(words.length <= 3);
  }
});

test("keyTerms prefers a repeated phrase, then repeated or long words", () => {
  assert.deepEqual(
    keyTerms(
      "Blended learning improves engagement. Blended learning is popular. Engagement matters.",
      2,
    ),
    ["blended learning", "engagement"],
  );
});

test("keyTerms ignores stopwords and generic research words", () => {
  assert.deepEqual(keyTerms("The study shows that the results of the paper are good.", 3), []);
  assert.deepEqual(keyTerms("", 3), []);
});

test("contextTerm takes the topic from the newest question", () => {
  const messages = [
    { role: "user", content: "How does blended learning affect engagement?" },
    {
      role: "assistant",
      content:
        "Blended learning improves engagement (Yao et al., 2015) [1].\n\nReferences\nBohao Yao (2015). Hamiltonian cycles.",
    },
    { role: "user", content: "What is the smallest planar hypohamiltonian graph?" },
  ];

  assert.equal(contextTerm(messages), "hypohamiltonian");
});

test("contextTerm falls back to recent turns for a bare follow-up", () => {
  const messages = [
    { role: "user", content: "Tell me about blended learning and student engagement." },
    {
      role: "assistant",
      content:
        "Blended learning raises engagement. Blended learning also needs a reliable LMS.\n\nReferences\nSomebody (2020). Unrelated Citation Title.",
    },
    { role: "user", content: "And why?" },
  ];

  assert.equal(contextTerm(messages), "blended learning");
});

test("composed lines fit the bubble and fill every slot", () => {
  const chain = buildChain(CORPUS);
  const kinds = ["thinking", "answered", "fallback", "error"];

  for (const kind of kinds) {
    for (const term of [undefined, "blended learning"]) {
      for (let seed = 1; seed <= 40; seed++) {
        const line = composeChatLine(chain, { kind, term, sources: 4, turn: 1 }, mulberry32(seed));

        assert.ok(line.length > 0);
        assert.ok(line.length <= MAX_LINE_CHARS, `${line.length}: ${line}`);
        assert.doesNotMatch(line, /[{}]|undefined|null/);

        if (term && kind !== "error") assert.match(line, /blended learning/);
      }
    }
  }
});

test("source counts are pluralised", () => {
  const chain = buildChain(CORPUS);
  const one = composeChatLine(chain, { kind: "answered", term: "graphs", sources: 1 }, mulberry32(3));
  const many = composeChatLine(chain, { kind: "answered", term: "graphs", sources: 5 }, mulberry32(3));

  assert.match(one, /\b1 source\b(?!s)/);
  assert.match(many, /\b5 sources\b/);
});

test("deep conversations get their own frames", () => {
  const chain = buildChain(CORPUS);
  const lines = new Set();

  for (let seed = 1; seed <= 60; seed++) {
    lines.add(composeChatLine(chain, { kind: "answered", term: "graphs", sources: 3, turn: 5 }, mulberry32(seed)));
  }

  assert.ok([...lines].some((line) => /Round 5|5 questions deep/.test(line)));
});

test("an empty chain still yields a usable line", () => {
  const line = composeChatLine(buildChain([]), { kind: "thinking", term: "graphs" }, mulberry32(1));

  assert.ok(line.length > 0 && line.length <= MAX_LINE_CHARS);
  assert.doesNotMatch(line, /[{}]/);
});
