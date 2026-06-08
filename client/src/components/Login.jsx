import { useState } from "react";
import { api } from "../api.js";
import Privacy from "./Privacy.jsx";

// Email + password auth, with a sign in / create account toggle.
export default function Login({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (isSignup && !consent) {
      setError("Please agree to the privacy policy to create an account.");
      return;
    }
    setBusy(true);
    try {
      const user = isSignup
        ? await api.signup(name.trim(), email.trim(), password)
        : await api.login(email.trim(), password);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (showPrivacy) {
    return (
      <div className="auth-wrap">
        <div className="auth-card privacy-card">
          <Privacy />
          <button className="primary-btn" onClick={() => setShowPrivacy(false)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>The Mood Grid</h1>
        <p className="auth-tagline">
          Check in each evening. Over time the grid shows your real trend — not
          just how today happens to feel.
        </p>

        <form onSubmit={submit}>
          {isSignup && (
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                value={name}
                autoFocus
                placeholder="Your name"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              placeholder={isSignup ? "At least 8 characters" : "Your password"}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {isSignup && (
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => setShowPrivacy(true)}
                >
                  privacy policy
                </button>
                .
              </span>
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? "…" : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <button className="link-btn" onClick={() => setShowPrivacy(true)}>
          Privacy policy
        </button>

        <button
          className="link-btn"
          onClick={() => {
            setError("");
            setMode(isSignup ? "login" : "signup");
          }}
        >
          {isSignup
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
