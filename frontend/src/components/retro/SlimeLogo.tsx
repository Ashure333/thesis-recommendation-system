import { usePetForm } from "../../state/petForm";
import { PET_FORMS } from "../../data/petForms";
import PetBlob from "./PetBlob";

/* ============================================================
   SLIME LOGO — the Re:Search mark.
   Renders the currently selected pet form with bob, squash-and-
   stretch bounce, and a ground shadow. Wiggles on hover. When
   the pet's chat is LOCKED the logo reverts to the default form.
   ============================================================ */

export default function SlimeLogo() {
  const { form, chatUnlocked } = usePetForm();
  const effectiveForm = chatUnlocked ? form : PET_FORMS[0];

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
          <PetBlob
            variant={effectiveForm.variant}
            size={28}
            className="drop-shadow-[1px_2px_0_rgba(0,0,0,0.15)]"
          />
        </span>
      </span>
    </span>
  );
}