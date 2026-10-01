import { Fragment } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/* ============================================================
   MATHTEXT — renders LaTeX math inside paper metadata.
   Inline math written as $...$ or \(...\) is typeset with KaTeX;
   everything else passes through as plain text. Unparseable
   math falls back to the raw source instead of an error box.
   ============================================================ */

const MATH_PATTERN = /(\$[^$\n]+\$|\\\([^)\n]+\\\))/g;

function typeset(source: string): string {
  try {
    return katex.renderToString(source, {
      throwOnError: true,
      displayMode: false,
      output: "html",
    });
  } catch {
    return source;
  }
}

export default function MathText({
  text,
  className = "",
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) {
    return <span className={className} />;
  }

  const parts = text.split(MATH_PATTERN);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) {
          return (
            <span
              key={index}
              dangerouslySetInnerHTML={{ __html: typeset(part.slice(1, -1)) }}
            />
          );
        }

        if (
          part.length > 4 &&
          part.startsWith("\\(") &&
          part.endsWith("\\)")
        ) {
          return (
            <span
              key={index}
              dangerouslySetInnerHTML={{ __html: typeset(part.slice(2, -2)) }}
            />
          );
        }

        return <Fragment key={index}>{part}</Fragment>;
      })}
    </span>
  );
}