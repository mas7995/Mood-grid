import { useEffect, useState } from "react";
import { api } from "../api.js";

// Profile picker + PIN, with a first-run "create profile" flow.
export default function Login({ onAuthed }) {
  const [profiles, setProfiles] = useState([]);
  const [mode, setMode] = useState("login"); // "login" | "create"
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .listProfiles()
      .then((list) => {
        setProfiles(list);
        if (list.length === 0) setMode("create");
        else setName(list[0]);
      })
      .catch(() => setMode("create"));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user =
        mode === "create"
          ? await api.createProfile(name.trim(), pin)
          : await api.login(name, pin);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
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
          {mode === "login" && profiles.length > 0 ? (
            <label className="field">
              <span>Profile</span>
              <select value={name} onChange={(e) => setName(e.target.value)}>
                {profiles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          ) : (
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
            <span>PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              value={pin}
              placeholder="4–8 digits"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? "…" : mode === "create" ? "Create profile" : "Sign in"}
          </button>
        </form>

        <button
          className="link-btn"
          onClick={() => {
            setError("");
            setMode(mode === "create" ? "login" : "create");
          }}
        >
          {mode === "create"
            ? profiles.length > 0
              ? "Back to sign in"
              : ""
            : "Create a new profile"}
        </button>
      </div>
    </div>
  );
}
