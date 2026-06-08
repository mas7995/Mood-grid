import { useEffect, useState } from "react";
import { api } from "../api.js";
import { MOODS } from "../moods.js";

// Owner-only dashboard: aggregate usage, never individual notes/moods.
export default function Admin() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.adminOverview(), api.adminUsers()])
      .then(([o, u]) => {
        setOverview(o);
        setUsers(u);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <section className="admin-card"><p className="auth-error">{error}</p></section>;
  if (!overview || !users) return <section className="admin-card"><p className="muted">Loading…</p></section>;

  const totalMoods = MOODS.reduce(
    (sum, m) => sum + (overview.moodDistribution[m.key] || 0),
    0
  );

  return (
    <section className="admin-card">
      <h2>Admin</h2>

      <div className="admin-stats">
        {[
          ["Total users", overview.totalUsers],
          ["Total entries", overview.totalEntries],
          ["New users · 7d", overview.newUsers7d],
          ["New users · 30d", overview.newUsers30d],
          ["Active users · 7d", overview.activeUsers7d],
        ].map(([label, val]) => (
          <div className="admin-stat" key={label}>
            <span className="admin-stat-num">{val}</span>
            <span className="admin-stat-label">{label}</span>
          </div>
        ))}
      </div>

      <h3>Mood distribution (all users)</h3>
      <div className="recap-bars">
        {MOODS.map((m) => {
          const c = overview.moodDistribution[m.key] || 0;
          const pct = totalMoods ? Math.round((c / totalMoods) * 100) : 0;
          return (
            <div className="recap-row" key={m.key}>
              <span className="recap-name">
                <span className="recap-emoji">{m.emoji}</span> {m.label}
              </span>
              <span className="recap-track">
                <span className="recap-fill" style={{ width: `${pct}%`, background: m.color }} />
              </span>
              <span className="recap-count">{c}</span>
            </div>
          );
        })}
      </div>

      <h3>Users ({users.length})</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Joined</th>
              <th>Entries</th>
              <th>Last entry</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>{u.entryCount}</td>
                <td>{u.lastEntry || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted admin-note">
        Aggregate usage only — individual moods and notes are never shown here.
      </p>
    </section>
  );
}
