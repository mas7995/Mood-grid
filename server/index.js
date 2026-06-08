// The Mood Grid — Express API + static host for the built React client.
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

// Railway runs the app behind a proxy; trust it so rate limiting keys on the
// real client IP and secure cookies work.
app.set("trust proxy", 1);

// Security headers. CSP allows same-origin assets and React's inline styles.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const isProd = process.env.NODE_ENV === "production";

// Admin allowlist — comma-separated emails in the ADMIN_EMAILS env var.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const isAdminEmail = (email) =>
  !!email && ADMIN_EMAILS.includes(String(email).toLowerCase());

// The six moods are the single source of truth for what the server will accept.
const MOOD_KEYS = ["happy", "content", "neutral", "sad", "angry", "overwhelmed"];
const POSITIVE_MOODS = ["happy", "content"];

// Daily habit check-ins (must mirror the client's activities list).
const ACTIVITIES = [
  { key: "exercise", label: "Exercised", emoji: "🏃", positive: true },
  { key: "steps", label: "10k steps", emoji: "👟", positive: true },
  { key: "sleptWell", label: "Slept well", emoji: "😴", positive: true },
  { key: "wokeOnTime", label: "Woke on time", emoji: "⏰", positive: true },
  { key: "ateWell", label: "Ate well", emoji: "🥗", positive: true },
  { key: "outdoors", label: "Time outside", emoji: "🌳", positive: true },
  { key: "alcohol", label: "Alcohol", emoji: "🍷", positive: false },
  { key: "junkFood", label: "Junk food", emoji: "🍔", positive: false },
];
const ACTIVITY_KEYS = ACTIVITIES.map((a) => a.key);

app.use(express.json());
app.use(cookieParser());

// A broad ceiling on API traffic per IP (normal use is well under this).
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down and try again shortly." },
  })
);

// ---------- Helpers ----------
function setSession(res, user) {
  const token = jwt.sign(
    { uid: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: "180d" }
  );
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

function admin(req, res, next) {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admins only." });
  }
  next();
}

// Throttle auth attempts to blunt brute-force / enumeration.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

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

function serializeEntry(e) {
  return {
    date: ymd(e.entryDate),
    mood: e.mood,
    note: e.note,
    activities: e.activities || [],
    updatedAt: e.updatedAt,
  };
}

// ---------- Auth routes (email + password) ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const meShape = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  isAdmin: isAdminEmail(user.email),
});

app.post("/api/signup", authLimiter, ah(async (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanName) return res.status(400).json({ error: "Please enter your name." });
  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (String(password || "").length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await prisma.user.create({
    data: { name: cleanName, email: cleanEmail, passwordHash },
  });
  setSession(res, user);
  res.status(201).json(meShape(user));
}));

app.post("/api/login", authLimiter, ah(async (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();
  const user = cleanEmail
    ? await prisma.user.findUnique({ where: { email: cleanEmail } })
    : null;
  // Always run a compare to keep timing roughly constant whether or not the user exists.
  const ok = user?.passwordHash
    ? await bcrypt.compare(String(password || ""), user.passwordHash)
    : await bcrypt.compare("x", "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok) {
    return res.status(401).json({ error: "Wrong email or password." });
  }
  setSession(res, user);
  res.json(meShape(user));
}));

app.post("/api/logout", (_req, res) => {
  res.clearCookie("mg_session");
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => {
  res.json({
    id: req.user.uid,
    name: req.user.name,
    email: req.user.email,
    isAdmin: isAdminEmail(req.user.email),
  });
});

// ---------- Account management ----------
app.post("/api/account/password", auth, ah(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (String(newPassword || "").length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.uid } });
  const ok = user?.passwordHash
    ? await bcrypt.compare(String(currentPassword || ""), user.passwordHash)
    : false;
  if (!ok) return res.status(401).json({ error: "Current password is incorrect." });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(String(newPassword), 10) },
  });
  res.json({ ok: true });
}));

// Permanently delete the signed-in user's account and all their entries.
app.delete("/api/account", auth, ah(async (req, res) => {
  await prisma.user.delete({ where: { id: req.user.uid } }).catch(() => {});
  res.clearCookie("mg_session");
  res.json({ ok: true });
}));

// ---------- Entry routes ----------
app.get("/api/entries", auth, ah(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const entries = await prisma.entry.findMany({
    where: { userId: req.user.uid, entryDate: { gte: start, lt: end } },
    orderBy: { entryDate: "asc" },
  });
  res.json(entries.map(serializeEntry));
}));

app.get("/api/entries/:date", auth, ah(async (req, res) => {
  const { date } = req.params;
  if (!isValidDateStr(date)) return res.status(400).json({ error: "Bad date." });
  const entry = await prisma.entry.findUnique({
    where: { userId_entryDate: { userId: req.user.uid, entryDate: new Date(date) } },
  });
  if (!entry) return res.json(null);
  res.json(serializeEntry(entry));
}));

// Upsert a day's mood, optional note, and habit check-ins. A day with no mood,
// no note, and no activities is removed entirely.
app.put("/api/entries/:date", auth, ah(async (req, res) => {
  const { date } = req.params;
  if (!isValidDateStr(date)) return res.status(400).json({ error: "Bad date." });
  if (new Date(date) > new Date()) {
    return res.status(400).json({ error: "You can't log a day in the future." });
  }
  const { mood, note, activities } = req.body || {};

  const cleanMood = mood == null || mood === "" ? null : mood;
  if (cleanMood && !MOOD_KEYS.includes(cleanMood)) {
    return res.status(400).json({ error: "Unknown mood." });
  }
  const cleanNote = note ? String(note).slice(0, 280) : null;
  const cleanActivities = Array.isArray(activities)
    ? [...new Set(activities.filter((a) => ACTIVITY_KEYS.includes(a)))]
    : [];

  // Nothing logged for the day → make sure no stray row lingers.
  if (!cleanMood && !cleanNote && cleanActivities.length === 0) {
    await prisma.entry
      .delete({ where: { userId_entryDate: { userId: req.user.uid, entryDate: new Date(date) } } })
      .catch(() => {});
    return res.json(null);
  }

  const entry = await prisma.entry.upsert({
    where: { userId_entryDate: { userId: req.user.uid, entryDate: new Date(date) } },
    update: { mood: cleanMood, note: cleanNote, activities: cleanActivities },
    create: {
      userId: req.user.uid,
      entryDate: new Date(date),
      mood: cleanMood,
      note: cleanNote,
      activities: cleanActivities,
    },
  });
  res.json(serializeEntry(entry));
}));

// ---------- Stats: streaks + monthly recap ----------
app.get("/api/stats", auth, ah(async (req, res) => {
  const now = new Date();
  const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
  const month = req.query.month != null ? parseInt(req.query.month, 10) : now.getUTCMonth(); // 0-11

  const all = await prisma.entry.findMany({
    where: { userId: req.user.uid },
    select: { entryDate: true, mood: true, activities: true },
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

  // ---- Habit ↔ mood correlation (across all logged days that have a mood) ----
  // For each habit: % of "good" (happy/content) days when you did it vs when you
  // didn't. Only surfaced once there's enough signal (>= 3 days each side).
  const moodDays = all.filter((e) => MOOD_KEYS.includes(e.mood));
  const habits = [];
  for (const act of ACTIVITIES) {
    const withDays = moodDays.filter((e) => (e.activities || []).includes(act.key));
    const withoutDays = moodDays.filter((e) => !(e.activities || []).includes(act.key));
    if (withDays.length < 3 || withoutDays.length < 3) continue;
    const pct = (list) =>
      Math.round(
        (list.filter((e) => POSITIVE_MOODS.includes(e.mood)).length / list.length) * 100
      );
    const withPct = pct(withDays);
    const withoutPct = pct(withoutDays);
    habits.push({
      key: act.key,
      label: act.label,
      emoji: act.emoji,
      positive: act.positive,
      withCount: withDays.length,
      withPositivity: withPct,
      withoutPositivity: withoutPct,
      delta: withPct - withoutPct,
    });
  }
  // Strongest signals first.
  habits.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  res.json({ currentStreak, longestStreak, totalLogged: loggedDays.size, recap, habits });
}));

// ---------- Admin (aggregate only — never exposes private notes/moods) ----------
app.get("/api/admin/overview", auth, admin, ah(async (_req, res) => {
  const dayMs = 86400000;
  const since7 = new Date(Date.now() - 7 * dayMs);
  const since30 = new Date(Date.now() - 30 * dayMs);

  const [totalUsers, totalEntries, newUsers7d, newUsers30d, moodGroups, recentEntryUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.entry.count(),
      prisma.user.count({ where: { createdAt: { gte: since7 } } }),
      prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      prisma.entry.groupBy({
        by: ["mood"],
        where: { mood: { not: null } },
        _count: { mood: true },
      }),
      prisma.entry.findMany({
        where: { createdAt: { gte: since7 } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

  const moodDistribution = Object.fromEntries(MOOD_KEYS.map((k) => [k, 0]));
  for (const g of moodGroups) {
    if (moodDistribution[g.mood] != null) moodDistribution[g.mood] = g._count.mood;
  }

  res.json({
    totalUsers,
    totalEntries,
    newUsers7d,
    newUsers30d,
    activeUsers7d: recentEntryUsers.length,
    moodDistribution,
  });
}));

app.get("/api/admin/users", auth, admin, ah(async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const counts = await prisma.entry.groupBy({
    by: ["userId"],
    _count: { _all: true },
    _max: { entryDate: true },
  });
  const byUser = Object.fromEntries(
    counts.map((c) => [c.userId, { entries: c._count._all, lastEntry: c._max.entryDate }])
  );
  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      entryCount: byUser[u.id]?.entries || 0,
      lastEntry: byUser[u.id]?.lastEntry ? ymd(byUser[u.id].lastEntry) : null,
    }))
  );
}));

// Permanently delete a user (and all their entries) from the admin portal.
app.delete("/api/admin/users/:id", auth, admin, ah(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.uid) {
    return res.status(400).json({ error: "Use Settings to delete your own account." });
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "No such user." });
  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
}));

// Manual password reset for a locked-out user: sets a random temporary password
// and returns it once so the admin can relay it. The user changes it after login.
app.post("/api/admin/users/:id/reset-password", auth, admin, ah(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "No such user." });
  const tempPassword = crypto.randomBytes(6).toString("base64url"); // ~8 chars
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(tempPassword, 10) },
  });
  res.json({ email: user.email, tempPassword });
}));

// Full database export (admin-only). A free, downloadable backup the owner can
// save anywhere; everything needed to restore is included.
app.get("/api/admin/backup", auth, admin, ah(async (_req, res) => {
  const [users, entries] = await Promise.all([
    prisma.user.findMany(),
    prisma.entry.findMany(),
  ]);
  const dump = { version: 1, exportedAt: new Date().toISOString(), users, entries };
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="mood-grid-backup-${ymd(new Date())}.json"`
  );
  res.send(JSON.stringify(dump, null, 2));
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
