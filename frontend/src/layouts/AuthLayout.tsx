import { Outlet } from "react-router-dom";
import { BlockCursor } from "../components/retro/PixelIcons";

import PixelPet from "../components/retro/PixelPet";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="animate-route-in mb-6 text-center">
          <div className="retro-wiggle mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded border-[3px] border-gray-900 bg-accent text-lg font-bold text-onAccent">
            R
          </div>

          <p className="text-2xl font-bold leading-none tracking-tight text-ink">
            Re:Search
            <BlockCursor className="animate-blink ml-1.5 inline-block h-[0.8em] w-[0.5em]" />
          </p>

          <p className="mt-1.5 text-sm text-muted">BulSU BSMCS</p>
        </div>

        <div className="animate-route-in">
          <Outlet />
        </div>

        <p className="animate-blink mt-6 text-center font-mono text-xs font-bold tracking-[0.25em] text-muted">
          PRESS ENTER TO CONTINUE
        </p>
      </div>

      <PixelPet />
    </div>
  );
}