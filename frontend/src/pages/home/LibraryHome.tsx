/**
 * LIBRARY HOME — the Library Mode landing page.
 *
 * Announcements written in the site editor (/admin) appear here, in
 * admin-defined order. The hero search drops straight into the
 * ranked-search page, and the quick links only surface the features
 * the site editor currently shows.
 */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import AnnouncementsPanel from "../../components/AnnouncementsPanel";
import {
  SITE_FEATURES,
  type SiteFeatureMeta,
} from "../../data/siteFeatures";
import { useSiteMode } from "../../state/siteMode";
import StaggerIn from "../../components/retro/StaggerIn";
import { ArrowRight } from "../../components/retro/PixelIcons";

const HOME_LINK_KEYS = ["search", "repository", "library", "faq"];

export default function LibraryHome() {
  const navigate = useNavigate();
  const { mode, stateFor, setMode } = useSiteMode();

  const [query, setQuery] = useState("");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = query.trim();

    if (!trimmed) {
      return;
    }

    navigate("/recommendations", {
      state: { mode: "keyword", query: trimmed },
    });
  }

  const quickLinks = SITE_FEATURES.filter(
    (feature) =>
      HOME_LINK_KEYS.includes(feature.key) &&
      stateFor(feature.key) === "shown"
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      {/* ------------------------------------------------------
          HERO
          ------------------------------------------------------ */}

      <StaggerIn>
        <section className="rounded border-[3px] border-gray-900 bg-white p-6 sm:p-8">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
            {mode === "library" ? "Library mode" : "Researcher mode"}
          </p>

          <h1 className="font-pixelify mt-2 text-3xl font-bold leading-none text-ink">
            Welcome to the library
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Enter a topic, a title, or a paper. The system ranks
            the collection for you. No pipeline setup is necessary.
          </p>

          <form
            onSubmit={handleSearch}
            className="mt-5 flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. neural network text similarity"
              aria-label="Search the library"
              className="ui-input min-w-0 flex-1"
            />

            <button
              type="submit"
              className="ui-button ui-button-primary shrink-0"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Search
            </button>
          </form>
        </section>
      </StaggerIn>

      {/* ------------------------------------------------------
          ANNOUNCEMENTS
          ------------------------------------------------------ */}

      <StaggerIn>
        <AnnouncementsPanel />
      </StaggerIn>

      {/* ------------------------------------------------------
          QUICK LINKS
          ------------------------------------------------------ */}

      {quickLinks.length > 0 && (
        <StaggerIn>
          <section>
            <h2 className="font-pixelify mb-3 text-xl font-bold text-ink">
              Start here
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {quickLinks.map((feature) => (
                <QuickLink key={feature.key} feature={feature} />
              ))}
            </div>
          </section>
        </StaggerIn>
      )}

      {/* ------------------------------------------------------
          MODE HINT
          ------------------------------------------------------ */}

      {mode === "library" && (
        <StaggerIn>
          <section className="flex flex-col items-start justify-between gap-3 rounded border-[3px] border-dashed border-gray-900 bg-canvas p-4 sm:flex-row sm:items-center">
            <p className="text-sm text-muted">
              Need the full toolkit — pipeline battles, weight
              tuning, uploads?
            </p>

            <button
              type="button"
              onClick={() => setMode("researcher")}
              className="ui-button ui-button-secondary shrink-0"
            >
              Switch to Researcher mode
            </button>
          </section>
        </StaggerIn>
      )}
    </div>
  );
}

function QuickLink({ feature }: { feature: SiteFeatureMeta }) {
  return (
    <Link
      to={feature.path}
      className="group flex items-start justify-between gap-3 rounded border-[3px] border-gray-900 bg-white p-4 transition-colors pixel-ease hover:bg-accentSoft"
    >
      <span className="min-w-0">
        <span className="font-pixelify block text-base font-bold text-ink">
          {feature.label}
        </span>

        <span className="mt-1 block text-sm text-muted">
          {feature.blurb}
        </span>
      </span>

      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
    </Link>
  );
}
