import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getRecommendationIndexStatus } from "../api";
import RecommendationIndexAlert from "../components/RecommendationIndexAlert";

const navItems = [
  { to: "/search", label: "Search" },
  { to: "/repository", label: "Repository" },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/upload", label: "Upload" },
  { to: "/library", label: "My Library" },
  { to: "/evaluation", label: "Evaluation" },
];

export default function AppLayout() {
  const navigate = useNavigate();

  const [recommendationIndexStale, setRecommendationIndexStale] =
    useState(false);

  const [accountOpen, setAccountOpen] = useState(false);

  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    getRecommendationIndexStatus()
      .then((status) => setRecommendationIndexStale(status.stale))
      .catch((error) =>
        console.error("Failed to get recommendation index status:", error),
      );

    const handleStale = () => setRecommendationIndexStale(true);

    window.addEventListener("recommendation-index-stale", handleStale);

    return () =>
      window.removeEventListener("recommendation-index-stale", handleStale);
  }, []);

  function handleLogout() {
    /*
     * Fake logout.
     *
     * We only remove the fake login information.
     * The repository/database is NOT touched.
     */
    localStorage.removeItem("paperrec_logged_in");
    localStorage.removeItem("paperrec_user_email");
    localStorage.removeItem("paperrec_user_name");
    localStorage.removeItem("paperrec_remember_me");

    setAccountOpen(false);

    navigate("/");
  }

  function openTour() {
    setAccountOpen(false);
    setTourOpen(true);
  }

  return (
    <div className="min-h-screen bg-navy">
      {/* ========================= */}
      {/* TOP NAVIGATION */}
      {/* ========================= */}

      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex min-h-16 max-w-[1400px] items-center gap-6 px-5 lg:px-6">
          {/* PaperRec Logo */}
          <NavLink
            to="/search"
            className="flex shrink-0 items-center gap-2.5"
            aria-label="PaperRec home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-gold/40 text-sm font-semibold text-gold">
              R
            </span>

            <span className="leading-tight">
              <span className="block text-sm font-semibold text-ink">
                PaperRec
              </span>

              <span className="block text-[10px] text-muted">BulSU BSMCS</span>
            </span>
          </NavLink>

          {/* Main Navigation */}
          <nav
            className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `shrink-0 border-b-2 px-3 py-5 text-sm transition-colors ${
                    isActive
                      ? "border-gold text-ink"
                      : "border-transparent text-muted hover:text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Pipeline */}
          <div className="hidden shrink-0 text-right xl:block">
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted">
              Current pipeline
            </p>

            <p className="mt-0.5 text-xs text-gold">
              TF-IDF + S-BERT + Metadata
            </p>
          </div>

          {/* ========================= */}
          {/* ACCOUNT BUTTON */}
          {/* ========================= */}

          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="Open account menu"
            aria-expanded={accountOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-navy text-muted transition hover:border-gold/50 hover:text-gold"
          >
            {/* User icon */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </header>

      {/* Recommendation alert */}
      <RecommendationIndexAlert
        visible={recommendationIndexStale}
        onRebuilt={() => setRecommendationIndexStale(false)}
      />

      {/* Main content */}
      <main className="mx-auto max-w-[1400px] px-5 py-7 lg:px-6 lg:py-9">
        <Outlet />
      </main>

      {/* ========================= */}
      {/* DARK OVERLAY */}
      {/* ========================= */}

      {accountOpen && (
        <button
          type="button"
          aria-label="Close account menu"
          onClick={() => setAccountOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-black/40"
        />
      )}

      {/* ========================= */}
      {/* ACCOUNT SIDE PANEL */}
      {/* ========================= */}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-[320px] max-w-[90vw] flex-col border-l border-line bg-panel shadow-2xl transition-transform duration-300 ${
          accountOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Account menu"
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted">
              Account
            </p>

            <h2 className="mt-1 font-serif text-lg text-ink">PaperRec</h2>
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={() => setAccountOpen(false)}
            aria-label="Close account menu"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:bg-panelAlt hover:text-ink"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* User Info */}
        <div className="border-b border-line px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {localStorage.getItem("paperrec_user_name") || "PaperRec User"}
              </p>

              <p className="truncate text-xs text-muted">
                {localStorage.getItem("paperrec_user_email") || "Local account"}
              </p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="flex-1 px-3 py-4">
          {/* Account */}
          <button
            type="button"
            onClick={() => setAccountOpen(false)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-ink transition hover:bg-panelAlt"
          >
            <span className="text-muted">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>

            <span>
              <span className="block">My Account</span>
              <span className="mt-0.5 block text-xs text-muted">
                View your account information
              </span>
            </span>
          </button>

          {/* FAQ */}
          <button
            type="button"
            onClick={() => {
              setAccountOpen(false);
              navigate("/faq");
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-ink transition hover:bg-panelAlt"
          >
            <span className="text-muted">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9.6 9a2.4 2.4 0 1 1 3.9 1.9c-.9.7-1.5 1.1-1.5 2.1" />
                <path d="M12 16h.01" />
              </svg>
            </span>

            <span>
              <span className="block">FAQ</span>
              <span className="mt-0.5 block text-xs text-muted">
                Frequently asked questions
              </span>
            </span>
          </button>

          {/* Tutorial */}
          <button
            type="button"
            onClick={openTour}
            className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-ink transition hover:bg-panelAlt"
          >
            <span className="text-muted">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
                <path d="M8 6h8" />
                <path d="M8 10h8" />
              </svg>
            </span>

            <span>
              <span className="block">System Tutorial</span>
              <span className="mt-0.5 block text-xs text-muted">
                Learn how to use PaperRec
              </span>
            </span>
          </button>
        </div>

        {/* Logout */}
        <div className="border-t border-line p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/30 px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M21 19V5a2 2 0 0 0-2-2h-7" />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      {/* ========================= */}
      {/* TUTORIAL MODAL */}
      {/* ========================= */}

      {tourOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-xl border border-line bg-panel p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-gold">
                  PaperRec Tutorial
                </p>

                <h2 className="mt-1 font-serif text-2xl text-ink">
                  Welcome to PaperRec
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setTourOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-panelAlt hover:text-ink"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-line bg-navy p-4">
                <p className="text-sm font-medium text-gold">1. Search</p>

                <p className="mt-1 text-sm leading-5 text-muted">
                  Use the Search page to find papers by topic, title, or
                  keywords.
                </p>
              </div>

              <div className="rounded-lg border border-line bg-navy p-4">
                <p className="text-sm font-medium text-gold">
                  2. Browse the Repository
                </p>

                <p className="mt-1 text-sm leading-5 text-muted">
                  Open Repository to browse the available academic papers and
                  use filters to narrow your results.
                </p>
              </div>

              <div className="rounded-lg border border-line bg-navy p-4">
                <p className="text-sm font-medium text-gold">
                  3. Get Recommendations
                </p>

                <p className="mt-1 text-sm leading-5 text-muted">
                  Use Recommendations to discover papers related to your
                  research topic.
                </p>
              </div>

              <div className="rounded-lg border border-line bg-navy p-4">
                <p className="text-sm font-medium text-gold">4. Save Papers</p>

                <p className="mt-1 text-sm leading-5 text-muted">
                  Save useful papers to My Library so you can easily find them
                  again later.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTourOpen(false)}
              className="mt-6 w-full rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition hover:brightness-110"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
