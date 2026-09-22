import { Link } from "react-router-dom";
import { Button, PageShell } from "../../components/ui";

export default function Register() {
  return (
    <PageShell className="flex min-h-[70vh] items-center justify-center">
      <section className="w-full max-w-sm">
        <p className="mb-2 text-xs uppercase tracking-[0.12em] text-muted">Account</p>
        <h1 className="font-serif text-2xl text-ink">Create an account</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Registration is not wired up yet. This screen is kept intentionally simple until authentication is implemented.
        </p>
        <div className="mt-6 space-y-3">
          <Button type="button" className="w-full" disabled>Create account</Button>
          <Link to="/" className="flex min-h-9 items-center justify-center rounded-md border border-line px-3 text-sm text-ink hover:bg-panelAlt">
            Back to sign in
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
