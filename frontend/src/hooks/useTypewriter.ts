import { useEffect, useState } from "react";

/* ============================================================
   RETRO TYPEWRITER
   Reveals `text` one character at a time, arcade-style.
   ============================================================ */

export function useTypewriter(
  text: string,
  speed = 60,
  start = true,
): string {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start || !text) {
      setCount(0);
      return;
    }

    setCount(0);

    // Stop ticking once the text is fully typed instead of waking the
    // main thread every `speed` ms for as long as the bubble stays open.
    let typed = 0;
    const id = window.setInterval(() => {
      typed += 1;
      setCount(typed);
      if (typed >= text.length) window.clearInterval(id);
    }, speed);

    return () => window.clearInterval(id);
  }, [text, speed, start]);

  return text.slice(0, count);
}