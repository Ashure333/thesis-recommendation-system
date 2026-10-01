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
  /** The character's origin story — the anime it came from, and who it is. */
  lore: string;
}

export const PET_FORMS: PetForm[] = [
  {
    id: "original",
    name: "Original",
    variant: "original",
    blurb: "The classic slime blob — the pet's true original form.",
    lore: "The pet's first face: a theme-accent slime blob, before the Petdex companions arrived from beyond the library.",
  },
  {
    id: "rimuru",
    name: "Rimuru",
    variant: "rimuru",
    blurb: "Blue-haired sword-bearing slime hero.",
    lore: "Rimuru Tempest — TenSura (That Time I Got Reincarnated as a Slime). A salaryman reborn as a slime who devoured his way to demon-lordhood: Predator, Great Sage, and the founding of the nation of Tempest.",
  },
  {
    id: "veldora",
    name: "Glaucira",
    variant: "veldora",
    blurb: "Mythical blue dragon of the deep, aurora-tinted and sapphire-scaled.",
    lore: "Glaucira stands in for Veldora, the Storm Dragon of TenSura — sealed inside Rimuru for years, and later his rowdiest friend. Aurora cerata and sapphire scales, chaos in a dragon's body.",
  },
  {
    id: "benimaru",
    name: "Crimson Blossom",
    variant: "benimaru",
    blurb: "A chibi floral spirit with a crimson bloom.",
    lore: "Crimson Blossom stands in for Benimaru, the kijin general of TenSura's Tempest — crimson flames, twin horns, and the loyalty of a blooming sword.",
  },
  {
    id: "shion",
    name: "Sion",
    variant: "shion",
    blurb: "Soft violet steadiness, calm as a moonlit night.",
    lore: "Sion stands in for Shion, the demon secretary of TenSura's Tempest — violet hair, a single horn, and a fearsome axe hidden behind a gentle face.",
  },
  {
    id: "ranga",
    name: "Wangcai",
    variant: "ranga",
    blurb: "Calm fluffy cat with blue eyes and dark ears.",
    lore: "Wangcai stands in for Ranga, the Tempest Wolf — Rimuru's first named summon: white fur, blue eyes, and loyalty so deep it became a family.",
  },
  {
    id: "shuna",
    name: "Yinyue Fox",
    variant: "shuna",
    blurb: "Silver-moon fox with dark ears and a curled tail.",
    lore: "Yinyue Fox stands in for Shuna, the gentle priestess of TenSura's Tempest — pink hair, fox ears, and a healing heart under the silver moon.",
  },
  {
    id: "gobta",
    name: "Kabi",
    variant: "gobta",
    blurb: "Sleepy, apple-munching bundle of naps.",
    lore: "Kabi stands in for Gobta, TenSura's goblin lieutenant — and borrows his apple habit from Snorlax himself (卡比兽, Pokémon), a professional napper.",
  },
  {
    id: "ciel",
    name: "Ciel",
    variant: "ciel",
    blurb: "Calm hooded girl with red eyes and a white cloak.",
    lore: "Ciel — TenSura. The personified Great Sage, Rimuru's ultimate intelligence skill: calm, infinitely precise, and always one step ahead of every calculation.",
  },
  {
    id: "diablo",
    name: "Gojo",
    variant: "diablo",
    blurb: "White-haired sorcerer, blindfolded and untouchable.",
    lore: "Gojo Satoru — Jujutsu Kaisen. The strongest sorcerer alive: white hair, blindfolded eyes, limitless cursed technique, and a Domain Expansion called Ryoiki Tenkai.",
  },
  {
    id: "milim",
    name: "Mashiro Rima",
    variant: "milim",
    blurb: "Blonde idol of the stage, always in balance.",
    lore: "Mashiro Rima stands in for Milim Nava, the Destroyer of TenSura — a dragon-girl demon lord who'd rather play than conquer. Now the stage is her playground: 1, 2, 3, Balance!",
  },
];

export const DEFAULT_PET_FORM = PET_FORMS[0].id;

export function petFormById(id: string): PetForm {
  return PET_FORMS.find((form) => form.id === id) ?? PET_FORMS[0];
}