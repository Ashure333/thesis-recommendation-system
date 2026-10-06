/* Pixel sun token, shared by the Tree of Knowledge and the Sun
   Shop. Drawn as eight rays around a disc in the arcade palette. */
export default function SunGlyph({
  className = "h-3.5 w-3.5",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="4"
        fill="#f5b301"
        stroke="#8a5a2b"
        strokeWidth="1"
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <rect
          key={angle}
          x="7.2"
          y="0.8"
          width="1.6"
          height="2.6"
          fill="#f5b301"
          transform={`rotate(${angle} 8 8)`}
        />
      ))}
    </svg>
  );
}
