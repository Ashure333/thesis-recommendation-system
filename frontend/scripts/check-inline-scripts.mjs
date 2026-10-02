/**
 * Parse the inline <script> blocks in index.html.
 *
 * The pre-paint theme script lives in index.html, outside the
 * tsconfig "include" globs, so no type checker ever sees it. A syntax
 * error there does not fail `npm run build` -- it just silently
 * disables the theme flash prevention and throws "Unexpected number"
 * into the console. This closes that gap.
 *
 * Exits non-zero, with file and line numbers, when a block fails to
 * parse.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "index.html");

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
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} inline script block(s) in index.html failed to parse.`,
  );
  process.exit(1);
}

console.log(
  `inline scripts: ${checked} block(s) in index.html parse cleanly`,
);
