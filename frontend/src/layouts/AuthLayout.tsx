import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-serif text-xl text-ink">
            Paper<span className="text-gold">Rec</span>
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted">
            BulSU BSMCS
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
