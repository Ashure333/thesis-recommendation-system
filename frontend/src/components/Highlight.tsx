/* ============================================================
   HIGHLIGHT
   Wraps occurrences of the search terms in a plain-text string
   with a subtle mark, for search snippets and abstracts. Terms
   are escaped so regex metacharacters in a query never break the
   rendering.
   ============================================================ */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function Highlight({
  text,
  terms,
  className,
}: {
  text: string | null | undefined;
  terms: string[];
  className?: string;
}) {
  const cleaned = (terms ?? [])
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  if (!text || cleaned.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(
    `(${cleaned.map(escapeRegExp).join("|")})`,
    "gi",
  );

  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="rounded-sm bg-accentSoft px-0.5 font-semibold text-ink"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  );
}
