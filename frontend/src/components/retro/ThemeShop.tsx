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
import { CardBadge, CardButton, CardTag, ShopCard } from "./ShopCard";
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
            <ShopCard
              key={theme.id}
              active={isActive}
              preview={<ScenePreview id={theme.id} />}
              title={theme.label}
              badge={isActive && <CardBadge>In use</CardBadge>}
              blurb={theme.blurb}
            >
              {isOwned ? (
                isActive ? (
                  <CardTag>Active</CardTag>
                ) : (
                  <CardButton onClick={() => onChanged(owned, theme.id)}>
                    Set scene
                  </CardButton>
                )
              ) : (
                <CardButton onClick={() => adopt(theme)}>
                  <TokenGlyph className="h-2.5 w-2.5" />
                  {theme.price}
                </CardButton>
              )}
            </ShopCard>
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