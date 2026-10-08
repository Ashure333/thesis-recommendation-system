/**
 * Presentation mode's hidden door: hold P + R + O together and a pop-up asks
 * for the password. The right word switches the site to Researcher mode (the
 * full developer tool), setting the saved preferences back.
 */

import { useEffect, useRef, useState } from "react";

import { useSiteMode } from "../state/siteMode";
import { chordHeld, isDevPassword } from "../utils/devUnlock";
import RetroDialog from "./retro/RetroDialog";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export default function DevUnlock() {
  const { setMode } = useSiteMode();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [wrong, setWrong] = useState(false);
  const down = useRef(new Set<string>());

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;

      down.current.add(event.key.toLowerCase());

      if (chordHeld(down.current)) {
        event.preventDefault();
        down.current.clear();
        setWord("");
        setWrong(false);
        setOpen(true);
      }
    };
    const onUp = (event: KeyboardEvent) => {
      down.current.delete(event.key.toLowerCase());
    };
    const onBlur = () => down.current.clear();

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  function submit() {
    if (isDevPassword(word)) {
      setOpen(false);
      setMode("researcher");

      return;
    }

    setWrong(true);
    setWord("");
  }

  return (
    <RetroDialog
      open={open}
      title="Developer mode"
      size="sm"
      confirmLabel="Unlock"
      cancelLabel="Cancel"
      focusOnOpen={false}
      onConfirm={submit}
      onCancel={() => setOpen(false)}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="dev-unlock-word" className="font-bold">
          Enter the password to leave Presentation mode.
        </label>
        <input
          id="dev-unlock-word"
          type="password"
          autoFocus
          autoComplete="off"
          value={word}
          onChange={(event) => {
            setWord(event.target.value);
            setWrong(false);
          }}
          aria-invalid={wrong}
          aria-describedby={wrong ? "dev-unlock-error" : undefined}
          className="min-h-9 rounded border-[3px] border-gray-900 bg-field px-2 font-mono text-sm text-ink"
        />
        {wrong && (
          <p id="dev-unlock-error" role="alert" className="font-bold text-ink">
            That is not the password.
          </p>
        )}
      </form>
    </RetroDialog>
  );
}
