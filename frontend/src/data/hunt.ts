/* ============================================================
   SCAVENGER HUNT
   Six hidden treasures, one per page. Each is a small dim
   sparkle the user must spot and click. Collecting all six
   unlocks the pet's full help library (deep tips + chat).

   `position` is the fixed-position utility string used by the
   HuntItem component — each treasure hides at a different spot
   on its page. `hint` is what the pet whispers when clicked
   before the hunt is complete.
   ============================================================ */

export interface HuntItem {
  id: string;
  name: string;
  page: string;
  position: string;
  hint: string;
}

export const HUNT_ITEMS: HuntItem[] = [
  {
    id: "hunt-coin",
    name: "Golden Coin",
    page: "Login",
    position: "bottom-10 left-6",
    hint: "look for a faint gold glint near the bottom-left of the Login page",
  },
  {
    id: "hunt-cassette",
    name: "Cassette",
    page: "Recommendations",
    position: "top-1/2 right-8",
    hint: "a dim pink sparkle hides along the right edge of the Recommendations page",
  },
  {
    id: "hunt-orb",
    name: "Glowing Orb",
    page: "Repository",
    position: "top-28 right-10",
    hint: "an amber glow is tucked near the top-right of the Repository page",
  },
  {
    id: "hunt-cartridge",
    name: "Game Cartridge",
    page: "Upload",
    position: "bottom-32 right-12",
    hint: "the cartridge waits in the lower-right corner of the Upload page",
  },
  {
    id: "hunt-star",
    name: "Star Shard",
    page: "My Library",
    position: "bottom-24 left-10",
    hint: "a blue shard sits on the lower-left of My Library",
  },
  {
    id: "hunt-key",
    name: "Golden Key",
    page: "Arena",
    position: "top-1/2 left-8",
    hint: "the key is chained to the left edge of the Arena page",
  },
];

export const HUNT_ITEM_BY_ID: Record<string, HuntItem> = Object.fromEntries(
  HUNT_ITEMS.map((item) => [item.id, item]),
);