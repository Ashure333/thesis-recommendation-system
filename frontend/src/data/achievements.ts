/* ============================================================
   ACHIEVEMENTS
   The pet's medal rack, shown in its right-click menu. Each
   achievement unlocks the moment its condition becomes true
   (checked by the achievements state provider after every
   relevant event) and persists in localStorage.

   Progress counters (clicks / asks / drags) are tracked by the
   pet; seen-tip and treasure progress come from the tip store
   and the scavenger hunt.
   ============================================================ */

import { TIPS } from "./tips";
import { HUNT_ITEMS } from "./hunt";

export interface AchievementProgress {
  /** Tips discovered so far (paperrec_tips_seen). */
  seen: number;
  /** Hidden treasures collected. */
  treasures: number;
  /** Total treasures in the hunt. */
  treasureTotal: number;
  /** True once every treasure is collected. */
  huntComplete: boolean;
  /** Pet the pet: total clicks (and keyboard activations). */
  clicks: number;
  /** Questions asked via the help library chat. */
  asks: number;
  /** Times the pet was dragged to a new spot. */
  drags: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  check: (progress: AchievementProgress) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-tip",
    name: "First Contact",
    description: "Discover your first tip.",
    check: (progress) => progress.seen >= 1,
  },
  {
    id: "tip-collector",
    name: "Tip Collector",
    description: "Discover 5 tips.",
    check: (progress) => progress.seen >= 5,
  },
  {
    id: "tip-master",
    name: "Tip Master",
    description: "Discover every tip in the catalogue.",
    check: (progress) => progress.seen >= TIPS.length,
  },
  {
    id: "first-treasure",
    name: "Shiny!",
    description: "Find your first hidden treasure.",
    check: (progress) => progress.treasures >= 1,
  },
  {
    id: "treasure-hunter",
    name: "Treasure Hunter",
    description: "Find half of the hidden treasures.",
    check: (progress) =>
      progress.treasures >= Math.ceil(progress.treasureTotal / 2),
  },
  {
    id: "hunt-complete",
    name: "Hunt Champion",
    description: "Find every hidden treasure.",
    check: (progress) => progress.huntComplete,
  },
  {
    id: "petting-zoo",
    name: "Petting Zoo",
    description: "Pet the pet 10 times.",
    check: (progress) => progress.clicks >= 10,
  },
  {
    id: "traveler",
    name: "Traveler",
    description: "Drag the pet somewhere new.",
    check: (progress) => progress.drags >= 1,
  },
  {
    id: "question-master",
    name: "Question Master",
    description: "Ask the help library 3 questions.",
    check: (progress) => progress.asks >= 3,
  },
];

export const HUNT_TOTAL = HUNT_ITEMS.length;