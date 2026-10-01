import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { BlockCursor } from "../retro/PixelIcons";

/* ============================================================
   GITINGEST DESIGN LANGUAGE — shared primitives
   Cream canvas #FFFDF8 · ink gray-900 · 3px outlines · 4px radius
   Depth is a sibling slab (bg-gray-900, translate 4px/4px), never a blur.
   Accents: brand orange #F39C12 (primary + active), field tinted per theme.
   ============================================================ */

/** Sibling layer that fakes the hard offset shadow. Sits behind the control. */
function Slab({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rounded bg-gray-900 ${className}`}
    />
  );
}

/* ---------- Layout ---------- */

export function PageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mx-auto flex w-full max-w-5xl flex-col gap-12 bg-canvas px-4 py-10 text-gray-900 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-sm font-bold text-gray-600">{eyebrow}</p>}
        <h1 className="font-pixelify text-3xl font-bold leading-none text-gray-900 sm:text-4xl lg:text-5xl">
          {title}
          <BlockCursor className="animate-blink ml-2 inline-block h-[0.9em] w-[0.55em] text-accent" />
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-gray-600">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-pixelify text-xl font-bold leading-snug text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Button ----------
   primary   → orange fill + slab      (the one warm action)
   secondary → white fill, outline     (button-utility)
   quiet     → no outline until hover
   danger    → solid ink fill + slab   (no red: accents are never state)
*/

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

const BUTTON_BASE =
  "relative z-10 inline-flex items-center justify-center gap-2 rounded border-[3px] text-sm font-semibold tracking-[0.025em] " +
  "transition-[transform,filter] duration-100 pixel-ease motion-reduce:transition-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-900 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-gray-900 bg-accent text-onAccent px-6 py-3 leading-relaxed " +
    "enabled:hover:translate-x-0.5 enabled:hover:translate-y-0.5 enabled:hover:brightness-110 enabled:active:translate-x-1 enabled:active:translate-y-1 enabled:active:brightness-90",
  secondary:
    "border-gray-900 bg-white px-3 py-1.5 leading-snug text-ink " +
    "enabled:hover:bg-accent enabled:hover:text-onAccent enabled:active:translate-x-0.5 enabled:active:translate-y-0.5",
  quiet:
    "border-transparent bg-transparent px-3 py-1.5 leading-snug text-ink " +
    "enabled:hover:border-gray-900 enabled:hover:bg-white",
  danger:
    "border-gray-900 bg-gray-900 px-6 py-3 leading-relaxed text-onInk " +
    "enabled:hover:translate-x-0.5 enabled:hover:translate-y-0.5 enabled:hover:brightness-125 enabled:active:translate-x-1 enabled:active:translate-y-1 enabled:active:brightness-90",
};

export function Button({
  variant = "primary",
  className = "",
  fullWidth = false,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}) {
  const hasSlab = variant === "primary" || variant === "danger";

  const button = (
    <button
      disabled={disabled}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    />
  );

  // Only slab-backed variants need the wrapper.
  if (!hasSlab) return button;

  return (
    <span className={`relative ${fullWidth ? "flex w-full" : "inline-flex"} max-w-full`}>
      <Slab className={disabled ? "opacity-50" : ""} />
      {button}
    </span>
  );
}

/* ---------- Forms ---------- */

export function FieldLabel({
  htmlFor,
  children,
  required = false,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <label
        htmlFor={htmlFor}
        className="font-pixelify text-base font-bold tracking-[0.03em] text-gray-900"
      >
        {children}
        {required && (
          <span className="ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && <span className="text-sm text-gray-600">{hint}</span>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;

  return (
    <div className="relative w-full">
      <Slab />
      <input
        {...rest}
        className={
          "relative z-10 block w-full rounded border-[3px] border-gray-900 bg-field px-6 py-3.5 " +
          "text-base font-medium text-gray-900 placeholder-gray-600 " +
          "transition-transform duration-100 pixel-ease motion-reduce:transition-none " +
          "focus:translate-x-0.5 focus:translate-y-0.5 focus:outline-none " +
          "disabled:cursor-not-allowed disabled:opacity-50 " +
          className
        }
      />
    </div>
  );
}

/* ---------- Empty state (result-panel treatment) ---------- */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded border-[3px] border-gray-900 bg-white p-6 text-center">
      <p className="text-xl font-bold leading-snug text-gray-900">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
