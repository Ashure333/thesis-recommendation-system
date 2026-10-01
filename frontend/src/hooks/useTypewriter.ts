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

    const id = window.setInterval(() => {
      setCount((current) =>
        current >= text.length ? current : current + 1,
      );
    }, speed);

    return () => window.clearInterval(id);
  }, [text, speed, start]);

  return text.slice(0, count);
}