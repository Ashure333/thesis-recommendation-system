import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui";
import HuntItem from "../../components/retro/HuntItem";
import { HUNT_ITEMS } from "../../data/hunt";

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
       * Go to the existing Re:Search application.
       * The repository/database is NOT changed.
       */
      navigate("/recommendations");
    }, 500);
  }

  return (
    <>
      <div data-tips="login-card" className="rounded border-[3px] border-gray-900 bg-white p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold leading-none tracking-tight text-ink">
          Welcome back
        </h1>

        <p className="mt-2 text-sm leading-5 text-muted">
          Sign in to access your paper repository and recommendations.
        </p>
      </div>

      {error && (
        <div role="alert" className="status-error mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label htmlFor="email" className="field-label mb-1.5">
            Email address
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded border-[3px] border-gray-900 bg-field px-3 py-2.5 text-sm font-medium text-ink placeholder:text-muted"
          />
        </div>

        {/* Password */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor="password" className="field-label">
              Password
            </label>

            <Link
              to="/forgot-password"
              className="text-xs font-bold text-ink underline hover:decoration-2"
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
              className="w-full rounded border-[3px] border-gray-900 bg-field px-3 py-2.5 pr-16 text-sm font-medium text-ink placeholder:text-muted"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-bold text-ink hover:bg-accentSoft"
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
        <Button
          type="submit"
          variant="primary"
          fullWidth
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-bold text-muted">OR</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <p className="text-center text-sm text-muted">
        Don't have an account?{" "}
        <Link
          to="/register"
          className="font-bold text-ink underline hover:decoration-2"
        >
          Create an account
        </Link>
      </p>
      </div>

      <HuntItem item={HUNT_ITEMS.find((item) => item.id === "hunt-coin")!} />
    </>
  );
}
