import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  getRecommendationIndexStatus,
} from "../api";

import RecommendationIndexAlert from "../components/RecommendationIndexAlert";


// ============================================================
// SHARED APP NAVIGATION
// ============================================================

const libraryCount = 4;

const activePipelineLabel =
  "TF-IDF + S-BERT + Metadata";


const navItems = [
  {
    to: "/search",
    label: "Search",
  },
  {
    to: "/repository",
    label: "Repository",
  },
  {
    to: "/recommendations",
    label: "Recommendations",
  },
  {
    to: "/upload",
    label: "Upload",
  },
  {
    to: "/library",
    label: "My Library",
    badge: libraryCount,
  },
  {
    to: "/evaluation",
    label: "Evaluation",
  },
];


// ============================================================
// APP LAYOUT
// ============================================================

export default function AppLayout() {

  const location = useLocation();


  // ----------------------------------------------------------
  // Special full-screen UI
  // ----------------------------------------------------------
  //
  // LibraryUITest owns the entire available page area.
  //
  // Normal pages continue using the existing centered layout.
  //

  const isLibraryUITest =
    location.pathname === "/library-ui-test";


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

    <div className="flex min-h-screen w-full flex-col bg-navy">


      {/* ======================================================
          TOP NAVIGATION
          ====================================================== */}

      <header className="flex shrink-0 items-center justify-between border-b border-line bg-panel px-6 py-3">

        {/* ----------------------------------------------------
            LEFT SIDE
            ---------------------------------------------------- */}

        <div className="flex items-center gap-8">


          {/* Logo */}

          <div className="flex items-center gap-2">

            <span className="flex h-7 w-7 items-center justify-center rounded bg-gold/20 font-serif text-sm text-gold">
              R
            </span>


            <div className="leading-tight">

              <p className="text-sm font-medium text-ink">
                PaperRec
              </p>

              <p className="text-[10px] uppercase tracking-wide text-muted">
                BulSU BSMCS
              </p>

            </div>

          </div>


          {/* Navigation */}

          <nav className="flex gap-1">

            {navItems.map((item) => (

              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-panelAlt text-ink"
                      : "text-muted hover:text-ink",
                  ].join(" ")
                }
              >

                {item.label}


                {item.badge !== undefined && (

                  <span className="rounded bg-gold/20 px-1.5 text-xs text-gold">

                    {item.badge}

                  </span>

                )}

              </NavLink>

            ))}

          </nav>

        </div>


        {/* ----------------------------------------------------
            ACTIVE PIPELINE
            ---------------------------------------------------- */}

        <div className="rounded border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold">

          Pipeline: {activePipelineLabel}

        </div>

      </header>


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

      {isLibraryUITest ? (

        /*
         * ====================================================
         * FULL-SCREEN PAGE
         * ====================================================
         *
         * DO NOT put:
         *
         *   mx-auto
         *   max-w-[1400px]
         *   px-6
         *   py-8
         *
         * here.
         *
         * LibraryUITest is a 3-pane application-style interface
         * and needs to occupy the entire available viewport.
         */

        <main className="min-h-0 w-full flex-1 overflow-hidden p-0">

          <Outlet />

        </main>

      ) : (

        /*
         * ====================================================
         * NORMAL PAGES
         * ====================================================
         *
         * Keep the existing application layout for every
         * other page.
         */

        <main className="mx-auto w-full max-w-[1400px] px-6 py-8">

          <Outlet />

        </main>

      )}

    </div>

  );

}