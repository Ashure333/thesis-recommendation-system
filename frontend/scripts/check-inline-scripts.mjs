/**
 * Check the inline <script> blocks in index.html.
 *
 * The pre-paint theme script lives in index.html, outside the
 * tsconfig "include" globs, so no type checker ever sees it. A syntax
 * error there does not fail `npm run build` -- it just silently
 * disables the theme flash prevention and throws "Unexpected number"
 * into the console. This closes that gap in two steps:
 *
 *   1. every block must PARSE;
 *   2. the pre-paint script is then RUN against a stub DOM, once with
 *      no stored accent and once per palette it defines. Its own
 *      try/catch blocks are empty, so a runtime error (an undefined
 *      variable, say) would otherwise be swallowed and leave the page
 *      unpainted -- that is exactly what made first runs flash. The
 *      run fails if any exception is swallowed, if the pre-paint
 *      background is not applied, or if a stored accent is not set.
 *
 * Exits non-zero, with file and line numbers, when a check fails.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// An optional path argument lets the check be pointed at another file.
const target = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(root, "index.html");

/**
 * Every inline <script>...</script>, including ones carrying a src
 * attribute (those have an empty body and are skipped below).
 * Deliberately not regex-per-line; blocks are matched across newlines.
 */
const blocks = [
  ...readFileSync(target, "utf8").matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  ),
];

let checked = 0;
let failed = 0;
let ran = 0;

/**
 * Run one pre-paint scenario against a stub DOM and return the list of
 * problems found (empty when the script behaved).
 */
function smoke(code, accent, booted) {
  const problems = [];
  const properties = {};
  const html = {
    style: {
      setProperty: (name, value) => {
        properties[name] = value;
      },
    },
    dataset: {},
  };
  const storage = (items) => ({ getItem: (key) => items[key] ?? null });
  const window = {
    matchMedia: () => ({ matches: false }),
    localStorage: storage(accent ? { paperrec_accent: accent } : {}),
    sessionStorage: storage(booted ? { paperrec_booted: "1" } : {}),
  };

  // The script's own `catch (e) {}` blocks are empty on purpose; make
  // them record what they swallow so the check can see it.
  const instrumented = code
    .split("catch (e) {}")
    .join("catch (e) { window.__swallowed = window.__swallowed || e; }");

  try {
    new Function("document", "window", "localStorage", "sessionStorage", instrumented)(
      { documentElement: html },
      window,
      window.localStorage,
      window.sessionStorage,
    );
  } catch (error) {
    problems.push(`threw: ${error}`);
  }

  if (window.__swallowed) {
    problems.push(`swallowed an exception: ${window.__swallowed}`);
  }

  const expectedBackground = booted ? /^rgb\(/ : /^#030712$/;
  if (!expectedBackground.test(html.style.background ?? "")) {
    problems.push(
      `pre-paint background not applied (got ${JSON.stringify(html.style.background)})`,
    );
  }

  if (accent) {
    if (html.dataset.accent !== accent) {
      problems.push(`data-accent not set to "${accent}"`);
    }
    if (!properties["--tag-cs"] || !properties["--tag-math"]) {
      problems.push("tag colours were not set");
    }
  }

  return problems;
}

for (const [, attrs, code] of blocks) {
  if (/\bsrc\s*=/.test(attrs)) continue; // external module, not ours to parse
  if (!code.trim()) continue;

  checked += 1;
  try {
    new vm.Script(code, { filename: "index.html (inline script)" });
  } catch (error) {
    failed += 1;
    console.error(`${target}: inline <script> failed to parse`);
    if (error.stack) console.error(error.stack);
    continue;
  }

  if (!code.includes("paperrec_accent")) continue; // not the pre-paint script

  const accents = [...code.matchAll(/(\w+): \{\s*accent:/g)].map((m) => m[1]);
  const scenarios = [
    { accent: null, booted: false },
    { accent: null, booted: true },
    ...accents.flatMap((accent) => [
      { accent, booted: false },
      { accent, booted: true },
    ]),
  ];

  for (const { accent, booted } of scenarios) {
    ran += 1;
    const problems = smoke(code, accent, booted);
    if (problems.length > 0) {
      failed += 1;
      console.error(
        `${target}: pre-paint script, accent=${accent ?? "(none)"} booted=${booted}:`,
      );
      problems.forEach((problem) => console.error(`  - ${problem}`));
    }
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} inline script check(s) in index.html failed.`,
  );
  process.exit(1);
}

console.log(
  `inline scripts: ${checked} block(s) in index.html parse cleanly; pre-paint script ran clean in ${ran} scenario(s)`,
);
