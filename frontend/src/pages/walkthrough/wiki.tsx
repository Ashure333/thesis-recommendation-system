import { Link } from "react-router-dom";
import { BlockCursor, ArrowRight } from "../../components/retro/PixelIcons";

/* ============================================================
   WIKI LAYOUT PRIMITIVES — shared by the walkthrough pages.
   Bulbapedia-style: sticky contents rail, infobox, sectioned
   content, detailed tables, category chips.
   ============================================================ */

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded border-2 border-gray-900 bg-surface px-1.5 py-0.5 font-mono text-xs font-bold text-ink">
      {children}
    </span>
  );
}

export function WikiInfobox({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full border-[3px] border-gray-900 bg-white text-left text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b-2 border-gray-200 last:border-b-0">
            <th className="w-24 border-r-2 border-gray-200 bg-surface px-2 py-1.5 align-top text-xs font-bold uppercase tracking-wide text-muted">
              {label}
            </th>
            <td className="px-2 py-1.5 font-medium leading-5 text-ink">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function WikiHeader({
  eyebrow,
  title,
  description,
  categories,
}: {
  eyebrow: string;
  title: string;
  description: string;
  categories: string[];
}) {
  return (
    <header className="mb-8">
      <p className="mb-2 text-sm font-bold tracking-[0.2em] text-muted">{eyebrow}</p>
      <h1 className="text-3xl font-bold leading-none tracking-tighter text-ink sm:text-4xl">
        {title}
        <BlockCursor className="animate-blink ml-2 inline-block h-[0.9em] w-[0.55em] text-accent" />
      </h1>
      <p className="mt-3 max-w-3xl text-base leading-6 text-muted">{description}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <span
            key={category}
            className="rounded border-2 border-gray-900 bg-surface px-2 py-0.5 font-mono text-xs font-bold text-muted"
          >
            {category}
          </span>
        ))}
      </div>
    </header>
  );
}

export function WikiNav({
  toc,
  otherPages,
}: {
  toc: readonly (readonly [string, string])[];
  otherPages: readonly (readonly [string, string])[];
}) {
  return (
    <nav aria-label="Walkthrough contents" className="lg:sticky lg:top-4 lg:h-fit lg:w-56 lg:shrink-0">
      <div className="rounded border-[3px] border-gray-900 bg-white">
        <p className="border-b-[3px] border-gray-900 bg-gray-900 px-3 py-2 font-mono text-xs font-bold tracking-[0.2em] text-onInk">
          CONTENTS
        </p>
        <ol className="space-y-1 p-3 font-mono text-xs">
          {toc.map(([id, label], index) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="flex items-baseline gap-2 rounded px-1 py-0.5 text-ink transition-colors pixel-ease hover:bg-accentSoft hover:text-accent"
              >
                <span className="text-muted">{index + 1}.</span>
                <span className="font-bold">{label}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 rounded border-[3px] border-gray-900 bg-white p-3">
        <p className="mb-1.5 font-mono text-xs font-bold tracking-[0.2em] text-accent">
          OTHER PAGES
        </p>
        <div className="flex flex-wrap gap-1.5">
          {otherPages.map(([to, label]) => (
            <Link
              key={to}
              to={to}
              className="rounded border-2 border-gray-900 bg-surface px-1.5 py-0.5 font-mono text-xs font-bold text-ink transition-colors pixel-ease hover:bg-accent hover:text-onAccent"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

export function WikiSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="border-b-[3px] border-gray-900 pb-1 text-2xl font-bold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function WikiSub({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h3 className="border-b-2 border-gray-300 pb-0.5 text-lg font-bold text-ink">
        {title}
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function WikiTable({
  headers,
  rows,
}: {
  headers: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string | React.ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded border-[3px] border-gray-900 bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b-[3px] border-gray-900 bg-gray-900 text-onInk">
            {headers.map((header) => (
              <th
                key={header}
                className="px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.15em]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className={`border-b border-gray-200 last:border-b-0 ${
                index % 2 === 1 ? "bg-canvas" : "bg-white"
              }`}
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top leading-5 text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WikiFooter({ ctaTo, ctaLabel }: { ctaTo: string; ctaLabel: string }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 rounded border-[3px] border-gray-900 bg-white p-4">
      <p className="font-mono text-xs font-bold tracking-[0.2em] text-muted">
        END OF WALKTHROUGH
      </p>
      <Link
        to={ctaTo}
        className="flex items-center gap-1.5 rounded border-[3px] border-gray-900 bg-accent px-3 py-1.5 font-mono text-xs font-bold tracking-[0.15em] text-onAccent transition-transform duration-100 pixel-ease hover:translate-x-0.5 hover:translate-y-0.5"
      >
        {ctaLabel}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </footer>
  );
}

export function MathBlock({ lines }: { lines: string[] }) {
  return (
    <pre className="overflow-x-auto rounded border-[3px] border-gray-900 bg-gray-900 p-3 font-mono text-xs leading-5 text-onInk">
      {lines.join("\n")}
    </pre>
  );
}