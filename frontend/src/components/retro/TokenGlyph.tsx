/* Pixel growth token, shared by the Tree of Knowledge and the Sun
   Shop. A faceted green diamond: the seeds of the skin economy. */
export default function TokenGlyph({
  className = "h-3.5 w-3.5",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M8 1 L15 4 L8 15 L1 4 Z" fill="#3b6d11" stroke="#25470a" strokeWidth="1" />
      <path d="M8 1 L12.5 4 L8 15 L3.5 4 Z" fill="#4c8a17" stroke="none" />
      <circle cx="8" cy="4.5" r="1" fill="#8fd14f" stroke="none" />
    </svg>
  );
}