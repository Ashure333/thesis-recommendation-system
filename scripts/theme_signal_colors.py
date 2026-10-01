#!/usr/bin/env python3
"""
Theme signal-color generator (PIL-style conversion utility).

The pipeline WeightBar segments use ANALOGOUS hues around the theme
accent: one keeps the accent hue, the others rotate +30° / -30° on
the color wheel, with a per-hue lightness clamp so yellow/green hues
(35-165) drop to 0.38 instead of vanishing on the white bar track.
Achromatic accents (e.g. mono) fall back to fixed distinct hues so
the bars stay distinguishable.

Mirrors the runtime math in frontend/src/theme.tsx (signalColors /
shiftHue / legibleLightness) — run this to recompute the palette
table, then the baked defaults live in frontend/src/index.css.
"""

import colorsys
import sys


def rgb_to_hsl(triplet: str) -> tuple[float, float, float]:
    r, g, b = [int(c) / 255 for c in triplet.split()]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return h * 360, s, l


def hsl_to_rgb(h: float, s: float, l: float) -> str:
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, l, s)
    return f"{round(r * 255)} {round(g * 255)} {round(b * 255)}"


def legible_lightness(hue: float) -> float:
    return 0.38 if 35 <= hue <= 165 else 0.5


def shift_hue(triplet: str, degrees: float) -> str:
    h, s, _ = rgb_to_hsl(triplet)
    return hsl_to_rgb(h + degrees, s, legible_lightness(h + degrees))


SIGNAL_FALLBACK = {
    "tfidf": "31 147 133",
    "sbert": "201 85 43",
    "meta": "110 86 207",
}


def accent_to_signals(triplet: str) -> dict[str, str]:
    _, s, _ = rgb_to_hsl(triplet)
    if s < 0.15:
        return dict(SIGNAL_FALLBACK)
    return {
        "tfidf": triplet,
        "sbert": shift_hue(triplet, 30),
        "meta": shift_hue(triplet, -30),
    }


if __name__ == "__main__":
    accents = {
        "amber": "243 156 18",
        "coral": "230 126 34",
        "violet": "176 111 240",
        "sky": "52 152 219",
        "mint": "22 160 133",
        "rose": "240 98 74",
        "mono": "143 153 154",
        "copper": "206 138 78",
        "indigo": "99 102 241",
        "lime": "132 204 22",
        "pink": "236 72 153",
        "cyan": "6 182 212",
    }

    for name, accent in accents.items():
        signals = accent_to_signals(accent)
        print(f"{name:7s} tfidf {signals['tfidf']:<15} sbert {signals['sbert']:<15} meta {signals['meta']}")

    if len(sys.argv) > 1:
        print()
        print("signals for", sys.argv[1], "->", accent_to_signals(sys.argv[1]))