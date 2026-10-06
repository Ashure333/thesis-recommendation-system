/**
 * PAGE TABS — the shared top-of-page tab strip (Search, Repository,
 * Arena). Retro cartridge chips, one row, no wrapping surprises.
 */

export interface PageTabOption<T extends string> {
  id: T;
  label: string;
}

export default function PageTabs<T extends string>({
  label,
  options,
  active,
  onChange,
}: {
  label: string;
  options: PageTabOption<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap gap-1"
    >
      {options.map((option) => {
        const isActive = option.id === active;

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={`rounded border-[3px] border-gray-900 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.12em] transition-colors pixel-ease ${
              isActive
                ? "bg-accent text-onAccent"
                : "bg-white text-ink hover:bg-accentSoft"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
