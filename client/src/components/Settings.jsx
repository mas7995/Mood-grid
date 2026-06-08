import { useState } from "react";
import { api } from "../api.js";
import Privacy from "./Privacy.jsx";

// Account management: change password, delete account, read the privacy policy.
export default function Settings({ user, onSignedOut }) {
  const [view, setView] = useState("main"); // "main" | "privacy"
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    setBusy(true);
    try {
      await api.changePassword(cur, next);
      setPwMsg({ ok: true, text: "Password updated." });
      setCur("");
      setNext("");
    } catch (err) {
      setPwMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await api.deleteAccount();
      onSignedOut();
    } catch {
      setBusy(false);
    }
  }

  if (view === "privacy") {
    return (
      <section className="settings-card">
        <Privacy />
        <button className="tool-btn" onClick={() => setView("main")}>
          Back to settings
        </button>
      </section>
    );
  }

  return (
    <section className="settings-card">
      <h2>Settings</h2>
      <p className="muted">
        Signed in as <strong>{user.name}</strong> ({user.email})
      </p>

      <h3>Change password</h3>
      <form onSubmit={changePassword} className="settings-form">
        <input
          type="password"
          placeholder="Current password"
          autoComplete="current-password"
          value={cur}
          onChange={(e) => setCur(e.target.value)}
        />
        <input
          type="password"
          placeholder="New password (8+ characters)"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        {pwMsg && (
          <p className={pwMsg.ok ? "settings-ok" : "auth-error"}>{pwMsg.text}</p>
        )}
        <button className="primary-btn" type="submit" disabled={busy}>
          Update password
        </button>
      </form>

      <h3>Privacy</h3>
      <button className="tool-btn" onClick={() => setView("privacy")}>
        Read the privacy policy
      </button>

      <h3 className="danger-title">Danger zone</h3>
      {!confirmDelete ? (
        <button className="danger-btn" onClick={() => setConfirmDelete(true)}>
          Delete my account & data
        </button>
      ) : (
        <div className="confirm-delete">
          <p>
            This permanently deletes your account and every mood you've logged.
            This cannot be undone.
          </p>
          <div className="confirm-row">
            <button className="danger-btn" onClick={deleteAccount} disabled={busy}>
              Yes, delete everything
            </button>
            <button className="tool-btn" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
