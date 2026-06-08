# The Mood Grid

A daily mood tracker based on Rob Dial's *Step 4: The Mood Grid*. Every evening
you check in, pick the color that matches your mood, and the day's circle fills
in. Over weeks and months the grid becomes objective data you can look back on —
instead of letting a single bad day rewrite the whole story.

One shareable URL, works the same on laptop and phone, and every entry is stored
in a real database so it stays intact across devices and across redeploys.

## Features

- **Email + password accounts** with rate-limited login/signup (safe for public
  use). Passwords are bcrypt-hashed; the session is a JWT in an httpOnly cookie.
- **Admin dashboard** (in-app, owner-only) showing aggregate usage — total users,
  entries, signups, active users, and overall mood distribution. Never exposes
  any individual's private notes or moods. Gated by the `ADMIN_EMAILS` env var.
- **Today check-in** — six large tappable mood circles, daily habit check-ins,
  plus an optional one-line reflection note. One entry per day, fully editable
  (backfill past days too).
- **Year grid** — the signature worksheet view. Full year on desktop; single
  month on mobile with a toggle to the full-year scroll.
- **Streaks** — current and longest consecutive-day streaks.
- **Monthly recap** — count per mood, positivity ratio (happy + content / total),
  most common mood, change vs. the prior month, and a plain-language summary line.

## The mood scale

| Key | Label | Color |
| --- | --- | --- |
| `happy` | Happy | `#2E7D32` |
| `content` | Content | `#8BC34A` |
| `neutral` | Neutral | `#64B5F6` |
| `sad` | Sad | `#7E57C2` |
| `angry` | Angry | `#FB8C00` |
| `overwhelmed` | Overwhelmed | `#E53935` |

## Tech stack

- **Frontend:** React + Vite (`/client`), mobile-first.
- **Backend:** Node.js + Express (`/server`).
- **Database:** PostgreSQL via Prisma.
- **Auth:** PIN hashed with bcrypt; session is a signed JWT in an httpOnly cookie.
- In production, Express serves the built client, so the whole app runs from a
  single service and a single URL.

```
/client                     React + Vite frontend
/server                     Express API + Prisma
/server/prisma/schema.prisma
package.json                root scripts
```

## Run it locally

You need a PostgreSQL database. Either install Postgres locally, or create a
Railway Postgres and copy its connection string.

```bash
# 1. Install dependencies
npm run install:all

# 2. Configure the server
cd server
cp .env.example .env
#   then edit .env:
#     DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/moodgrid
#     JWT_SECRET=some-long-random-string

# 3. Create the tables
npx prisma migrate deploy      # applies the committed migration
npx prisma generate            # generates the Prisma client

# 4. (optional) seed a demo profile — name "Demo", PIN 1234
npm run seed

# 5. Start the API (terminal 1)
npm run dev                    # http://localhost:3000

# 6. Start the frontend (terminal 2)
cd ../client
npm run dev                    # http://localhost:5173  (proxies /api to :3000)
```

Open http://localhost:5173, create a profile, log today's mood, confirm it shows
on the grid, then **refresh** — it should persist. That last step is the one
that matters.

## Deploy on Railway

1. **New project** → *Deploy from GitHub repo* → pick this repo and the
   `claude/app-tracking-ROCrs` branch (or merge to `main` and deploy that).
2. **Add the database:** in the project, click *New → Database → PostgreSQL*.
   Railway provisions it and exposes a `DATABASE_URL`.
3. **Set variables** on the app service (Variables tab):
   - `DATABASE_URL` → reference the Postgres plugin's variable so they stay linked.
   - `JWT_SECRET` → a long random string.
   - `NODE_ENV` → `production`.
   - `ADMIN_EMAILS` → your email (comma-separated for more than one). These
     accounts see the in-app **Admin** tab.
4. **Build & start commands.** These are committed in `railway.json`, so Railway
   uses them automatically. If you prefer to set them by hand (Settings → Build
   and Deploy), they are:
   - **Build:**
     ```
     npm install && cd server && npm install && npx prisma generate && cd ../client && npm install && npm run build
     ```
   - **Start:**
     ```
     cd server && npx prisma migrate deploy && node index.js
     ```
   `prisma migrate deploy` creates the tables on first boot and is a no-op
   afterward.
5. **Generate a domain:** service Settings → Networking → *Generate Domain*. That
   URL is your app.

### Launch checklist

- Open the URL on your laptop, create your profile, log today.
- Open the same URL on your phone, sign in with the same profile — today's entry
  should already be there. That proves the database is shared and durable.
- Push a tiny change to trigger a redeploy and confirm the entry survives.

## Notes on data & privacy

- PINs are never stored in plaintext (bcrypt) and never appear in a URL or query
  string — they travel in the request body only.
- The session cookie is httpOnly and marked `secure` in production (HTTPS).
- This is a lightweight personal tool, not a hardened multi-tenant service. Use a
  PIN you don't reuse elsewhere.
