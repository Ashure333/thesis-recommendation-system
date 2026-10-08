/**
 * WIKI MEDIA — Bulbapedia-style images for the walkthrough pages.
 *
 *   <WikiThumb id="repository" float="right" />   a captioned thumbnail the
 *       text wraps around; click it for the full-screen viewer
 *   <WikiGallery ids={[...]} />                    a captioned grid of shots
 *   <WikiNote kind="tip">…</WikiNote>              a boxed aside
 *   <WikiHatnote>…</WikiHatnote>                   the italic "Main article" line
 *
 * Every image comes from the catalog in shots.ts, so a caption is written
 * once and the viewer steps through all of them in the catalog's order.
 */

import { Link } from "react-router-dom";

import { useSiteMode } from "../../state/siteMode";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useLightbox, type LightboxItem } from "./lightbox";
import { SHOTS, shotById, shotUrl } from "./shots";

const OpenContext = createContext<(id: string, from: HTMLElement | null) => void>(
  () => {},
);

export function WikiMediaProvider({ children }: { children: ReactNode }) {
  const { open, element } = useLightbox();
  const items = useMemo<LightboxItem[]>(
    () =>
      SHOTS.map((shot) => ({
        title: shot.title,
        caption: shot.caption,
        src: shotUrl(shot.id),
      })),
    [],
  );
  const openId = useCallback(
    (id: string, from: HTMLElement | null) => {
      const index = SHOTS.findIndex((shot) => shot.id === id);

      open(items, Math.max(0, index), from);
    },
    [open, items],
  );

  return (
    <OpenContext.Provider value={openId}>
      {children}
      {element}
    </OpenContext.Provider>
  );
}

function Magnifier() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 shrink-0">
      <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 10 L14.5 14.5" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

const FLOAT: Record<"right" | "left" | "center", string> = {
  // Floats never sit beside each other (clear-both) and never take more than
  // 45% of the column, so the text beside them keeps a readable measure.
  right: "mb-3 w-full sm:clear-both sm:float-right sm:ml-5 sm:w-[var(--thumb-w)] sm:max-w-[45%]",
  left: "mb-3 w-full sm:clear-both sm:float-left sm:mr-5 sm:w-[var(--thumb-w)] sm:max-w-[45%]",
  center: "mx-auto my-4 w-full max-w-[var(--thumb-w)]",
};

export function WikiThumb({
  id,
  float = "right",
  width = 320,
  caption,
}: {
  id: string;
  float?: "right" | "left" | "center";
  /** Thumbnail width in px on wide screens. */
  width?: number;
  /** Replaces the catalog caption for this placement. */
  caption?: string;
}) {
  const open = useContext(OpenContext);
  const shot = shotById(id);
  const [ratio, setRatio] = useState<number | null>(null);

  if (!shot) return null;

  // A tall, narrow screenshot would leave a long empty strip beside a short
  // paragraph, so a floated thumbnail is kept to about 400 px of image height.
  const shown =
    float !== "center" && ratio !== null && ratio < 1
      ? Math.max(Math.min(width, Math.round(400 * ratio)), 150)
      : width;

  return (
    <figure
      className={`${FLOAT[float]} overflow-hidden rounded border-[3px] border-gray-900 bg-white`}
      style={{ ["--thumb-w" as string]: `${shown}px` }}
    >
      <button
        type="button"
        onClick={(event) => open(id, event.currentTarget)}
        aria-label={`Open ${shot.title} full screen`}
        className="block w-full cursor-zoom-in border-b-[3px] border-gray-900 bg-canvas transition-colors pixel-ease hover:bg-accentSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-gray-900"
      >
        <img
          src={shotUrl(id)}
          alt={shot.title}
          loading="lazy"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;

            if (naturalWidth > 0) setRatio(naturalWidth / naturalHeight);
          }}
          className="block w-full"
        />
      </button>
      <figcaption className="bg-surface p-2">
        <p className="flex items-center gap-1.5 font-pixelify text-xs font-bold text-ink">
          <Magnifier />
          {shot.title}
        </p>
        <p className="mt-0.5 text-[11px] leading-4 text-muted">
          {caption ?? shot.caption}
        </p>
      </figcaption>
    </figure>
  );
}

export function WikiGallery({
  title,
  ids,
  cols = 3,
}: {
  title?: string;
  ids: string[];
  cols?: 1 | 2 | 3 | 4;
}) {
  const open = useContext(OpenContext);
  const grid = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];

  return (
    <div className="clear-both overflow-hidden rounded border-[3px] border-gray-900 bg-white">
      {title && (
        <p className="border-b-[3px] border-gray-900 bg-gray-900 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-onInk">
          {title}
        </p>
      )}
      <div className={`grid gap-3 p-3 ${grid}`}>
        {ids.map((id) => {
          const shot = shotById(id);

          if (!shot) return null;

          return (
            <figure key={id} className="overflow-hidden rounded border-2 border-gray-900 bg-white">
              <button
                type="button"
                onClick={(event) => open(id, event.currentTarget)}
                aria-label={`Open ${shot.title} full screen`}
                className="block w-full cursor-zoom-in border-b-2 border-gray-900 bg-canvas transition-colors pixel-ease hover:bg-accentSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-gray-900"
              >
                <img src={shotUrl(id)} alt={shot.title} loading="lazy" className="block w-full" />
              </button>
              <figcaption className="bg-surface p-2">
                <p className="font-pixelify text-xs font-bold text-ink">{shot.title}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted">{shot.caption}</p>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

const NOTE_STYLE = {
  tip: ["TIP", "border-accent"],
  note: ["NOTE", "border-gray-900"],
  warn: ["HEADS UP", "border-gray-900"],
} as const;

export function WikiNote({
  kind = "note",
  children,
}: {
  kind?: keyof typeof NOTE_STYLE;
  children: ReactNode;
}) {
  const [label, border] = NOTE_STYLE[kind];

  return (
    <aside
      className={`clear-both rounded border-l-[6px] ${border} border-y-2 border-r-2 border-y-gray-300 border-r-gray-300 bg-surface px-3 py-2 text-sm leading-6 text-ink`}
    >
      <span className="mr-2 rounded border-2 border-gray-900 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.15em] text-ink">
        {label}
      </span>
      {children}
    </aside>
  );
}

export function WikiHatnote({ children }: { children: ReactNode }) {
  return (
    <p className="clear-both pl-3 text-xs italic leading-5 text-muted">{children}</p>
  );
}

export function WikiSteps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="space-y-2 text-sm leading-6 text-ink">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded border-2 border-gray-900 bg-accent font-mono text-xs font-bold text-onAccent">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** A Bulbapedia-style navigation box: every page, grouped. */
export function WikiNavbox({
  title,
  groups,
}: {
  title: string;
  groups: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]>;
}) {
  return (
    <div className="clear-both overflow-hidden rounded border-[3px] border-gray-900 bg-white text-xs">
      <p className="border-b-[3px] border-gray-900 bg-accent px-3 py-1.5 text-center font-mono font-bold uppercase tracking-[0.15em] text-onAccent">
        {title}
      </p>
      <dl>
        {groups.map(([name, links]) => (
          <div key={name} className="flex border-b border-gray-200 last:border-b-0">
            <dt className="w-32 shrink-0 bg-surface px-3 py-2 font-mono font-bold text-muted">{name}</dt>
            <dd className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1 px-3 py-2">
              {links.map(([to, label]) => (
                to.startsWith("#") ? (
                  <a key={to} href={to} className="font-bold text-ink underline decoration-dotted hover:text-accent">
                    {label}
                  </a>
                ) : (
                  <Link key={to} to={to} className="font-bold text-ink underline decoration-dotted hover:text-accent">
                    {label}
                  </Link>
                )
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A body paragraph. */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-ink">{children}</p>;
}

/** A link to another walkthrough page (and a place on it). */
export function Xref({ to, children }: { to: string; children: ReactNode }) {
  const { canAccess } = useSiteMode();
  const feature = to.startsWith("/walkthrough-engine") ? "engine" : to.startsWith("/walkthrough") ? "walkthrough" : null;

  // A manual that this site mode hides is not worth a link.
  if (feature && !canAccess(feature)) return <>{children}</>;

  return (
    <Link to={to} className="font-bold text-ink underline decoration-dotted hover:text-accent">
      {children}
    </Link>
  );
}
