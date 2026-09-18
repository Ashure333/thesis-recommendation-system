import { NavLink, Outlet } from "react-router-dom";

// Placeholders -- in the wired-up version these come from shared state
// (library count from the DB, active pipeline from wherever it was last
// set on the Search or Recommendations page).
const libraryCount = 4;
const activePipelineLabel = "TF-IDF + S-BERT + Metadata";

const navItems = [
  { to: "/search", label: "Search" },
  { to: "/repository", label: "Repository" },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/upload", label: "Upload" },
  { to: "/library", label: `My Library`, badge: libraryCount },
  { to: "/evaluation", label: "Evaluation" },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-navy">
      <header className="flex items-center justify-between border-b border-line bg-panel px-6 py-3">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-gold/20 font-serif text-sm text-gold">
              R
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium text-ink">PaperRec</p>
              <p className="text-[10px] uppercase tracking-wide text-muted">
                BulSU BSMCS
              </p>
            </div>
          </div>

          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
                    isActive ? "bg-panelAlt text-ink" : "text-muted hover:text-ink"
                  }`
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

        <div className="rounded border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold">
          Pipeline: {activePipelineLabel}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
