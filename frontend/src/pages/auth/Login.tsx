import { Link } from "react-router-dom";
import { Button, PageShell } from "../../components/ui";

export default function Login() {
  return (
    <PageShell className="flex min-h-[70vh] items-center justify-center">
      <section className="w-full max-w-sm">
        <p className="mb-2 text-xs uppercase tracking-[0.12em] text-muted">Account</p>
        <h1 className="font-serif text-2xl text-ink">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Authentication is not wired up yet. The repository pages can be opened directly during frontend development.
        </p>
        <div className="mt-6 space-y-3">
          <Button type="button" className="w-full" disabled>Sign in</Button>
          <Link to="/search" className="flex min-h-9 items-center justify-center rounded-md border border-line px-3 text-sm text-ink hover:bg-panelAlt">
            Continue to repository
          </Link>
        </div>
        <p className="mt-5 text-center text-xs text-muted">
          Need an account? <Link to="/register" className="text-gold hover:underline">Register</Link>
        </p>
      </section>
    </PageShell>
  );
}
