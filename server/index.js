// The Mood Grid — Express API + static host for the built React client.
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const isProd = process.env.NODE_ENV === "production";

// The six moods are the single source of truth for what the server will accept.
const MOOD_KEYS = ["happy", "content", "neutral", "sad", "angry", "overwhelmed"];

app.use(express.json());
app.use(cookieParser());

// ---------- Helpers ----------
function setSession(res, user) {
  const token = jwt.sign({ uid: user.id, name: user.name }, JWT_SECRET, {
    expiresIn: "180d",
  });
  res.cookie("mg_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 180 * 24 * 60 * 60 * 1000,
  });
}

function auth(req, res, next) {
  const token = req.cookies?.mg_session;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
}

// Wrap async route handlers so a rejected promise (e.g. a DB error) is forwarded
// to the error middleware instead of crashing the process.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Format a Date (or date-like) as YYYY-MM-DD in UTC, matching how dates are stored.
function ymd(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function isValidDateStr(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

// ---------- Profile + auth routes ----------
app.post("/api/profiles", ah(async (req, res) => {
  const { name, pin } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "A name is required." });
  }
  if (!/^\d{4,8}$/.test(String(pin || ""))) {
    return res.status(400).json({ error: "PIN must be 4–8 digits." });
  }
  const cleanName = String(name).trim();
  const existing = await prisma.user.findUnique({ where: { name: cleanName } });
  if (existing) {
    return res.status(409).json({ error: "That name is already taken." });
  }
  const pinHash = await bcrypt.hash(String(pin), 10);
  const user = await prisma.user.create({ data: { name: cleanName, pinHash } });
  setSession(res, user);
  res.status(201).json({ id: user.id, name: user.name });
}));

// Names only — never expose PIN hashes.
app.get("/api/profiles", ah(async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });
  res.json(users.map((u) => u.name));
}));

app.post("/api/login", ah(async (req, res) => {
  const { name, pin } = req.body || {};
  const user = await prisma.user.findUnique({ where: { name: String(name || "").trim() } });
  // Always run a compare to keep timing roughly constant whether or not the user exists.
  const ok = user
    ? await bcrypt.compare(String(pin || ""), user.pinHash)
    : await bcrypt.compare("x", "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok) {
    return res.status(401).json({ error: "Wrong name or PIN." });
  }
  setSession(res, user);
  res.json({ id: user.id, name: user.name });
}));

app.post("/api/logout", (_req, res) => {
  res.clearCookie("mg_session");
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => {
  res.json({ id: req.user.uid, name: req.user.name });
});

// ---------- Entry routes ----------
app.get("/api/entries", auth, ah(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const entries = await prisma.entry.findMany({
    where: { userId: req.user.uid, entryDate: { gte: start, lt: end } },
    orderBy: { entryDate: "asc" },
  });
  res.json(
    entries.map((e) => ({
      date: ymd(e.entryDate),
      mood: e.mood,
      note: e.note,
      updatedAt: e.updatedAt,
    }))
  );
}));

app.get("/api/entries/:date", auth, ah(async (req, res) => {
  const { date } = req.params;
  if (!isValidDateStr(date)) return res.status(400).json({ error: "Bad date." });
  const entry = await prisma.entry.findUnique({
    where: { userId_entryDate: { userId: req.user.uid, entryDate: new Date(date) } },
  });
  if (!entry) return res.json(null);
  res.json({ date: ymd(entry.entryDate), mood: entry.mood, note: entry.note });
}));

// Upsert a day's mood (and optional note). A null/empty mood clears the day.
app.put("/api/entries/:date", auth, ah(async (req, res) => {
  const { date } = req.params;
  if (!isValidDateStr(date)) return res.status(400).json({ error: "Bad date." });
  if (new Date(date) > new Date()) {
    return res.status(400).json({ error: "You can't log a day in the future." });
  }
  const { mood, note } = req.body || {};

  if (mood == null || mood === "") {
    await prisma.entry
      .delete({ where: { userId_entryDate: { userId: req.user.uid, entryDate: new Date(date) } } })
      .catch(() => {}); // deleting a day that isn't logged is a no-op
    return res.json(null);
  }
  if (!MOOD_KEYS.includes(mood)) {
    return res.status(400).json({ error: "Unknown mood." });
  }
  const cleanNote = note ? String(note).slice(0, 280) : null;
  const entry = await prisma.entry.upsert({
    where: { userId_entryDate: { userId: req.user.uid, entryDate: new Date(date) } },
    update: { mood, note: cleanNote },
    create: { userId: req.user.uid, entryDate: new Date(date), mood, note: cleanNote },
  });
  res.json({ date: ymd(entry.entryDate), mood: entry.mood, note: entry.note });
}));

// ---------- Stats: streaks + monthly recap ----------
app.get("/api/stats", auth, ah(async (req, res) => {
  const now = new Date();
  const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
  const month = req.query.month != null ? parseInt(req.query.month, 10) : now.getUTCMonth(); // 0-11

  const all = await prisma.entry.findMany({
    where: { userId: req.user.uid },
    select: { entryDate: true, mood: true },
    orderBy: { entryDate: "asc" },
  });

  const loggedDays = new Set(all.map((e) => ymd(e.entryDate)));

  // ---- Streaks ----
  const dayMs = 86400000;
  const todayStr = ymd(now);
  const yesterdayStr = ymd(new Date(now.getTime() - dayMs));
  let currentStreak = 0;
  // Anchor the current streak on today if logged, else yesterday (so today still "counts").
  let cursor = loggedDays.has(todayStr)
    ? new Date(todayStr)
    : loggedDays.has(yesterdayStr)
    ? new Date(yesterdayStr)
    : null;
  while (cursor && loggedDays.has(ymd(cursor))) {
    currentStreak++;
    cursor = new Date(cursor.getTime() - dayMs);
  }

  let longestStreak = 0;
  let run = 0;
  let prev = null;
  for (const dayStr of [...loggedDays].sort()) {
    if (prev && Date.parse(dayStr) - Date.parse(prev) === dayMs) {
      run++;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    prev = dayStr;
  }

  // ---- Monthly recap (for the requested month) + prior month for comparison ----
  function recapFor(y, m) {
    const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
    const counts = Object.fromEntries(MOOD_KEYS.map((k) => [k, 0]));
    let total = 0;
    for (const e of all) {
      if (ymd(e.entryDate).startsWith(prefix) && counts[e.mood] != null) {
        counts[e.mood]++;
        total++;
      }
    }
    let topMood = null;
    let topCount = 0;
    for (const k of MOOD_KEYS) {
      if (counts[k] > topCount) {
        topCount = counts[k];
        topMood = k;
      }
    }
    const positive = counts.happy + counts.content;
    return {
      year: y,
      month: m,
      counts,
      total,
      daysInMonth: new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
      topMood,
      positivityRatio: total ? Math.round((positive / total) * 100) : 0,
    };
  }

  const recap = recapFor(year, month);
  const prevMonthDate = new Date(Date.UTC(year, month - 1, 1));
  const prior = recapFor(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth());
  recap.priorTopMood = prior.topMood;

  res.json({ currentStreak, longestStreak, totalLogged: loggedDays.size, recap });
}));

// ---------- Serve the built client (production single-service deploy) ----------
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

// Central error handler: keeps the process alive when a handler rejects.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(PORT, () => {
  console.log(`Mood Grid server listening on :${PORT}`);
});
