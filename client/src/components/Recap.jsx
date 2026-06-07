import { MOODS, MOOD_BY_KEY, MONTH_NAMES } from "../moods.js";

// Streaks + the monthly recap — the "data talking back to you" view.
export default function Recap({ stats }) {
  if (!stats) return null;
  const { currentStreak, longestStreak, recap, habits = [] } = stats;
  const { counts, total, daysInMonth, topMood, positivityRatio, priorTopMood, month, year } =
    recap;

  let summary;
  if (total === 0) {
    summary = `No days logged yet in ${MONTH_NAMES[month]}. Tonight's a good place to start.`;
  } else {
    const top = MOOD_BY_KEY[topMood]
      ? `${MOOD_BY_KEY[topMood].emoji} ${MOOD_BY_KEY[topMood].label}`
      : "—";
    const changed =
      priorTopMood && priorTopMood !== topMood
        ? `, up from ${MOOD_BY_KEY[priorTopMood]?.emoji} ${MOOD_BY_KEY[priorTopMood]?.label} last month`
        : "";
    summary = `You logged ${total} of ${daysInMonth} days. Your most common mood was ${top}${changed}.`;
  }

  return (
    <section className="recap-card">
      <div className="streaks">
        <div className="streak">
          <span className="streak-num">{currentStreak}</span>
          <span className="streak-label">current streak</span>
        </div>
        <div className="streak">
          <span className="streak-num">{longestStreak}</span>
          <span className="streak-label">longest streak</span>
        </div>
        <div className="streak">
          <span className="streak-num">{positivityRatio}%</span>
          <span className="streak-label">positivity this month</span>
        </div>
      </div>

      <h3>
        {MONTH_NAMES[month]} {year}
      </h3>
      <p className="recap-summary">{summary}</p>

      <div className="recap-bars">
        {MOODS.map((m) => {
          const c = counts[m.key] || 0;
          const pct = total ? Math.round((c / total) * 100) : 0;
          return (
            <div className="recap-row" key={m.key}>
              <span className="recap-name">
                <span className="recap-emoji">{m.emoji}</span> {m.label}
              </span>
              <span className="recap-track">
                <span
                  className="recap-fill"
                  style={{ width: `${pct}%`, background: m.color }}
                />
              </span>
              <span className="recap-count">{c}</span>
            </div>
          );
        })}
      </div>

      <div className="insights">
        <h3>What's moving your mood</h3>
        {habits.length === 0 ? (
          <p className="insights-empty">
            Keep checking off your habits each day. After about a week, you'll see
            which ones tend to lift your mood — and which drag it down.
          </p>
        ) : (
          <ul className="insight-list">
            {habits.map((h) => {
              // A "good" signal means the habit lines up with feeling good:
              // positive habits with a higher delta, negative habits with a lower one.
              const good = h.positive ? h.delta >= 0 : h.delta <= 0;
              const sign = h.delta > 0 ? "+" : "";
              return (
                <li className="insight-row" key={h.key}>
                  <span className="insight-name">
                    {h.emoji} {h.label}
                  </span>
                  <span className="insight-text">
                    felt good <strong>{h.withPositivity}%</strong> of days you did
                    it · <span className="muted">{h.withoutPositivity}% otherwise</span>
                  </span>
                  <span className={"insight-delta " + (good ? "up" : "down")}>
                    {sign}
                    {h.delta}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
