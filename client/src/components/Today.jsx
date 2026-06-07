import { useState } from "react";
import { MOODS, MOOD_BY_KEY, localYmd } from "../moods.js";
import { ACTIVITIES } from "../activities.js";

// The core loop: pick a mood for a day, check off habits, add an optional note.
export default function Today({ date, entry, onSave, onChangeDate }) {
  const [note, setNote] = useState(entry?.note || "");
  const [activities, setActivities] = useState(entry?.activities || []);
  const [saving, setSaving] = useState(false);
  const selected = entry?.mood || null;
  const isToday = date === localYmd();

  // Keep local state in sync when the day or its saved entry changes.
  const syncKey = `${date}:${entry?.note || ""}:${(entry?.activities || []).join(",")}`;
  const [lastKey, setLastKey] = useState(syncKey);
  if (syncKey !== lastKey) {
    setLastKey(syncKey);
    setNote(entry?.note || "");
    setActivities(entry?.activities || []);
  }

  // Every save sends the full state for the day so nothing gets dropped.
  async function persist(nextMood, nextNote, nextActivities) {
    setSaving(true);
    await onSave(date, nextMood, nextNote, nextActivities);
    setSaving(false);
  }

  async function pickMood(moodKey) {
    // Tapping the already-selected mood clears it (the day can still hold habits).
    const next = moodKey === selected ? "" : moodKey;
    await persist(next, note, activities);
  }

  async function toggleActivity(key) {
    const next = activities.includes(key)
      ? activities.filter((a) => a !== key)
      : [...activities, key];
    setActivities(next);
    await persist(selected || "", note, next);
  }

  async function saveNote() {
    if ((entry?.note || "") === note) return; // nothing changed
    await persist(selected || "", note, activities);
  }

  const prettyDate = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function shiftDay(delta) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const next = localYmd(d);
    if (next > localYmd()) return; // no logging the future
    onChangeDate(next);
  }

  const positives = ACTIVITIES.filter((a) => a.positive);
  const negatives = ACTIVITIES.filter((a) => !a.positive);

  function habitButton(a) {
    const on = activities.includes(a.key);
    return (
      <button
        key={a.key}
        className={
          "habit-btn" + (on ? " on" : "") + (a.positive ? " pos" : " neg")
        }
        disabled={saving}
        onClick={() => toggleActivity(a.key)}
      >
        <span className="habit-emoji">{a.emoji}</span>
        {a.label}
      </button>
    );
  }

  return (
    <section className="today-card">
      <div className="today-head">
        <button className="nav-btn" onClick={() => shiftDay(-1)} aria-label="Previous day">
          ‹
        </button>
        <div className="today-date">
          <h2>{isToday ? "Today" : prettyDate}</h2>
          {isToday && <span className="muted">{prettyDate}</span>}
        </div>
        <button
          className="nav-btn"
          onClick={() => shiftDay(1)}
          disabled={isToday}
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      <p className="prompt">
        How did you feel by the end of the day? Did the routine make a difference?
      </p>

      <div className="mood-circles">
        {MOODS.map((m) => (
          <button
            key={m.key}
            className={"mood-circle" + (selected === m.key ? " active" : "")}
            disabled={saving}
            onClick={() => pickMood(m.key)}
            title={m.label}
          >
            <span className="dot" style={{ background: m.color }}>
              {m.emoji}
            </span>
            <span className="mood-label">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="habits">
        <h3 className="habits-title">What did you do today?</h3>
        <div className="habit-group">{positives.map(habitButton)}</div>
        <div className="habit-group">{negatives.map(habitButton)}</div>
        <p className="habits-hint">
          Check off your day — over time the Recap shows which habits lift your mood.
        </p>
      </div>

      <div className="note-row">
        <textarea
          rows={2}
          maxLength={280}
          placeholder="Optional: one line about your day…"
          value={note}
          disabled={saving}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
        />
      </div>

      {selected && (
        <p className="today-status">
          Logged as <strong>{MOOD_BY_KEY[selected].label}</strong>. Tap it again to
          clear.
        </p>
      )}
    </section>
  );
}
