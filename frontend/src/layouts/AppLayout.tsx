import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
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
  const [recommendationIndexStale, setRecommendationIndexStale] = useState(false);

  useEffect(() => {
    getRecommendationIndexStatus()
      .then((status) => setRecommendationIndexStale(status.stale))
      .catch((error) => console.error("Failed to get recommendation index status:", error));

    const handleStale = () => setRecommendationIndexStale(true);
    window.addEventListener("recommendation-index-stale", handleStale);
    return () => window.removeEventListener("recommendation-index-stale", handleStale);
  }, []);

  return (
    <div className="min-h-screen bg-navy">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex min-h-16 max-w-[1400px] items-center gap-8 px-5 lg:px-6">
          <NavLink to="/search" className="flex shrink-0 items-center gap-2.5" aria-label="PaperRec home">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-gold/40 text-sm font-semibold text-gold">
              R
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-ink">PaperRec</span>
              <span className="block text-[10px] text-muted">BulSU BSMCS</span>
            </span>
          </NavLink>

          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" aria-label="Primary navigation">
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

          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Current pipeline</p>
            <p className="mt-0.5 text-xs text-gold">TF-IDF + S-BERT + Metadata</p>
          </div>
        </div>
      </header>

      <RecommendationIndexAlert
        visible={recommendationIndexStale}
        onRebuilt={() => setRecommendationIndexStale(false)}
      />

      <main className="mx-auto max-w-[1400px] px-5 py-7 lg:px-6 lg:py-9">
        <Outlet />
      </main>
    </div>
  );
}
