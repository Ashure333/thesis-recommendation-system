import { usePetForm } from "../state/petForm";
import PetBlob from "./retro/PetBlob";

/* ============================================================
   PET FIGURE — the slime shown in empty/placeholder states.
   Renders the currently selected pet form in a small framed
   badge with the idle animations.
   ============================================================ */

export default function PetFigure({
  size = 96,
}: {
  size?: number;
}) {
  const { form } = usePetForm();

  return (
    <div
      className="mx-auto flex items-center justify-center rounded border-[3px] border-gray-900 bg-white p-3"
      style={{ width: size + 24, height: size + 24 }}
    >
      <PetBlob variant={form.variant} size={size} />
    </div>
  );
}