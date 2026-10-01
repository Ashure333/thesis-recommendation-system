import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/ui";
import { Check } from "../../components/retro/PixelIcons";

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
    <div className="rounded border-[3px] border-gray-900 bg-white p-6">
      {submitted ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded border-[3px] border-gray-900 bg-accent text-lg font-bold text-onAccent">
            <Check className="h-6 w-6" />
          </div>

          <h1 className="font-pixelify text-xl font-bold leading-snug text-ink">
            Check your email
          </h1>

          <p className="mt-2 text-sm leading-5 text-muted">
            If an account exists for that email address, you will receive
            instructions to reset your password.
          </p>

          <Link
            to="/"
            className="mt-5 inline-flex rounded border-[3px] border-gray-900 bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-accent hover:text-onAccent"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-5">
            <h1 className="font-pixelify text-2xl font-bold leading-none text-ink">
              Forgot your password?
            </h1>

            <p className="mt-2 text-sm leading-5 text-muted">
              Enter your email address and we'll send you instructions to
              reset your password.
            </p>
          </div>

          {error && (
            <div role="alert" className="status-error mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="field-label mb-1.5">
                Email address
              </label>

              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded border-[3px] border-gray-900 bg-field px-3 py-2.5 text-sm font-medium text-ink placeholder:text-muted"
              />
            </div>

            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? "Sending..." : "Send reset instructions"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            Remember your password?{" "}
            <Link to="/" className="font-bold text-ink underline hover:decoration-2">
              Sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
