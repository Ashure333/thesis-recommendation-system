/* ============================================================
   SLIME LOGO — the Re:Search mark.
   A mini animated slime in the same visual language as the pixel
   pet: blob body, bob + squash-and-stretch bounce, blinking
   eyes, and a ground shadow. Wiggles on hover.
   ============================================================ */

export default function SlimeLogo() {
  return (
    <span className="retro-wiggle relative flex h-8 w-8 shrink-0 items-end justify-center">
      {/* ground shadow */}
      <span
        aria-hidden="true"
        className="pet-shadow absolute bottom-0 h-[3px] w-6 rounded-full bg-gray-900/30"
      />

      {/* bob (vertical idle) */}
      <span className="pet-bob relative z-10 flex items-end justify-center">
        {/* squash-and-stretch bounce */}
        <span className="pet-bounce">
          <span className="flex h-7 w-7 items-center justify-center rounded-[50%_50%_45%_45%/60%_60%_40%_40%] border-[3px] border-gray-900 bg-accent">
            <span className="pet-eyes flex items-center justify-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full border-[1.5px] border-gray-900 bg-white" />
              <span className="h-1.5 w-1.5 rounded-full border-[1.5px] border-gray-900 bg-white" />
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}