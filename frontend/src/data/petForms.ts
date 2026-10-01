/* ============================================================
   PET FORMS — ten code-rendered shapes the slime shifts into.
   Rimuru can take any form, so the pet transforms into its
   Tempest crew: a dragon, kijin, wolf, goblin, flame spirit,
   demons, and the slime himself. Every form is pure CSS, so it
   follows the theme accent and animates with the same bob /
   bounce / reaction keyframes.
   ============================================================ */

export type PetVariant =
  | "original"
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
    id: "original",
    name: "Original",
    variant: "original",
    blurb: "The classic slime blob — the pet's true original form.",
  },
  {
    id: "rimuru",
    name: "Rimuru",
    variant: "rimuru",
    blurb: "Blue-haired sword-bearing slime hero.",
  },
  {
    id: "veldora",
    name: "Glaucira",
    variant: "veldora",
    blurb: "Mythical blue dragon of the deep, aurora-tinted and sapphire-scaled.",
  },
  {
    id: "benimaru",
    name: "Crimson Blossom",
    variant: "benimaru",
    blurb: "A chibi floral spirit with a crimson bloom.",
  },
  {
    id: "shion",
    name: "Sion",
    variant: "shion",
    blurb: "Soft violet steadiness, calm as a moonlit night.",
  },
  {
    id: "ranga",
    name: "Wangcai",
    variant: "ranga",
    blurb: "Calm fluffy cat with blue eyes and dark ears.",
  },
  {
    id: "shuna",
    name: "Yinyue Fox",
    variant: "shuna",
    blurb: "Silver-moon fox with dark ears and a curled tail.",
  },
  {
    id: "gobta",
    name: "Kabi",
    variant: "gobta",
    blurb: "Sleepy, apple-munching bundle of naps.",
  },
  {
    id: "ciel",
    name: "Ciel",
    variant: "ciel",
    blurb: "Calm hooded girl with red eyes and a white cloak.",
  },
  {
    id: "diablo",
    name: "Gojo",
    variant: "diablo",
    blurb: "White-haired sorcerer, blindfolded and untouchable.",
  },
  {
    id: "milim",
    name: "Mashiro Rima",
    variant: "milim",
    blurb: "Blonde idol of the stage, always in balance.",
  },
];

export const DEFAULT_PET_FORM = PET_FORMS[0].id;

export function petFormById(id: string): PetForm {
  return PET_FORMS.find((form) => form.id === id) ?? PET_FORMS[0];
}