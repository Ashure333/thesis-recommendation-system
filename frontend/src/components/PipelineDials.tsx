import { useCallback, useRef } from "react";

import WeightBar from "./WeightBar";
import {
  DEFAULT_DIAL_ALLOCATION,
  customPipelineConfig,
  normalizeDialAllocation,
  type DialAllocation,
} from "../data/pipelineConfigs";

/* ============================================================
   PIPELINE ALLOCATION DIALS
   Three rotary dials — TF-IDF, S-BERT, Metadata — that set the
   custom pipeline's allocation. Raw positions (0..100) are kept
   as the user left them; the displayed shares (and everything
   sent to the backend) are auto-normalized to 100%.

   Dial interaction: drag around the knob (angle → value, the
   bottom gap between ±135° is the dead zone), arrow keys,
   PageUp/PageDown, Home/End. role="slider" for screen readers.
   ============================================================ */

interface DialDef {
  key: keyof DialAllocation;
  label: string;
  hint: string;
  /** Full literal classes (Tailwind must see them at build time). */
  arc: string;
  bar: string;
}

const DIALS: DialDef[] = [
  {
    key: "tfidf",
    label: "TF-IDF",
    hint: "wording",
    arc: "stroke-tfidf",
    bar: "bg-tfidf",
  },
  {
    key: "sbert",
    label: "S-BERT",
    hint: "meaning",
    arc: "stroke-sbert",
    bar: "bg-sbert",
  },
  {
    key: "metadata",
    label: "Metadata",
    hint: "fields",
    arc: "stroke-meta",
    bar: "bg-meta",
  },
];

const SIZE = 84;
const CENTER = SIZE / 2;
const KNOB_RADIUS = 27;
const TRACK_RADIUS = 36;

// Dial sweep: -135° (bottom-left) → +135° (bottom-right), 0° = up.
const START_ANGLE = -135;
const SWEEP = 270;
const END_ANGLE = START_ANGLE + SWEEP;

function valueToAngle(value: number): number {
  return START_ANGLE + (value / 100) * SWEEP;
}

function polar(radius: number, degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.sin(radians),
    y: CENTER - radius * Math.cos(radians),
  };
}

function arcPath(from: number, to: number): string {
  const start = polar(TRACK_RADIUS, from);
  const end = polar(TRACK_RADIUS, to);
  const largeArc = Math.abs(to - from) > 180 ? 1 : 0;

  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${TRACK_RADIUS} ${TRACK_RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** Pointer position → dial value (clamped at the sweep ends). */
function pointerToValue(
  event: { clientX: number; clientY: number },
  element: HTMLElement
): number {
  const rect = element.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const radius = Math.hypot(dx, dy);

  // Dragging straight through the hub would otherwise sit at a
  // constant 0° (50%) — fall back to vertical drag there so the
  // dial never feels stuck on its own axis.
  if (radius < 16) {
    const value = 100 * (1 - dy / (rect.height / 2));
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  // Degrees from straight up, clockwise.
  let degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;

  degrees = Math.max(START_ANGLE, Math.min(END_ANGLE, degrees));

  return Math.round(((degrees - START_ANGLE) / SWEEP) * 100);
}

function RotaryDial({
  def,
  value,
  share,
  onChange,
}: {
  def: DialDef;
  value: number;
  share: number;
  onChange: (next: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const angle = valueToAngle(value);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const element = containerRef.current;
      if (!element) return;

      element.setPointerCapture(event.pointerId);
      draggingRef.current = true;
      onChange(pointerToValue(event, element));
    },
    [onChange]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const element = containerRef.current;
      if (!element || !draggingRef.current) return;

      onChange(pointerToValue(event, element));
    },
    [onChange]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = false;
      containerRef.current?.releasePointerCapture(event.pointerId);
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 10 : 2;
      let next: number | null = null;

      switch (event.key) {
        case "ArrowUp":
        case "ArrowRight":
          next = value + step;
          break;
        case "ArrowDown":
        case "ArrowLeft":
          next = value - step;
          break;
        case "PageUp":
          next = value + 10;
          break;
        case "PageDown":
          next = value - 10;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = 100;
          break;
        default:
          return;
      }

      event.preventDefault();
      onChange(Math.max(0, Math.min(100, next)));
    },
    [value, onChange]
  );

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label={`${def.label} allocation`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={`${share.toFixed(1)}% of the mix`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={`mx-auto block h-[84px] w-[84px] cursor-grab touch-none rounded-full active:cursor-grabbing ${def.arc} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900`}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-full w-full"
        aria-hidden="true"
      >
        {/* track */}
        <path
          d={arcPath(START_ANGLE, END_ANGLE)}
          className="fill-none stroke-gray-200"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* filled portion (signal color) */}
        {value > 0 && (
          <path
            d={arcPath(START_ANGLE, angle)}
            className={`fill-none ${def.arc}`}
            strokeWidth="6"
            strokeLinecap="round"
          />
        )}

        {/* knob body */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={KNOB_RADIUS}
          className="fill-white stroke-gray-900"
          strokeWidth="3"
        />

        {/* pointer needle (signal color) */}
        <g transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
          <line
            x1={CENTER}
            y1={CENTER - 8}
            x2={CENTER}
            y2={CENTER - KNOB_RADIUS + 6}
            className={def.arc}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>

        {/* hub */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r="4"
          className="fill-white stroke-gray-900"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

export default function PipelineDials({
  value,
  onChange,
}: {
  value: DialAllocation;
  onChange: (next: DialAllocation) => void;
}) {
  const shares = normalizeDialAllocation(value);
  const previewConfig = customPipelineConfig(value);

  function setDial(key: keyof DialAllocation, next: number) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="rounded border-[3px] border-gray-900 bg-white p-3">
      <p className="text-xs leading-5 text-muted">
        Turn the dials to allocate the three signals — shares
        auto-normalize to 100%. A search re-runs as you dial.
      </p>

      <div className="mt-3 flex items-start justify-between gap-1">
        {DIALS.map((def) => (
          <div
            key={def.key}
            className="flex w-1/3 flex-col items-center gap-1"
          >
            <RotaryDial
              def={def}
              value={value[def.key]}
              share={shares[def.key]}
              onChange={(next) => setDial(def.key, next)}
            />

            <span className="text-[11px] font-bold text-ink">
              {def.label}
            </span>

            <span className="text-[11px] text-muted">{def.hint}</span>

            <span className="text-sm font-bold tabular-nums text-ink">
              {shares[def.key].toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <WeightBar weights={previewConfig.weights} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.1em] text-muted">
          RAW {value.tfidf} / {value.sbert} / {value.metadata}
        </span>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_DIAL_ALLOCATION)}
          className="rounded border-[2px] border-gray-900 bg-white px-2 py-0.5 text-[11px] font-bold text-ink transition pixel-ease hover:bg-accentSoft"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
