/* ============================================================
   PET FORMS — ten code-rendered shapes the slime shifts into.
   Rimuru can take any form, so the pet transforms into its
   Tempest crew: a dragon, kijin, wolf, goblin, flame spirit,
   demons, and the slime himself. Every form is pure CSS, so it
   follows the theme accent and animates with the same bob /
   bounce / reaction keyframes.
   ============================================================ */

export type PetVariant =
  | "rimuru"
  | "veldora"
  | "benimaru"
  | "shion"
  | "ranga"
  | "shuna"
  | "gobta"
  | "ciel"
  | "diablo"
  | "milim";

export interface PetForm {
  id: string;
  name: string;
  variant: PetVariant;
  blurb: string;
}

export const PET_FORMS: PetForm[] = [
  {
    id: "rimuru",
    name: "Rimuru",
    variant: "rimuru",
    blurb: "The slime himself. True form.",
  },
  {
    id: "veldora",
    name: "Veldora",
    variant: "veldora",
    blurb: "Storm dragon, sealed inside.",
  },
  {
    id: "benimaru",
    name: "Benimaru",
    variant: "benimaru",
    blurb: "Kijin with twin flames.",
  },
  {
    id: "shion",
    name: "Shion",
    variant: "shion",
    blurb: "The demon secretary.",
  },
  {
    id: "ranga",
    name: "Ranga",
    variant: "ranga",
    blurb: "Tempest wolf, loyal to a fault.",
  },
  {
    id: "shuna",
    name: "Shuna",
    variant: "shuna",
    blurb: "The gentle priestess.",
  },
  {
    id: "gobta",
    name: "Gobta",
    variant: "gobta",
    blurb: "Goblin with big ears.",
  },
  {
    id: "ciel",
    name: "Ciel",
    variant: "ciel",
    blurb: "The personified Great Sage.",
  },
  {
    id: "diablo",
    name: "Diablo",
    variant: "diablo",
    blurb: "Primordial demon butler.",
  },
  {
    id: "milim",
    name: "Milim",
    variant: "milim",
    blurb: "Destroyer, in a good mood.",
  },
];

export const DEFAULT_PET_FORM = PET_FORMS[0].id;

export function petFormById(id: string): PetForm {
  return PET_FORMS.find((form) => form.id === id) ?? PET_FORMS[0];
}