/* ============================================================
   CRT SCANLINE OVERLAY
   Fixed full-screen scanlines + vignette + drifting refresh bar.
   Pure CSS, pointer-events: none — it never blocks the UI.
   ============================================================ */

export default function ScanlineOverlay() {
  return (
    <>
      <div className="crt-overlay" aria-hidden="true" />
      <div className="crt-scan-bar" aria-hidden="true" />
    </>
  );
}