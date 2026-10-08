/**
 * PIXEL BURST — a one-shot retro explosion of colored squares,
 * fired at viewport coordinates (e.g. where a row was deleted).
 * The host clears it after a beat; every particle runs the same
 * keyframes with per-particle CSS variables (burst direction,
 * rotation, delay, color).
 */

const BURST_COLORS = [
  "#f39c18",
  "#1f5f8b",
  "#e74c3c",
  "#2ecc71",
  "#f5f0e6",
  "#1b2430",
];

const PARTICLES = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  // Deterministic-ish scatter: fixed spread per particle index.
  dx: `${((index * 37) % 14) - 7}px`,
  dy: `${((index * 53) % 16) - 10}px`,
  rot: `${((index * 91) % 200) - 100}deg`,
  delay: (index % 4) * 12,
  color: BURST_COLORS[index % BURST_COLORS.length],
}));

export default function PixelBurst({
  x,
  y,
}: {
  x: number;
  y: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[9999]"
      style={{ left: x, top: y }}
    >
      {PARTICLES.map((particle) => (
        <span
          key={particle.id}
          className="animate-pixel-burst absolute block h-2 w-2 border-[1px] border-gray-900"
          style={
            {
              "--dx": particle.dx,
              "--dy": particle.dy,
              "--rot": particle.rot,
              "--delay": `${particle.delay}ms`,
              background: particle.color,
              animationDelay: `${particle.delay}ms`,
              animationFillMode: "forwards",
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}