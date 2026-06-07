/* The Mood Grid — daily mood tracker
 * Data is stored locally in the browser (localStorage). No server, no account.
 */

// Mood definitions, in the order they appear on the sheet.
const MOODS = [
  { key: "happy", label: "Happy", emoji: "😄", color: "var(--happy)" },
  { key: "content", label: "Content", emoji: "🙂", color: "var(--content)" },
  { key: "neutral", label: "Neutral", emoji: "😐", color: "var(--neutral)" },
  { key: "sad", label: "Sad", emoji: "😢", color: "var(--sad)" },
  { key: "angry", label: "Angry", emoji: "😠", color: "var(--angry)" },
  { key: "overwhelmed", label: "Overwhelmed", emoji: "🥵", color: "var(--overwhelmed)" },
];

const MOOD_BY_KEY = Object.fromEntries(MOODS.map((m) => [m.key, m]));
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const STORAGE_KEY = "mood-grid-v1";

// ---------- State ----------
let entries = loadEntries(); // { "YYYY-MM-DD": moodKey }
let selectedMood = MOODS[0].key;
let viewYear = new Date().getFullYear();

// ---------- Persistence ----------
function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ---------- Date helpers ----------
function isoDate(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function todayIso() {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

// ---------- Rendering ----------
function renderPalette() {
  const palette = document.querySelector(".palette");
  palette.innerHTML = "";
  MOODS.forEach((mood) => {
    const btn = document.createElement("button");
    btn.className = "mood-btn";
    btn.type = "button";
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(mood.key === selectedMood));
    btn.dataset.mood = mood.key;
    btn.innerHTML = `<span class="swatch" style="background:${mood.color}"></span>${mood.emoji} ${mood.label}`;
    btn.addEventListener("click", () => {
      selectedMood = mood.key;
      renderPalette();
    });
    palette.appendChild(btn);
  });
}

function renderGrid() {
  document.getElementById("yearLabel").textContent = viewYear;
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  const today = todayIso();

  for (let month = 0; month < 12; month++) {
    const card = document.createElement("div");
    card.className = "month-card";

    const title = document.createElement("h3");
    title.textContent = MONTH_NAMES[month];
    card.appendChild(title);

    const days = document.createElement("div");
    days.className = "days";

    const daysInMonth = new Date(viewYear, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = isoDate(viewYear, month, d);
      const cell = document.createElement("button");
      cell.className = "day";
      cell.type = "button";
      cell.textContent = d;
      cell.title = iso;

      const moodKey = entries[iso];
      if (moodKey && MOOD_BY_KEY[moodKey]) {
        cell.classList.add("filled");
        cell.style.background = MOOD_BY_KEY[moodKey].color;
        cell.title = `${iso} — ${MOOD_BY_KEY[moodKey].label}`;
      }
      if (iso === today) cell.classList.add("today");
      if (iso > today) cell.classList.add("future");

      cell.addEventListener("click", () => onDayClick(iso, cell));
      days.appendChild(cell);
    }

    card.appendChild(days);
    grid.appendChild(card);
  }
}

function onDayClick(iso, cell) {
  if (iso > todayIso()) return; // can't log the future

  // Click again with the same mood already set => clear it.
  if (entries[iso] === selectedMood) {
    delete entries[iso];
  } else {
    entries[iso] = selectedMood;
  }
  saveEntries();
  renderGrid();
  renderStats();
}

function renderStats() {
  const stats = document.getElementById("stats");
  const counts = {};
  let total = 0;
  for (const [iso, key] of Object.entries(entries)) {
    if (iso.startsWith(String(viewYear)) && MOOD_BY_KEY[key]) {
      counts[key] = (counts[key] || 0) + 1;
      total++;
    }
  }

  let html = `<h3>${viewYear} summary — ${total} day${total === 1 ? "" : "s"} logged</h3>`;
  if (total === 0) {
    html += `<p style="color:var(--muted);margin:0;">No moods logged yet this year. Pick a mood above and click today's circle to begin.</p>`;
  } else {
    html += `<div class="stat-bars">`;
    MOODS.forEach((mood) => {
      const count = counts[mood.key] || 0;
      const pct = total ? Math.round((count / total) * 100) : 0;
      html += `
        <div class="stat-row">
          <span>${mood.emoji} ${mood.label}</span>
          <span class="stat-track"><span class="stat-fill" style="width:${pct}%;background:${mood.color}"></span></span>
          <span class="stat-count">${count}</span>
        </div>`;
    });
    html += `</div>`;
  }
  stats.innerHTML = html;
}

// ---------- Tools ----------
function logToday() {
  const iso = todayIso();
  if (viewYear !== new Date().getFullYear()) {
    viewYear = new Date().getFullYear();
  }
  entries[iso] = selectedMood;
  saveEntries();
  renderGrid();
  renderStats();
  const cell = [...document.querySelectorAll(".day")].find((c) =>
    c.title.startsWith(iso)
  );
  if (cell) cell.scrollIntoView({ behavior: "smooth", block: "center" });
}

function exportData() {
  const blob = new Blob([JSON.stringify(entries, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mood-grid-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (typeof data !== "object" || Array.isArray(data)) throw new Error();
      // Merge imported entries, keeping only valid mood keys.
      for (const [iso, key] of Object.entries(data)) {
        if (MOOD_BY_KEY[key]) entries[iso] = key;
      }
      saveEntries();
      renderGrid();
      renderStats();
    } catch {
      alert("That file doesn't look like a valid Mood Grid backup.");
    }
  };
  reader.readAsText(file);
}

// ---------- Wiring ----------
function init() {
  renderPalette();
  renderGrid();
  renderStats();

  document.getElementById("prevYear").addEventListener("click", () => {
    viewYear--;
    renderGrid();
    renderStats();
  });
  document.getElementById("nextYear").addEventListener("click", () => {
    viewYear++;
    renderGrid();
    renderStats();
  });
  document.getElementById("todayBtn").addEventListener("click", logToday);
  document.getElementById("exportBtn").addEventListener("click", exportData);

  const importFile = document.getElementById("importFile");
  document.getElementById("importBtn").addEventListener("click", () =>
    importFile.click()
  );
  importFile.addEventListener("change", (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = "";
  });
}

init();
