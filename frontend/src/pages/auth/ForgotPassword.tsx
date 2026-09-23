import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  }

  return (
    <div className="min-h-screen bg-navy px-4 py-6 text-ink">
      <div className="mx-auto w-full max-w-sm">
        {/* Logo / Header */}
        <div className="pt-2 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-gold/50 text-base font-semibold text-gold">
            R
          </div>

          <h1 className="font-serif text-2xl">
            Paper<span className="text-gold">Rec</span>
          </h1>

          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted">
            BulSU BSMCS
          </p>
        </div>

        {/* Forgot Password Card */}
        <div className="mt-6 rounded-xl border border-line bg-panel p-5 shadow-2xl">
          {submitted ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                ✓
              </div>

              <h2 className="font-serif text-xl">Check your email</h2>

              <p className="mt-2 text-sm leading-5 text-muted">
                If an account exists for that email address, you will receive
                instructions to reset your password.
              </p>

              <Link
                to="/"
                className="mt-5 inline-flex rounded-md border border-line px-4 py-2 text-sm text-ink hover:bg-panelAlt"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="font-serif text-xl">Forgot your password?</h2>

                <p className="mt-1.5 text-sm leading-5 text-muted">
                  Enter your email address and we'll send you instructions to
                  reset your password.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="forgot-email"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Email address
                  </label>

                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full rounded-md border border-line bg-navy px-3 py-2.5 text-sm outline-none focus:border-gold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Send reset instructions"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-muted">
                Remember your password?{" "}
                <Link to="/" className="font-medium text-gold hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
