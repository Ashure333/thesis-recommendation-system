import { useState } from "react";
import { uploadPaper, Paper } from "../api";

interface BibTeXImportProps {
  onImported: (paper: Paper) => void;
}

export default function BibTeXImport({
  onImported,
}: BibTeXImportProps) {
  const [bibtex, setBibtex] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    const content = bibtex.trim();

    if (!content) {
      setError("Please paste a BibTeX citation first.");
      return;
    }

    if (!/@\w+\s*\{/i.test(content)) {
      setError(
        "The pasted text does not appear to be a valid BibTeX citation."
      );
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const file = new File(
        [content],
        "google-scholar.bib",
        {
          type: "application/x-bibtex",
        }
      );

      const paper = await uploadPaper(file);

      onImported(paper);
      setBibtex("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to import BibTeX."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-line bg-panel p-5">
      <div className="mb-3">
        <h2 className="font-serif text-lg text-ink">
          Import from Google Scholar
        </h2>

        <p className="mt-1 text-xs leading-5 text-muted">
          In Google Scholar, click <strong>Cite</strong>, choose{" "}
          <strong>BibTeX</strong>, copy the citation, and paste it here.
        </p>
      </div>

      <textarea
        value={bibtex}
        onChange={(e) => setBibtex(e.target.value)}
        rows={7}
        placeholder={`@article{example2025,
  title={Example Paper},
  author={Author, A.},
  journal={Example Journal},
  year={2025}
}`}
        className="w-full rounded border border-line bg-bg px-3 py-2 font-mono text-xs text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
      />

      {error && (
        <p className="mt-3 rounded border border-sbert/40 bg-sbert/10 px-3 py-2 text-sm text-sbert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleImport}
        disabled={uploading || !bibtex.trim()}
        className="mt-3 rounded bg-gold px-4 py-2 text-sm font-medium text-navy hover:bg-gold/90 disabled:opacity-50"
      >
        {uploading ? "Importing…" : "Import BibTeX"}
      </button>
    </div>
  );
}

