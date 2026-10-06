/* Small four-point sparkle, used for interaction feedback on the
   Knowledge Tree (asking for trivia, planting fertilizer). */
export default function SparkleGlyph({
  className = "h-2.5 w-2.5",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 8 8" className={className} aria-hidden="true">
      <path
        d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z"
        fill="#f5d301"
        stroke="#8a5a2b"
        strokeWidth="0.5"
      />
    </svg>
  );
}
