import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  PET_FORMS,
  DEFAULT_PET_FORM,
  petFormById,
  type PetForm,
} from "../data/petForms";

/* ============================================================
   PET FORM STATE — which of the pet forms is active, plus the
   CHAT unlock toggle (UNLOCKED maxes tips/hunt/achievements/
   forms temporarily). Persisted per browser; the pet and the
   logo both render the chosen figure, and lock back to the
   default form when chat is locked.
   ============================================================ */

const STORAGE_KEY = "paperrec_pet_form";
const CHAT_KEY = "paperrec_pet_chat_unlocked";

function readFormId(): string {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && PET_FORMS.some((form) => form.id === raw)) {
      return raw;
    }
  } catch {
    // best-effort
  }
  return DEFAULT_PET_FORM;
}

function readChatUnlocked(): boolean {
  try {
    const raw = window.localStorage.getItem(CHAT_KEY);
    if (raw !== null) return raw === "true";
  } catch {
    // best-effort
  }
  return true;
}

interface PetFormContextValue {
  form: PetForm;
  setFormId: (id: string) => void;
  chatUnlocked: boolean;
  setChatUnlocked: (unlocked: boolean) => void;
}

const PetFormContext = createContext<PetFormContextValue>({
  form: PET_FORMS[0],
  setFormId: () => {},
  chatUnlocked: true,
  setChatUnlocked: () => {},
});

export function PetFormProvider({ children }: { children: ReactNode }) {
  const [formId, setFormIdState] = useState<string>(readFormId);
  const [chatUnlocked, setChatUnlockedState] = useState<boolean>(
    readChatUnlocked,
  );

  const setFormId = useCallback((id: string) => {
    setFormIdState((current) => {
      if (current === id) return current;
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // best-effort
      }
      return id;
    });
  }, []);

  const setChatUnlocked = useCallback((unlocked: boolean) => {
    setChatUnlockedState((current) => {
      if (current === unlocked) return current;
      try {
        window.localStorage.setItem(CHAT_KEY, String(unlocked));
      } catch {
        // best-effort
      }
      return unlocked;
    });
  }, []);

  return (
    <PetFormContext.Provider
      value={{
        form: petFormById(formId),
        setFormId,
        chatUnlocked,
        setChatUnlocked,
      }}
    >
      {children}
    </PetFormContext.Provider>
  );
}

export function usePetForm(): PetFormContextValue {
  return useContext(PetFormContext);
}