// Daily habit check-ins. Positives are things that tend to lift mood; negatives
// are things to watch. The recap correlates these against how you felt.
export const ACTIVITIES = [
  { key: "exercise", label: "Exercised", emoji: "🏃", positive: true },
  { key: "steps", label: "10k steps", emoji: "👟", positive: true },
  { key: "sleptWell", label: "Slept well", emoji: "😴", positive: true },
  { key: "wokeOnTime", label: "Woke on time", emoji: "⏰", positive: true },
  { key: "ateWell", label: "Ate well", emoji: "🥗", positive: true },
  { key: "outdoors", label: "Time outside", emoji: "🌳", positive: true },
  { key: "alcohol", label: "Alcohol", emoji: "🍷", positive: false },
  { key: "junkFood", label: "Junk food", emoji: "🍔", positive: false },
];

export const ACTIVITY_BY_KEY = Object.fromEntries(
  ACTIVITIES.map((a) => [a.key, a])
);
