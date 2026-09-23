import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!acceptedTerms) {
      setError("Please accept the terms and conditions.");
      return;
    }

    setLoading(true);

    /*
     * FAKE REGISTRATION
     *
     * Nothing is written to the backend/database.
     * We simply treat the newly registered user as logged in.
     */

    setTimeout(() => {
      localStorage.setItem("paperrec_logged_in", "true");
      localStorage.setItem("paperrec_user_email", email);
      localStorage.setItem("paperrec_user_name", name);

      setLoading(false);

      /*
       * Go directly into the existing application.
       * Existing papers remain untouched.
       */
      navigate("/search");
    }, 500);
  }

  return (
    <div className="min-h-screen bg-navy px-4 py-6 text-ink">
      <div className="mx-auto w-full max-w-sm">
        {/* Logo */}
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

        {/* Register Card */}
        <div className="mt-6 rounded-xl border border-line bg-panel p-5 shadow-2xl">
          <div className="mb-5">
            <h2 className="font-serif text-xl">Create your account</h2>

            <p className="mt-1.5 text-sm leading-5 text-muted">
              Create an account to save papers and use personalized
              recommendations.
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
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium"
              >
                Full name
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Juan Dela Cruz"
                autoComplete="name"
                className="w-full rounded-md border border-line bg-navy px-3 py-2.5 text-sm outline-none focus:border-gold"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="register-email"
                className="mb-1.5 block text-sm font-medium"
              >
                Email address
              </label>

              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-md border border-line bg-navy px-3 py-2.5 text-sm outline-none focus:border-gold"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="register-password"
                className="mb-1.5 block text-sm font-medium"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="w-full rounded-md border border-line bg-navy px-3 py-2.5 pr-16 text-sm outline-none focus:border-gold"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <p className="mt-1.5 text-xs text-muted">
                Use at least 8 characters.
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block text-sm font-medium"
              >
                Confirm password
              </label>

              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className="w-full rounded-md border border-line bg-navy px-3 py-2.5 pr-16 text-sm outline-none focus:border-gold"
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Terms */}
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />

              <span>
                I agree to the terms and conditions and acknowledge the PaperRec
                privacy policy.
              </span>
            </label>

            {/* Create account */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link to="/" className="font-medium text-gold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
