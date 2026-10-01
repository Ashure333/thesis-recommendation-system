/* ============================================================
   SLIME ANIMATION EVENTS — trigger the pixel pet's reaction
   from anywhere in the app.
   The pet listens for SLIME_ANIMATION_EVENT and plays the
   matching mode (zap / eat / crumple / burn) on itself with its
   speech line. Actions dispatch the event: search zaps, uploads
   eat, deletions burn, battles zap.
   ============================================================ */

export type SlimeAnimationMode = "zap" | "eat" | "crumple" | "burn";

export const SLIME_ANIMATION_EVENT = "paperrec:slime-animation";

export function triggerSlimeAnimation(mode: SlimeAnimationMode): void {
  window.dispatchEvent(
    new CustomEvent(SLIME_ANIMATION_EVENT, { detail: { mode } }),
  );
}