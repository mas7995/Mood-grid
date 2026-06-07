import { useState } from "react";
import { MOODS, MOOD_BY_KEY, localYmd } from "../moods.js";

// The core loop: pick a mood for a day, add an optional reflection note.
export default function Today({ date, entry, onSave, onChangeDate }) {
  const [note, setNote] = useState(entry?.note || "");
  const [saving, setSaving] = useState(false);
  const selected = entry?.mood || null;
  const isToday = date === localYmd();

  // Keep the note box in sync when the day or its entry changes.
  const noteKey = `${date}:${entry?.note || ""}`;
  const [lastKey, setLastKey] = useState(noteKey);
  if (noteKey !== lastKey) {
    setLastKey(noteKey);
    setNote(entry?.note || "");
  }

  async function pick(moodKey) {
    setSaving(true);
    // Tapping the already-selected mood clears the day.
    const next = moodKey === selected ? "" : moodKey;
    await onSave(date, next, note);
    setSaving(false);
  }

  async function saveNote() {
    if (!selected) return;
    setSaving(true);
    await onSave(date, selected, note);
    setSaving(false);
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
            onClick={() => pick(m.key)}
            title={m.label}
          >
            <span className="dot" style={{ background: m.color }} />
            <span className="mood-label">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="note-row">
        <textarea
          rows={2}
          maxLength={280}
          placeholder={
            selected
              ? "Optional: one line about your day…"
              : "Pick a mood first to add a note."
          }
          value={note}
          disabled={!selected || saving}
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
