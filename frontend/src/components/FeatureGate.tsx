/**
 * FEATURE GATE — route guard for Library Mode feature states.
 *
 * Researcher mode passes everything through. In Library mode a
 * "shown" feature renders normally; "locked" and "hidden" features
 * render a padlock panel with a switch-mode call to action, so a
 * stale bookmark can't skip the site editor's lineup.
 */

import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";

import { featureByKey } from "../data/siteFeatures";
import { useSiteMode } from "../state/siteMode";
import { Lock } from "./retro/PixelIcons";

export default function FeatureGate({
  feature,
  children,
}: {
  feature: string;
  children: ReactNode;
}) {
  const { mode, stateFor, setMode } = useSiteMode();
  const state = stateFor(feature);

  if (state === "shown") {
    return <>{children}</>;
  }

  // The shipped build has no switch to offer: send them somewhere that works.
  if (mode === "presentation") return <Navigate to="/repository" replace />;

  const meta = featureByKey(feature);
  const label = meta?.label ?? "This area";

  return (
    <div
      data-feature-gate={feature}
      data-feature-state={state}
      className="mx-auto mt-10 w-full max-w-xl rounded border-[3px] border-gray-900 bg-white p-8 text-center"
    >
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded border-[3px] border-gray-900 bg-canvas shadow-[3px_3px_0_rgba(0,0,0,0.2)]">
        <Lock className="h-7 w-7 text-ink" />
      </span>

      <h1 className="font-pixelify text-xl font-bold leading-snug text-ink">
        {label} lives in Researcher mode
      </h1>

      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
        {state === "locked"
          ? "The library side keeps the essentials — search, browse, saved papers, and help. Unlock the full toolkit by switching modes."
          : "The site editor has this area out of the current library lineup. You can still open it from Researcher mode."}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setMode("researcher")}
          className="ui-button ui-button-primary"
        >
          Switch to Researcher mode
        </button>

        <Link to="/home" className="ui-button ui-button-secondary">
          Back to Library Home
        </Link>
      </div>
    </div>
  );
}
