// The six moods from the worksheet — the single source of truth for the UI.
export const MOODS = [
  { key: "happy", label: "Happy", color: "#2E7D32" },
  { key: "content", label: "Content", color: "#8BC34A" },
  { key: "neutral", label: "Neutral", color: "#64B5F6" },
  { key: "sad", label: "Sad", color: "#7E57C2" },
  { key: "angry", label: "Angry", color: "#FB8C00" },
  { key: "overwhelmed", label: "Overwhelmed", color: "#E53935" },
];

export const MOOD_BY_KEY = Object.fromEntries(MOODS.map((m) => [m.key, m]));

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Local YYYY-MM-DD (uses the device's calendar day, not UTC).
export function localYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
