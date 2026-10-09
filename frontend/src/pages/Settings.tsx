/**
 * SETTINGS — the preferences tab.
 *
 * Citation style chosen here becomes the default for the context
 * menu's "Copy as → Formatted citation", and the copy-behavior
 * toggles shape the BibTeX / DOI output. Preferences are stored in
 * this browser (utils/preferences.ts).
 */

import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import DevPanel from "../components/DevPanel";

import { useSiteMode } from "../state/siteMode";
import { useLayoutPrefs } from "../state/layoutPrefs";
import {
  CITATION_STYLES,
  readSettings,
  writeSettings,
  type CitationStyle,
} from "../utils/preferences";

const SCOPE_KEY = "paperrec_connections_scope";

function readScope(): "local" | "web" {
  try {
    return window.localStorage.getItem(SCOPE_KEY) === "web"
      ? "web"
      : "local";
  } catch {
    return "local";
  }
}

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "dev" ? "dev" : "preferences";
  const { mode, setMode } = useSiteMode();
  const { prefs, setNavLabels } = useLayoutPrefs();

  const [settings, setSettings] = useState(readSettings);
  const [scope, setScope] = useState<"local" | "web">(readScope);
  const [petVisible, setPetVisible] = useState(() => {
    try {
      return window.localStorage.getItem("paperrec_pet_visible") !== "0";
    } catch {
      return true;
    }
  });

  function togglePet() {
    const next = !petVisible;
    setPetVisible(next);

    try {
      window.localStorage.setItem(
        "paperrec_pet_visible",
        next ? "1" : "0"
      );
    } catch {
      // Best-effort.
    }

    window.dispatchEvent(new Event("paperrec-settings-changed"));
  }

  function update(patch: Parameters<typeof writeSettings>[0]) {
    setSettings(writeSettings(patch));
  }

  function updateScope(next: "local" | "web") {
    setScope(next);

    try {
      window.localStorage.setItem(SCOPE_KEY, next);
    } catch {
      // Best-effort.
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
          Preferences
        </p>

        <h1 className="font-pixelify mt-2 text-3xl font-bold leading-none text-ink">
          Settings
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          These preferences stay in this browser. The citation
          style sets the default for Copy as → Formatted citation
          in the paper context menu.
        </p>

        <div role="tablist" aria-label="Settings pages" className="mt-4 flex gap-1.5">
          {(
            [
              ["preferences", "Preferences"],
              ["dev", "Developer"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setParams(id === "dev" ? { tab: "dev" } : {})}
              className={`rounded border-[3px] border-gray-900 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.12em] transition-colors pixel-ease ${
                tab === id ? "bg-accent text-onAccent" : "bg-white text-ink hover:bg-accentSoft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === "dev" && <DevPanel />}

      {tab === "preferences" && (
        <>
      {/* MODE — moved here from the top bar */}
      <section
        data-settings-section="mode"
        className="rounded border-[3px] border-gray-900 bg-white p-5"
      >
        <h2 className="font-pixelify text-xl font-bold text-ink">
          Site mode
        </h2>

        <p className="mt-1 text-sm text-muted">
          Library mode is the visitor-friendly librarian with the feature
          set the admin exposes; Researcher mode is the full pro tool and
          ignores feature locks. Switching is instant and persists in this
          browser.
        </p>

        <div
          role="radiogroup"
          aria-label="Site mode"
          className="mt-4 flex w-full max-w-full flex-col rounded border-[3px] sm:w-fit sm:flex-row border-gray-900 bg-white p-0.5"
        >
          {(
            [
              ["library", "LIBRARY", "Visitor view"],
              ["researcher", "RESEARCHER", "Full pro tool"],
              ["presentation", "PRESENTATION", "Shipped, free version"],
            ] as const
          ).map(([id, label, hint]) => {
            const active = mode === id;

            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(id)}
                className={`rounded border-[3px] px-4 py-2 text-left transition-colors pixel-ease ${
                  active
                    ? "border-gray-900 bg-accent text-onAccent"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <span className="block font-mono text-xs font-bold uppercase tracking-[0.12em]">
                  {label}
                </span>
                <span
                  className={`mt-0.5 block text-[11px] ${
                    active ? "text-onAccent/80" : ""
                  }`}
                >
                  {hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* INTERFACE */}
      <section
        data-settings-section="interface"
        className="rounded border-[3px] border-gray-900 bg-white p-5"
      >
        <h2 className="font-pixelify text-xl font-bold text-ink">
          Interface
        </h2>

        <label className="mt-3 flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={prefs.navLabels}
            onChange={(event) => setNavLabels(event.target.checked)}
          />

          <span>
            <span className="font-bold">Show menu labels in the top bar</span>
            <span className="mt-0.5 block text-muted">
              Turn this off for an icon-only navigation; the title of
              each item remains available as a tooltip and to screen
              readers.
            </span>
          </span>
        </label>
      </section>

      {/* CITATION STYLE */}
      <section
        data-settings-section="citation-style"
        className="rounded border-[3px] border-gray-900 bg-white p-5"
      >
        <h2 className="font-pixelify text-xl font-bold text-ink">
          Preferred citation style
        </h2>

        <p className="mt-1 text-sm text-muted">
          Used when copying a formatted citation from selected
          papers.
        </p>

        <div
          role="radiogroup"
          aria-label="Preferred citation style"
          className="mt-4 grid gap-2 sm:grid-cols-2"
        >
          {CITATION_STYLES.map((style) => {
            const active = settings.citationStyle === style.id;

            return (
              <button
                key={style.id}
                type="button"
                role="radio"
                aria-checked={active}
                data-citation-style={style.id}
                onClick={() =>
                  update({ citationStyle: style.id as CitationStyle })
                }
                className={`rounded border-[3px] border-gray-900 p-3 text-left transition-colors pixel-ease ${
                  active
                    ? "bg-accent text-onAccent"
                    : "bg-surface text-ink hover:bg-accentSoft"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{style.label}</span>

                  {active && (
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
                      Default
                    </span>
                  )}
                </span>

                <span
                  className={`mt-1 block text-xs leading-5 ${
                    active ? "text-onAccent" : "text-muted"
                  }`}
                >
                  {style.sample}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* COPY BEHAVIOR */}
      <section
        data-settings-section="copy"
        className="rounded border-[3px] border-gray-900 bg-white p-5"
      >
        <h2 className="font-pixelify text-xl font-bold text-ink">
          Copy behavior
        </h2>

        <div className="mt-3 flex flex-col gap-3">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={settings.citationIncludeDoi}
              onChange={(event) =>
                update({
                  citationIncludeDoi: event.target.checked,
                })
              }
            />

            <span>
              <span className="font-bold">
                Include DOI links in formatted citations
              </span>
              <span className="mt-0.5 block text-muted">
                Adds https://doi.org/… to APA, MLA, Chicago, and IEEE
                citations.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={settings.bibtexIncludeAbstract}
              onChange={(event) =>
                update({
                  bibtexIncludeAbstract: event.target.checked,
                })
              }
            />

            <span>
              <span className="font-bold">
                Include abstracts in copied BibTeX
              </span>
              <span className="mt-0.5 block text-muted">
                Batch file exports from My Library are unchanged.
              </span>
            </span>
          </label>
        </div>
      </section>

      {/* PIXEL PET */}
      <section
        data-settings-section="pet"
        className="rounded border-[3px] border-gray-900 bg-white p-5"
      >
        <h2 className="font-pixelify text-xl font-bold text-ink">
          Pixel pet
        </h2>

        <label className="mt-3 flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={petVisible}
            onChange={togglePet}
          />

          <span>
            <span className="font-bold">Show the pixel pet companion</span>
            <span className="mt-0.5 block text-muted">
              The pet sits in the corner, shows tips, and removes
              papers that you drag onto it. Turn it off for a
              distraction-free view.
            </span>
          </span>
        </label>
      </section>

      {/* CONNECTIONS */}
      <section
        data-settings-section="connections"
        className="rounded border-[3px] border-gray-900 bg-white p-5"
      >
        <h2 className="font-pixelify text-xl font-bold text-ink">
          Similar-papers scope
        </h2>

        <p className="mt-1 text-sm text-muted">
          Which source the connections pane opens with. Local is the
          repository graph; Web reads live from OpenAlex.
        </p>

        <div
          role="radiogroup"
          aria-label="Default connections scope"
          className="mt-3 flex w-fit rounded border-[3px] border-gray-900 bg-white p-0.5"
        >
          {(["local", "web"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={scope === option}
              onClick={() => updateScope(option)}
              className={`rounded px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] transition-colors pixel-ease ${
                scope === option
                  ? "bg-accent text-onAccent"
                  : "text-muted hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted">
        Current mode:{" "}
        <span className="font-bold text-ink">
          {mode === "library" ? "Library" : mode === "presentation" ? "Presentation" : "Researcher"}
        </span>{" "}
        — switch it in the Site mode section above.
      </p>
        </>
      )}
    </div>
  );
}
