/* ============================================================
   THEME SHOP — the backdrop scenes for the garden, sold for
   growth tokens and applied from the same sidebar as the shops.

   Each card carries a live-painted still of its scene; owned
   scenes can be set as the active backdrop, and adopting one
   confirms through the themed pop-up.
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import TokenGlyph from "./TokenGlyph";
import RetroDialog from "./RetroDialog";
import {
  BACKDROP_THEMES,
  backdropStill,
  type BackdropTheme,
} from "../../data/backdrops";
import type { BackdropThemeId } from "../../data/backdrops";
import { useSun } from "../../state/sun";

function ScenePreview({ id }: { id: BackdropThemeId }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    backdropStill(ctx, id);
  }, [id]);
  return (
    <canvas
      ref={ref}
      width={256}
      height={144}
      role="img"
      aria-label={`${id} scene preview`}
      className="h-16 w-full rounded border-[2px] border-gray-900 object-cover"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export default function ThemeShop({
  owned,
  active,
  onChanged,
}: {
  owned: BackdropThemeId[];
  active: BackdropThemeId;
  onChanged: (owned: BackdropThemeId[], active: BackdropThemeId) => void;
}) {
  const { tokens, spendTokens } = useSun();
  const [confirm, setConfirm] = useState<{
    theme: BackdropTheme;
    onYes: () => void;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function adopt(theme: BackdropTheme) {
    setConfirm({
      theme,
      onYes: () => {
        if (!spendTokens(theme.price)) {
          setNotice(
            `Not enough growth tokens — ${theme.price - tokens} more needed.` +
              " Earn more by using the app: daily visits, hunts, asks," +
              " treasures, and achievements all pay tokens.",
          );
          return;
        }
        onChanged([...owned, theme.id], theme.id);
      },
    });
  }

  return (
    <div className="p-3">
      <div className="flex flex-col gap-3">
        {BACKDROP_THEMES.map((theme) => {
          const isOwned = owned.includes(theme.id);
          const isActive = active === theme.id;
          return (
            <div
              key={theme.id}
              className={`rounded-lg border-[3px] p-2 transition-colors pixel-ease ${
                isActive
                  ? "border-gray-900 bg-[#fff3cf] dark:bg-[#2c2512] shadow-[3px_3px_0_rgba(0,0,0,0.15)]"
                  : "border-gray-900 bg-white"
              }`}
            >
              <ScenePreview id={theme.id} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink">
                    {theme.label}
                    {isActive && (
                      <span className="ml-2 rounded border-[2px] border-[#2b8a3e] bg-white px-1.5 py-0.5 text-[8px] text-[#2b8a3e]">
                        In use
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-4 text-muted">
                    {theme.blurb}
                  </p>
                </div>
                {isOwned ? (
                  isActive ? (
                    <span className="shrink-0 rounded border-[2px] border-gray-300 bg-[#eef0f2] px-2 py-1 font-mono text-[9px] font-bold uppercase text-gray-500">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onChanged(owned, theme.id)}
                      className="shrink-0 rounded border-[3px] border-gray-900 bg-[#e8b04b] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#2b3347] transition-all pixel-ease hover:bg-[#f0c161] active:translate-y-[1px]"
                    >
                      Set scene
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => adopt(theme)}
                    className="flex shrink-0 items-center gap-1 rounded border-[3px] border-gray-900 bg-[#e8b04b] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#2b3347] transition-all pixel-ease hover:bg-[#f0c161] active:translate-y-[1px]"
                  >
                    <TokenGlyph className="h-2.5 w-2.5" />
                    {theme.price}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <RetroDialog
        open={confirm !== null}
        title="Adopt this scene"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onYes();
          setConfirm(null);
        }}
      >
        {confirm
          ? `Adopt the ${confirm.theme.label} scene for ${confirm.theme.price} growth tokens? It becomes the garden's backdrop right away.`
          : ""}
      </RetroDialog>

      <RetroDialog
        open={notice !== null}
        title="Heads up"
        onCancel={() => setNotice(null)}
        onConfirm={() => setNotice(null)}
        confirmLabel="OK"
      >
        {notice}
      </RetroDialog>
    </div>
  );
}