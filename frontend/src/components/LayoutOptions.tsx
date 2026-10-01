import { useLayoutPrefs, type LayoutPreset } from "../state/layoutPrefs";

/* ============================================================
   LAYOUT OPTIONS — the shared panel-visibility control.
   A compact segmented switcher with four presets:
     FULL    sidebar + details
     LIST    bare list, both panes hidden
     FILTERS sidebar only
     DETAILS details pane only
   The preference lives in layoutPrefs state, so the choice made
   here applies to every multi-pane tab (Repository, Search).
   ============================================================ */

const OPTIONS: { id: LayoutPreset; label: string; hint: string }[] = [
  { id: "full", label: "FULL", hint: "Sidebar and details" },
  { id: "list", label: "LIST", hint: "Panels hidden" },
  { id: "filters", label: "FILTERS", hint: "Sidebar only" },
  { id: "details", label: "DETAILS", hint: "Details only" },
];

export default function LayoutOptions() {
  const { preset, setPreset } = useLayoutPrefs();

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
        Layout
      </span>

      <div className="flex rounded border-[3px] border-gray-900">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            title={option.hint}
            aria-pressed={preset === option.id}
            onClick={() => setPreset(option.id)}
            className={`px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.1em] transition-colors pixel-ease ${
              option.id !== "full" ? "-ml-[3px]" : ""
            } ${
              preset === option.id
                ? "bg-accent text-onAccent"
                : "bg-white text-ink hover:bg-accentSoft"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}