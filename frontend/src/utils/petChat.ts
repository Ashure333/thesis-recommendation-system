/* ============================================================
   PET CHAT EVENTS — let the research chat make the pixel pet
   speak about the conversation.
   The chat dispatches PET_CHAT_EVENT with what just happened
   (thinking, answered, fallback, error) and the conversation's
   current topic; the pet composes a line from its own form's
   Markov chain (see petMarkov.ts) and shows it in its bubble.
   ============================================================ */

import type { PetChatContext } from "./petMarkov";

export const PET_CHAT_EVENT = "paperrec:pet-chat";

export function emitPetChat(context: PetChatContext): void {
  window.dispatchEvent(new CustomEvent(PET_CHAT_EVENT, { detail: context }));
}
