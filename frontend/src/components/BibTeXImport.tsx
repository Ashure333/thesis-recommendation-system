import { useState } from "react";
import { uploadPaper, Paper } from "../api";
import { Button, FieldLabel } from "./ui";

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
    // result-panel: white fill, 3px outline, 4px radius, md padding
    <div className="mb-6 rounded border-[3px] border-gray-900 bg-white p-4 text-gray-900">
      <div className="mb-4">
        <h2 className="text-xl font-bold leading-snug">
          Import from Google Scholar
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          In Google Scholar, click <strong className="text-gray-900">Cite</strong>, choose{" "}
          <strong className="text-gray-900">BibTeX</strong>, copy the citation, and paste it here.
        </p>
      </div>

      <FieldLabel htmlFor="bibtex-input">BibTeX citation</FieldLabel>

      {/* Offset-slab construction, same as url-input */}
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rounded bg-gray-900"
        />
        <textarea
          id="bibtex-input"
          value={bibtex}
          onChange={(e) => setBibtex(e.target.value)}
          rows={7}
          placeholder={`@article{example2025,
  title={Example Paper},
  author={Author, A.},
  journal={Example Journal},
  year={2025}
}`}
          className="relative z-10 block w-full resize-y rounded border-[3px] border-gray-900 bg-[#E8F0FE] px-6 py-3.5 font-mono text-sm leading-normal text-gray-900 placeholder-gray-600 transition-transform duration-100 focus:translate-x-0.5 focus:translate-y-0.5 focus:outline-none motion-reduce:transition-none"
        />
      </div>

      {error && (
        // No red: accents are never used for state. Plain ink text in an outlined panel.
        <p
          role="alert"
          className="mt-6 rounded border-[3px] border-gray-900 bg-white px-3 py-2 text-sm font-medium text-gray-900"
        >
          {error}
        </p>
      )}

      <div className="mt-6">
        <Button
          type="button"
          onClick={handleImport}
          disabled={uploading || !bibtex.trim()}
        >
          {uploading ? "Importing…" : "Import BibTeX"}
        </Button>
      </div>
    </div>
  );
}
