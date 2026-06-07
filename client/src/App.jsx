import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { localYmd } from "./moods.js";
import Login from "./components/Login.jsx";
import Today from "./components/Today.jsx";
import YearGrid from "./components/YearGrid.jsx";
import Recap from "./components/Recap.jsx";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [tab, setTab] = useState("today");
  const [year, setYear] = useState(new Date().getFullYear());
  const [activeDate, setActiveDate] = useState(localYmd());
  const [entriesByDate, setEntriesByDate] = useState({});
  const [stats, setStats] = useState(null);
  const [recapMonth, setRecapMonth] = useState(new Date().getMonth());

  // Restore an existing session on first load.
  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  const loadYear = useCallback(async (y) => {
    const list = await api.entries(y);
    const map = {};
    for (const e of list) map[e.date] = e;
    setEntriesByDate(map);
  }, []);

  const loadStats = useCallback(async (y, m) => {
    setStats(await api.stats(y, m));
  }, []);

  // (Re)load data whenever we're signed in or the year changes.
  useEffect(() => {
    if (!user) return;
    loadYear(year).catch(() => {});
  }, [user, year, loadYear]);

  useEffect(() => {
    if (!user) return;
    loadStats(year, recapMonth).catch(() => {});
  }, [user, year, recapMonth, loadStats]);

  async function handleSave(date, mood, note) {
    const saved = await api.saveEntry(date, mood, note);
    setEntriesByDate((prev) => {
      const next = { ...prev };
      if (saved) next[date] = saved;
      else delete next[date];
      return next;
    });
    // Streaks/recap may have changed.
    loadStats(year, recapMonth).catch(() => {});
  }

  async function handleLogout() {
    await api.logout().catch(() => {});
    setUser(null);
    setEntriesByDate({});
    setStats(null);
  }

  function pickDayFromGrid(dateStr) {
    setActiveDate(dateStr);
    const y = +dateStr.slice(0, 4);
    if (y !== year) setYear(y);
    setTab("today");
  }

  if (user === undefined) {
    return <div className="loading">Loading…</div>;
  }
  if (user === null) {
    return <Login onAuthed={setUser} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">The Mood Grid</div>
        <div className="header-right">
          <span className="who">{user.name}</span>
          <button className="link-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="tabs">
        {[
          ["today", "Today"],
          ["grid", "Grid"],
          ["recap", "Recap"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={"tab" + (tab === id ? " active" : "")}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === "today" && (
          <Today
            date={activeDate}
            entry={entriesByDate[activeDate] || null}
            onSave={handleSave}
            onChangeDate={(d) => {
              setActiveDate(d);
              const y = +d.slice(0, 4);
              if (y !== year) setYear(y);
            }}
          />
        )}

        {tab === "grid" && (
          <YearGrid
            year={year}
            entriesByDate={entriesByDate}
            onPickDay={pickDayFromGrid}
            onChangeYear={setYear}
          />
        )}

        {tab === "recap" && (
          <>
            <div className="recap-nav">
              <button
                className="nav-btn"
                onClick={() => setRecapMonth((m) => (m + 11) % 12)}
                aria-label="Previous month"
              >
                ‹
              </button>
              <span>Month</span>
              <button
                className="nav-btn"
                onClick={() => setRecapMonth((m) => (m + 1) % 12)}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <Recap stats={stats} />
          </>
        )}
      </main>
    </div>
  );
}
