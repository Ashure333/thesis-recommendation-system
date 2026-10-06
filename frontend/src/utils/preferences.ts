/**
 * USER PREFERENCES — the settings the Settings page writes and the
 * context menu's Copy-as actions read.
 *
 * Stored per browser in localStorage (the app has no per-user
 * accounts on the visitor side), with a window event so open pages
 * can react without a reload.
 */

export type CitationStyle = "apa" | "mla" | "chicago" | "ieee";

export const CITATION_STYLES: {
  id: CitationStyle;
  label: string;
  sample: string;
}[] = [
  {
    id: "apa",
    label: "APA 7",
    sample: "Author (Year). Title. https://doi.org/…",
  },
  {
    id: "mla",
    label: "MLA 9",
    sample: 'Author. "Title." Year. DOI: ….',
  },
  {
    id: "chicago",
    label: "Chicago",
    sample: 'Author. "Title." Year. https://doi.org/….',
  },
  {
    id: "ieee",
    label: "IEEE",
    sample: 'Author, "Title," Year. doi: ….',
  },
];

export interface UserSettings {
  citationStyle: CitationStyle;
  citationIncludeDoi: boolean;
  bibtexIncludeAbstract: boolean;
}

export const SETTINGS_EVENT = "paperrec-settings-changed";

const STYLE_KEY = "paperrec_citation_style";
const DOI_KEY = "paperrec_citation_include_doi";
const BIBTEX_ABSTRACT_KEY = "paperrec_bibtex_abstract";

const DEFAULTS: UserSettings = {
  citationStyle: "apa",
  citationIncludeDoi: true,
  bibtexIncludeAbstract: true,
};

export function readSettings(): UserSettings {
  try {
    const storedStyle = window.localStorage.getItem(STYLE_KEY);
    const style = CITATION_STYLES.some(
      (entry) => entry.id === storedStyle
    )
      ? (storedStyle as CitationStyle)
      : DEFAULTS.citationStyle;

    return {
      citationStyle: style,
      citationIncludeDoi:
        window.localStorage.getItem(DOI_KEY) !== "0",
      bibtexIncludeAbstract:
        window.localStorage.getItem(BIBTEX_ABSTRACT_KEY) !== "0",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSettings(
  patch: Partial<UserSettings>
): UserSettings {
  const next = { ...readSettings(), ...patch };

  try {
    window.localStorage.setItem(STYLE_KEY, next.citationStyle);
    window.localStorage.setItem(
      DOI_KEY,
      next.citationIncludeDoi ? "1" : "0"
    );
    window.localStorage.setItem(
      BIBTEX_ABSTRACT_KEY,
      next.bibtexIncludeAbstract ? "1" : "0"
    );
  } catch {
    // Best-effort persistence.
  }

  window.dispatchEvent(new Event(SETTINGS_EVENT));

  return next;
}
