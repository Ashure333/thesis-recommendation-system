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
   PET FORM STATE — which of the ten slime forms is active.
   Persisted per browser; the pet and the logo both render the
   chosen figure.
   ============================================================ */

const STORAGE_KEY = "paperrec_pet_form";

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

interface PetFormContextValue {
  form: PetForm;
  setFormId: (id: string) => void;
}

const PetFormContext = createContext<PetFormContextValue>({
  form: PET_FORMS[0],
  setFormId: () => {},
});

export function PetFormProvider({ children }: { children: ReactNode }) {
  const [formId, setFormIdState] = useState<string>(readFormId);

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

  return (
    <PetFormContext.Provider
      value={{ form: petFormById(formId), setFormId }}
    >
      {children}
    </PetFormContext.Provider>
  );
}

export function usePetForm(): PetFormContextValue {
  return useContext(PetFormContext);
}