import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui";

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
    <div className="rounded border-[3px] border-gray-900 bg-white p-6">
      <div className="mb-5">
        <h1 className="font-pixelify text-2xl font-bold leading-none text-ink">
          Create your account
        </h1>

        <p className="mt-2 text-sm leading-5 text-muted">
          Create an account to save papers and use personalized
          recommendations.
        </p>
      </div>

      {error && (
        <div role="alert" className="status-error mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="name" className="field-label mb-1.5">
            Full name
          </label>

          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Juan Dela Cruz"
            autoComplete="name"
            className="w-full rounded border-[3px] border-gray-900 bg-field px-3 py-2.5 text-sm font-medium text-ink placeholder:text-muted"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="register-email" className="field-label mb-1.5">
            Email address
          </label>

          <input
            id="register-email"
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
          <label htmlFor="register-password" className="field-label mb-1.5">
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

          <p className="mt-1.5 text-xs text-muted">
            Use at least 8 characters.
          </p>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirm-password" className="field-label mb-1.5">
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
              className="w-full rounded border-[3px] border-gray-900 bg-field px-3 py-2.5 pr-16 text-sm font-medium text-ink placeholder:text-muted"
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-bold text-ink hover:bg-accentSoft"
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
            I agree to the terms and conditions and acknowledge the Re:Search
            privacy policy.
          </span>
        </label>

        {/* Create account */}
        <Button type="submit" variant="primary" fullWidth disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/" className="font-bold text-ink underline hover:decoration-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}
