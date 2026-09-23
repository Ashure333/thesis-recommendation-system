import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    /*
     * FAKE LOGIN
     *
     * We don't contact the backend.
     * We simply remember that the user is logged in.
     */

    setTimeout(() => {
      localStorage.setItem("paperrec_logged_in", "true");
      localStorage.setItem("paperrec_user_email", email);

      if (rememberMe) {
        localStorage.setItem("paperrec_remember_me", "true");
      } else {
        localStorage.removeItem("paperrec_remember_me");
      }

      setLoading(false);

      /*
       * Go to the existing PaperRec application.
       * The repository/database is NOT changed.
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

        {/* Login Card */}
        <div className="mt-6 rounded-xl border border-line bg-panel p-5 shadow-2xl">
          <div className="mb-5">
            <h2 className="font-serif text-xl">Welcome back</h2>

            <p className="mt-1.5 text-sm leading-5 text-muted">
              Sign in to access your paper repository and recommendations.
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
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-md border border-line bg-navy px-3 py-2.5 text-sm text-ink outline-none transition focus:border-gold"
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>

                <Link
                  to="/forgot-password"
                  className="text-xs text-gold hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-md border border-line bg-navy px-3 py-2.5 pr-16 text-sm text-ink outline-none transition focus:border-gold"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4"
              />
              Remember me
            </label>

            {/* Sign in */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[10px] text-muted">OR</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <p className="text-center text-sm text-muted">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-gold hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
