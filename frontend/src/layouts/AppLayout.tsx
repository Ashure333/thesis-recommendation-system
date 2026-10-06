import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  getRecommendationIndexStatus,
  getLibrary,
} from "../api";

import RecommendationIndexAlert from "../components/RecommendationIndexAlert";
import AccentPicker from "../components/AccentPicker";
import SlimeLogo from "../components/retro/SlimeLogo";
import MarqueeTicker from "../components/retro/MarqueeTicker";
import ScrollFollowPopup from "../components/retro/ScrollFollowPopup";
import PixelPet from "../components/retro/PixelPet";
import { ArrowRight, BlockCursor, Dot, Lock } from "../components/retro/PixelIcons";
import {
  Cpu,
  Database,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  Library,
  ScrollText,
  Search as SearchIcon,
  Settings,
  Swords,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { pipelineConfigs, customPipelineConfig } from "../data/pipelineConfigs";
import { usePipelineMode } from "../state/pipelineMode";
import { useSiteMode } from "../state/siteMode";


// ============================================================
// SHARED APP NAVIGATION
// ============================================================

/** Temporary walkthrough tab — flip to false to hide it. */
const SHOW_WALKTHROUGH_TAB = true;

/** Temporary engine walkthrough tab — flip to false to hide it. */
const SHOW_ENGINE_TAB = true;

const navItems = [
  {
    to: "/recommendations",
    label: "Search",
    icon: SearchIcon,
    tip: "nav-search",
    feature: "search",
  },
  {
    to: "/repository",
    label: "Repository",
    icon: Database,
    tip: "nav-repository",
    feature: "repository",
  },
  {
    to: "/upload",
    label: "Upload",
    icon: Upload,
    tip: "nav-upload",
    feature: "upload",
  },
  {
    to: "/library",
    label: "My Library",
    icon: Library,
    badge: true,
    tip: "nav-library",
    feature: "library",
  },
  {
    to: "/evaluation",
    label: "Arena",
    icon: Swords,
    tip: "nav-evaluation",
    feature: "arena",
  },
  {
    to: "/lab",
    label: "Lab",
    icon: FlaskConical,
    tip: "nav-lab",
    feature: "lab",
  },
  ...(SHOW_WALKTHROUGH_TAB
    ? [
        {
          to: "/walkthrough",
          label: "Walkthrough",
          icon: GraduationCap,
          tip: "nav-walkthrough",
          feature: "walkthrough",
        },
      ]
    : []),
  ...(SHOW_ENGINE_TAB
    ? [
        {
          to: "/walkthrough-engine",
          label: "Engine",
          icon: Cpu,
          tip: "nav-engine",
          feature: "engine",
        },
      ]
    : []),
  {
    to: "/faq",
    label: "FAQ",
    icon: HelpCircle,
    tip: "nav-faq",
    feature: "faq",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    tip: "nav-settings",
    feature: "settings",
  },
  {
    to: "/changelog",
    label: "Changelog",
    icon: ScrollText,
    tip: "nav-changelog",
    feature: "changelog",
  },
] as {
  to: string;
  label: string;
  icon?: LucideIcon;
  tip: string;
  feature: string;
  badge?: boolean;
}[];


const NAV_LINK =
  "font-pixelify flex shrink-0 items-center gap-1.5 rounded border-[3px] px-2.5 py-1.5 lg:px-3 " +
  "text-sm font-semibold text-ink pixel-ease " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-gray-900";


// ============================================================
// APP LAYOUT
// ============================================================

export default function AppLayout() {

  const location = useLocation();
  const contentRef = useRef<HTMLElement | null>(null);

  const { pipelineId, customWeights } = usePipelineMode();
  const { mode, setMode, stateFor } = useSiteMode();

  // ----------------------------------------------------------
  // Live library count for the nav badge
  // ----------------------------------------------------------

  const [libraryCount, setLibraryCount] = useState(0);

  useEffect(() => {
    getLibrary()
      .then((entries) => setLibraryCount(entries.length))
      .catch(() => setLibraryCount(0));
  }, []);

  // Refresh the badge whenever a paper is saved/removed.
  useEffect(() => {
    function handleLibraryChange() {
      getLibrary()
        .then((entries) => setLibraryCount(entries.length))
        .catch(() => setLibraryCount(0));
    }

    window.addEventListener("library-changed", handleLibraryChange);
    return () => window.removeEventListener("library-changed", handleLibraryChange);
  }, []);

  const activePipelineConfig =
    pipelineId === "custom"
      ? customPipelineConfig(customWeights)
      : pipelineConfigs.find(
          (config) => config.id === pipelineId,
        ) ?? pipelineConfigs[pipelineConfigs.length - 1];

  const activePipelineLabel =
    activePipelineConfig.codename;


  // ----------------------------------------------------------
  // Recommendation index state
  // ----------------------------------------------------------

  const [
    recommendationIndexStale,
    setRecommendationIndexStale,
  ] = useState(false);


  async function refreshRecommendationIndexStatus() {

    try {

      const status =
        await getRecommendationIndexStatus();

      setRecommendationIndexStale(
        status.stale
      );

    } catch (error) {

      console.error(
        "Failed to get recommendation index status:",
        error
      );

    }

  }


  useEffect(() => {

    // Check current index state when the
    // application layout loads.

    refreshRecommendationIndexStatus();


    // Listen for paper changes anywhere
    // in the application.

    function handleRecommendationIndexStale() {

      setRecommendationIndexStale(
        true
      );

    }


    window.addEventListener(
      "recommendation-index-stale",
      handleRecommendationIndexStale
    );


    return () => {

      window.removeEventListener(
        "recommendation-index-stale",
        handleRecommendationIndexStale
      );

    };

  }, []);


  function handleRebuilt() {

    setRecommendationIndexStale(
      false
    );

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div
      data-site-mode={mode}
      className="flex h-screen w-full flex-col overflow-hidden bg-canvas text-ink"
    >


      {/* ======================================================
          TOP NAVIGATION
          3px ink outline · cream bar · accent = active fill
          ====================================================== */}

      <header className="flex shrink-0 items-center justify-between gap-4 border-b-[3px] border-gray-900 bg-canvas px-4 py-2.5 sm:px-6">

        {/* ----------------------------------------------------
            LEFT SIDE
            ---------------------------------------------------- */}

        <div className="flex min-w-0 items-center gap-3 lg:gap-8">


          {/* Logo — the animated slime mark + glitching pixel title */}

          <Link
            to="/recommendations"
            className="flex shrink-0 items-center gap-2.5"
          >

            <SlimeLogo />

            <p className="font-pixelify animate-glitch hidden text-base font-bold tracking-wide text-ink lg:block">
              RE:SEARCH
              <BlockCursor className="animate-blink ml-1 inline-block h-[0.9em] w-[0.55em] text-accent" />
            </p>

          </Link>


          {/* Navigation */}

          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">

            {navItems.map((item) => {
              const state = stateFor(item.feature);

              if (state === "hidden") {
                return null;
              }

              const locked = state === "locked";

              return (
              <NavLink
                key={item.to}
                to={item.to}
                data-tips={item.tip}
                data-feature-state={state}
                title={
                  locked
                    ? "Available in Researcher mode."
                    : undefined
                }
                className={({ isActive }) =>
                  [
                    NAV_LINK,
                    locked
                      ? "opacity-55 hover:bg-transparent"
                      : isActive
                        ? "border-gray-900 bg-accent text-onAccent"
                        : "border-transparent hover:bg-accentSoft",
                  ].join(" ")
                }
              >

                {({ isActive }) => (
                  <>
                    {locked ? (
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                    ) : isActive ? (
                      <ArrowRight className="animate-blink h-2.5 w-2.5 shrink-0" />
                    ) : item.icon ? (
                      <item.icon
                        className="h-3.5 w-3.5 shrink-0 text-muted"
                        aria-hidden="true"
                      />
                    ) : null}

                    {item.label}


                    {item.badge && libraryCount > 0 && (

                      <span className="rounded border-[2px] border-gray-900 bg-white px-1.5 text-xs font-bold text-ink">

                        {libraryCount}

                      </span>

                    )}
                  </>
                )}

              </NavLink>
              );
            })}

          </nav>

        </div>


        {/* ----------------------------------------------------
            RIGHT SIDE — pipeline + theme color
            ---------------------------------------------------- */}

        <div className="flex shrink-0 items-center gap-2.5">

          {/* Site mode toggle — Library (visitor) vs Researcher (pro) */}

          <div
            role="radiogroup"
            aria-label="Site mode"
            data-tips="site-mode"
            className="font-pixelify flex rounded border-[3px] border-gray-900 bg-white p-0.5 text-[11px] font-bold tracking-[0.08em]"
          >

            <button
              type="button"
              role="radio"
              aria-checked={mode === "library"}
              aria-label="Library mode"
              onClick={() => setMode("library")}
              className={`rounded px-2 py-1 transition-colors pixel-ease ${
                mode === "library"
                  ? "bg-accent text-onAccent"
                  : "text-muted hover:text-ink"
              }`}
            >
              LIBRARY
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={mode === "researcher"}
              aria-label="Researcher mode"
              onClick={() => setMode("researcher")}
              className={`rounded px-2 py-1 transition-colors pixel-ease ${
                mode === "researcher"
                  ? "bg-accent text-onAccent"
                  : "text-muted hover:text-ink"
              }`}
            >
              RESEARCHER
            </button>

          </div>

          <div
            title={`Pipeline: ${activePipelineConfig.label}`}
            data-tips="pipeline-chip"
            className="font-pixelify hidden rounded border-[3px] border-gray-900 bg-white px-3 py-1.5 text-xs font-bold tracking-[0.15em] text-ink xl:block"
          >

            <span className="flex items-center gap-1.5">
              <Dot className="animate-rec h-2 w-2 text-accent" />
              MODE: {activePipelineLabel}
            </span>

          </div>

          <AccentPicker />

        </div>

      </header>


      {/* ======================================================
          ARCADE ATTRACT TICKER
          ====================================================== */}

      <MarqueeTicker />


      {/* ======================================================
          RECOMMENDATION INDEX ALERT
          ====================================================== */}

      <RecommendationIndexAlert
        visible={
          recommendationIndexStale
        }
        onRebuilt={
          handleRebuilt
        }
      />


      {/* ======================================================
          PAGE CONTENT
          ====================================================== */}

      <PixelPet />

      <main
        ref={contentRef}
        key={`page:${location.pathname}`}
        className="animate-route-in mx-auto w-full max-w-[1560px] overflow-y-auto px-3 py-5 sm:px-5"
      >

        <Outlet />

      </main>

      <ScrollFollowPopup key={`scroll:${location.pathname}`} target={contentRef} />

    </div>

  );

}
