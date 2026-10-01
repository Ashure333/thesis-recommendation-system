/* ============================================================
   PIXEL ICONS
   The retro glyphs (▮ ▶ ◀ ◆ ▲ ▼ ✓ ✕ ★ ⚠) are not covered by
   Pixelify Sans, so they're drawn as tiny crisp SVG shapes in
   currentColor instead. Any size via className (h-3 w-3, …).
   ============================================================ */

interface IconProps {
  className?: string;
}

/** ▮ solid block cursor */
export function BlockCursor({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <rect x="3" y="1" width="10" height="14" />
    </svg>
  );
}

/** ▶ right-pointing triangle */
export function ArrowRight({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M4 1 L13 8 L4 15 Z" />
    </svg>
  );
}

/** ◀ left-pointing triangle */
export function ArrowLeft({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 1 L3 8 L12 15 Z" />
    </svg>
  );
}

/** ▲ up-pointing triangle */
export function ArrowUp({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M1 12 L8 3 L15 12 Z" />
    </svg>
  );
}

/** ▼ down-pointing triangle */
export function ArrowDown({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M1 4 L8 13 L15 4 Z" />
    </svg>
  );
}

/** ◆ diamond */
export function Diamond({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0.5 L15 8 L8 15.5 L1 8 Z" />
    </svg>
  );
}

/** ▪ solid pixel dot (REC-style indicator) */
export function Dot({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" />
    </svg>
  );
}

/** ✓ check mark */
export function Check({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M2.5 8.5 L6 12 L13.5 4" />
    </svg>
  );
}

/** ✕ close mark */
export function CloseX({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" />
    </svg>
  );
}

/** ★ five-point star */
export function Star({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 1 L9.8 5.6 L14.8 5.9 L10.9 9 L12.2 13.8 L8 11.2 L3.8 13.8 L5.1 9 L1.2 5.9 L6.2 5.6 Z" />
    </svg>
  );
}

/** ⚠ warning triangle with exclamation */
export function Warning({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M8 1.5 L15 14 H1 Z" fill="currentColor" />
      <rect x="7.3" y="6" width="1.4" height="4" fill="rgb(var(--canvas) / 1)" />
      <rect x="7.3" y="11.2" width="1.4" height="1.4" fill="rgb(var(--canvas) / 1)" />
    </svg>
  );
}