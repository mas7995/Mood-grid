import { useState } from "react";
import { MOOD_BY_KEY, MONTH_NAMES, localYmd } from "../moods.js";

// The signature view: months as columns, days as rows. Full year on desktop;
// a single month on mobile with a toggle to the full-year scroll view.
export default function YearGrid({ year, entriesByDate, onPickDay, onChangeYear }) {
  const isNarrow = typeof window !== "undefined" && window.innerWidth < 720;
  const [mobileFullYear, setMobileFullYear] = useState(false);
  const [mobileMonth, setMobileMonth] = useState(new Date().getMonth());

  const today = localYmd();

  function cell(year, month, day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    const mood = entriesByDate[dateStr]?.mood;
    const filled = mood && MOOD_BY_KEY[mood];
    const future = dateStr > today;
    return (
      <button
        key={dateStr}
        className={
          "grid-cell" +
          (filled ? " filled" : "") +
          (dateStr === today ? " is-today" : "") +
          (future ? " future" : "")
        }
        style={filled ? { background: MOOD_BY_KEY[mood].color } : undefined}
        disabled={future}
        title={filled ? `${dateStr} — ${MOOD_BY_KEY[mood].label}` : dateStr}
        onClick={() => !future && onPickDay(dateStr)}
      >
        {day}
      </button>
    );
  }

  function monthColumn(month) {
    const days = new Date(year, month + 1, 0).getDate();
    return (
      <div className="month-col" key={month}>
        <h4>{MONTH_NAMES[month].slice(0, 3)}</h4>
        <div className="month-days">
          {Array.from({ length: days }, (_, i) => cell(year, month, i + 1))}
        </div>
      </div>
    );
  }

  const showFullYear = !isNarrow || mobileFullYear;

  return (
    <section className="grid-section">
      <div className="grid-head">
        <div className="year-nav">
          <button className="nav-btn" onClick={() => onChangeYear(year - 1)} aria-label="Previous year">
            ‹
          </button>
          <h3>{year}</h3>
          <button className="nav-btn" onClick={() => onChangeYear(year + 1)} aria-label="Next year">
            ›
          </button>
        </div>

        {isNarrow && (
          <div className="mobile-toggle">
            {!mobileFullYear && (
              <select value={mobileMonth} onChange={(e) => setMobileMonth(+e.target.value)}>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <button className="tool-btn" onClick={() => setMobileFullYear((v) => !v)}>
              {mobileFullYear ? "Single month" : "Full year"}
            </button>
          </div>
        )}
      </div>

      {showFullYear ? (
        <div className="year-scroll">
          <div className="year-columns">
            {MONTH_NAMES.map((_, m) => monthColumn(m))}
          </div>
        </div>
      ) : (
        <div className="single-month">{monthColumn(mobileMonth)}</div>
      )}
    </section>
  );
}
