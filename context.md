# Senggoldonk Pickle — Development Context

> Last updated: 2026-04-27
> Repo: `https://github.com/chikiball/pickleball.git`
> Local: `/Users/nandha_handharu/Documents/Nandha/Github/pickleball`
> Preview: `/Users/nandha_handharu/Documents/Enchanté/Conversations/C6E0DFCE-C8D1-4ED6-8B5B-969137F66863/pickleball-preview.html`

---

## Overview

**Senggoldonk Pickle** is a pickleball booking and round-robin mixer web app for a community in Singapore. It allows players to create events, sign up for games, generate fair round-robin tournament schedules, and track scores with a live leaderboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Single HTML file (`public/index.html`) — vanilla JS, inline CSS, no framework |
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` (synchronous) |
| Hosting | Fly.io (Singapore) + Home server (Ubuntu + Docker + Cloudflare Tunnel) |
| CI/CD | GitHub Actions → auto-deploy to Fly.io on push to `main` |
| Maps | Leaflet.js + OpenStreetMap (create event), native maps on tap (Apple Maps / Google Maps / geo: URI) |
| Repo | `https://github.com/chikiball/pickleball.git` |

## Local Development

```bash
cd ~/Documents/Nandha/Github/pickleball
# Node 20 via nvm
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20
npm install
npm run dev          # nodemon on localhost:3000
```

---

## Deployment

### Two Live Deployments

| | Fly.io | Home Server |
|---|---|---|
| **URL** | `https://pickleball-booking.fly.dev` | `https://pickleball.nandharu.uk` |
| **Infra** | Fly.io managed | Docker + Nginx + Cloudflare Tunnel |
| **DB** | Fly volume `/data` | Docker volume `pickleball-data` |
| **Region** | Singapore (`sin`) | Home server (Singapore) |
| **Redeploy** | `git push` (auto via GitHub Actions) | `deploy-site.sh pickleball` |
| **Cost** | Fly.io free tier | Free (own hardware) |

### Fly.io Commands

```bash
flyctl deploy                                    # manual deploy
git push origin main                             # auto-deploy via GitHub Actions
flyctl secrets set ADMIN_PASSWORD=xxx            # change admin password
flyctl secrets set SESSION_SECRET=xxx            # change session secret
flyctl logs --no-tail                            # check logs
flyctl status                                    # check machine status
```

- App name: `pickleball-booking`
- Fly.io volume: `pickleball_data` mounted at `/data`
- Auto-stop enabled: machine sleeps when idle, wakes on request
- GitHub secret: `FLY_API_TOKEN` for CI/CD

### Home Server Commands (SSH into Ubuntu server)

```bash
# Redeploy (pull latest + rebuild + restart)
sudo bash /home/nandha/server/scripts/deploy-site.sh pickleball

# Or manually:
cd /home/nandha/server/sites/pickleball
sudo git pull origin main
sudo docker compose up -d --build
sudo docker exec nginx-gateway nginx -s reload

# View logs
sudo docker logs pickleball --tail 50 -f

# Restart
cd /home/nandha/server/sites/pickleball && sudo docker compose restart

# Status dashboard (all sites)
sudo bash /home/nandha/server/scripts/status.sh
```

### Home Server Architecture

```
Browser → https://pickleball.nandharu.uk
    │
    ▼
┌──────────────────────────┐
│ Cloudflare Edge (SIN)    │  HTTPS, DDoS, WAF
└──────────┬───────────────┘
           │ encrypted tunnel
           ▼
┌──────────────────────────┐
│ cloudflare-tunnel        │  (shared with other sites)
└──────────┬───────────────┘
           │ http://nginx-gateway:80
           ▼
┌──────────────────────────┐
│ nginx-gateway            │  routes by server_name
│  pickleball.nandharu.uk  │  → http://pickleball:3000
│  jakarta.nandharu.uk     │  → http://aidatajakarta:8080
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│ pickleball container     │  Node 20, SQLite
│ volume: pickleball-data  │  /data/pickleball.db
│ 512MB RAM, 0.5 CPU       │  read-only, no-new-privileges
└──────────────────────────┘
```

### Home Server File Locations

| What | Path |
|---|---|
| App code | `/home/nandha/server/sites/pickleball/` |
| Nginx config | `/home/nandha/server/nginx/conf.d/pickleball.conf` |
| Docker volume | `pickleball-data` (managed by Docker) |
| Server gateway | `/home/nandha/server/docker-compose.yml` |
| Deploy scripts | `/home/nandha/server/scripts/` |

---

## Project Structure

```
pickleball/
├── public/
│   └── index.html              ← Production frontend (single file: HTML + CSS + JS)
├── server.js                    ← Express server + API routes
├── db.js                        ← SQLite database setup + helper functions
├── package.json
├── Dockerfile
├── fly.toml                     ← Fly.io config
├── docker-compose.yml           ← Home server config (server-net, hardened)
├── .dockerignore
├── .gitignore
├── server-setup/
│   └── nginx/
│       └── pickleball.conf      ← Nginx reverse proxy config for home server
├── .github/workflows/
│   └── deploy.yml               ← GitHub Actions auto-deploy to Fly.io
└── context.md                   ← This file
```

**Preview/prototype file** (not deployed, for workbench testing):
`pickleball-preview.html` — Same design but uses `localStorage` instead of API calls. Lives in the Enchanté conversation folder. Must be kept in sync with production manually.

---

## Database Schema (db.js)

### events
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | Generated: `Date.now().toString(36) + random` |
| title | TEXT | |
| date | TEXT | `YYYY-MM-DD` |
| time | TEXT | `HH:MM` |
| location | TEXT | |
| max_players | INTEGER | Default 12 |
| courts | INTEGER | Default 1 |
| description | TEXT | |
| created_at | TEXT | ISO 8601 |

### participants
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| event_id | TEXT FK | → events.id, CASCADE delete |
| name | TEXT | |
| status | TEXT | `'confirmed'` or `'tnd'` (Taro Nama Dulu = reserve spot first) |
| joined_at | TEXT | |

### mixers
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| event_id | TEXT | |
| players | TEXT | JSON array of player names |
| created_at | TEXT | |

### mixer_games
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| mixer_id | TEXT FK | → mixers.id |
| round_number | INTEGER | |
| court_number | INTEGER | |
| t1p1, t1p2 | TEXT | Team 1 player names |
| t2p1, t2p2 | TEXT | Team 2 player names |
| team1_score | INTEGER | Nullable |
| team2_score | INTEGER | Nullable |
| created_at | TEXT | |

---

## API Routes (server.js)

All routes are prefixed with `/api`. The frontend `apiFetch()` function auto-prepends `/api` — so calls use `apiFetch('/events')` NOT `apiFetch('/api/events')`.

### Events
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/events` | Public | List all events with `participant_count`, `confirmed_count`, `isPast` |
| POST | `/api/events` | Public | Create event `{ title, date, time, location, maxPlayers, courts, description }` |
| GET | `/api/events/:id` | Public | Single event with full `participants` array |
| PATCH | `/api/events/:id` | Public | Update `maxPlayers`, `courts`, `time`, `location` |
| DELETE | `/api/events/:id` | Admin | Delete event (cascades participants) |

### Participants
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/events/:id/join` | Public | Add participant `{ name, status }` |
| PATCH | `/api/participants/:id` | Admin | Update name/status |
| DELETE | `/api/participants/:id` | Public | Remove participant |

### Admin
| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/login` | `{ password }` → sets session |
| POST | `/api/admin/logout` | Destroys session |
| GET | `/api/admin/check` | Returns `{ isAdmin: bool }` |

### Mixer
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/mixers` | Public | List mixers for event |
| POST | `/api/mixers` | Public | Create mixer `{ eventId, players, games }` |
| GET | `/api/mixers/:id` | Public | Get mixer with all games |
| PATCH | `/api/mixer-games/:id` | Public | Update game scores/player names |
| DELETE | `/api/mixers/:id` | Public | Delete mixer |

---

## Admin Authentication

- Default password: `pickle2024` (override via env var `ADMIN_PASSWORD`)
- Fly.io: `flyctl secrets set ADMIN_PASSWORD=xxx`
- Home server: set in `/home/nandha/server/sites/pickleball/.env`
- Primary auth: `express-session` (in-memory store)
- Fallback auth: `X-Admin-Token` header = `btoa(password)` — survives server/container restarts
- Frontend stores token in `sessionStorage._adminToken`
- `apiFetch()` auto-includes `X-Admin-Token` header when token exists

---

## Frontend Architecture (public/index.html)

Single-page app with 4 views: **Home**, **Events**, **Mixer**, **Admin**

### Nav Order
`Home | Events | Mixer | Admin | + New Game (CTA button)`

### Key Frontend Functions
| Function | Purpose |
|---|---|
| `apiFetch(url, options)` | Wrapper: prepends `/api`, includes admin token, parses JSON |
| `renderHome()` | Hero, next event card (entire card clickable → opens detail), stats |
| `renderEvents()` | Upcoming grid + past accordion |
| `openEventDetail(eventId)` | Modal: participants, join form, editable max players/courts (typing + ±) |
| `renderAdmin()` | Event management: inline edit time/location, participant name/status toggle |
| `renderMixerView()` | Select event, show players, generate round robin |
| `generateMixer()` | Two-phase round robin → API → renders schedule + leaderboard |
| `addToCalendar(...)` | Downloads `.ics` file for native calendar apps |
| `openInMap(...)` | Apple Maps (iOS/Mac) / geo: (Android) / Google Maps (desktop) |

### CSS Design Tokens
```css
--bg: #0B1426;  --bg2: #0f1e38;  --card: #152742;  --card2: #1a3058;
--accent: #C8F031;  --confirmed: #2ECC71;  --tnd: #F5A623;  --danger: #E74C3C;
--text: #EEF4FF;  --text-muted: #7A96B5;
--border: rgba(200,240,49,0.18);  --border-subtle: rgba(255,255,255,0.07);
```

### Pickleball Ball Logo (SVG)
Fibonacci sphere algorithm — 26 holes total, 15 visible (front hemisphere):
- `viewBox="-170 -170 340 340"`, scales via `width="100%"`
- Gradient: `#FFFDE7` → `#FFE600` → `#C49A00` (bright yellow, no opacity)
- Holes: `#1B5E20`, depth-compressed ellipses, rotated perpendicular to radial lines
- Multiple gradient IDs (`bG1`, `bG2`...) to avoid SVG ID conflicts

---

## Mixer — Round Robin Algorithm

### Doubles (2v2) — Two-Phase Greedy
**Goal:** Every player partners with every other player at least once.

**Phase 1 — Game Generation:**
- Total games = `ceil(C(N,2) / 2)` (e.g., 23 for 10 players)
- Try all C(N,4) groups × 3 team splits per game
- Score: new partner pairs × 1000 + new opponent pairs × 10 (tiebreak: balance)

**Phase 2 — Scheduling:**
- Assign games to rounds, max `courts` per round
- No player in 2+ games per round

**10 players result:** 23 games, 45/45 partner pairs ✅, 45/45 opponent pairs ✅, play spread 0-1

### Singles (1v1)
Greedy: cover all C(N,2) opponent pairs, 1 pair per game.

### Auto-Rounds: `ceil(totalPairs / pairsPerGame / courts)`

---

## Features Checklist

- ✅ Create/view/delete events (anyone creates, admin deletes)
- ✅ Join events: Confirmed or TND (Taro Nama Dulu)
- ✅ Next event card clickable → opens event detail
- ✅ Past events accordion with participant list
- ✅ Courts + max players (editable by anyone, typing + ± buttons)
- ✅ Remove any player (public)
- ✅ Add to Calendar (.ics download)
- ✅ Location: Leaflet map in create form; native maps on tap
- ✅ Mixer: round-robin generator (singles 1v1 + doubles 2v2)
- ✅ Mixer: live leaderboard (W/L/pts)
- ✅ Mixer: inline score + player name editing
- ✅ Mixer: auto-rounds calculation
- ✅ Admin: edit event time/location
- ✅ Admin: edit participant name + toggle confirmed/TND status
- ✅ Admin auth with session + X-Admin-Token fallback
- ✅ GitHub Actions auto-deploy to Fly.io
- ✅ Home server deployment via Docker + Nginx + Cloudflare Tunnel
- ✅ Responsive (mobile-first)

---

## Known Issues & Gotchas

1. **HTML duplication bug**: Python/sub-agent edits to the HTML files can accidentally duplicate `<style>`, `<body>`, `<nav>` sections. Always verify counts after automated edits:
   ```python
   for tag in ['<body', '<nav ', '<style>', '</style>']:
       print(f'{tag}: {content.count(tag)}')  # all should be 1
   ```

2. **Preview vs Production sync**: Two separate files with different JS data layers (localStorage vs API). Field names differ: preview=camelCase (`maxPlayers`, `team1Score`), production=snake_case (`max_players`, `team1_score`).

3. **`apiFetch` URL prefix**: `API_BASE = '/api'` is auto-prepended. Never write `apiFetch('/api/events')` — use `apiFetch('/events')`.

4. **Session persistence**: In-memory sessions clear on Fly.io auto-stop or Docker container restart. The `X-Admin-Token` header fallback (base64-encoded password in `sessionStorage`) keeps admin auth working.

5. **Node.js**: Requires v20+ (optional chaining). Use `nvm use 20`.

6. **MacPorts**: Dev machine has MacPorts at `/usr/local` conflicting with Homebrew. Always use nvm.

7. **SQLite persistence**: On Fly.io: persistent volume at `/data`. On home server: Docker named volume `pickleball-data`. Both survive deploys but NOT machine/volume deletion.

8. **Dead code after file_edit**: When replacing functions, old code remnants after `return` statements can cause `SyntaxError: Identifier already declared`. Always verify with `node --check` after edits.

9. **Home server redeployment**: Always `git pull` on the server before rebuilding. Use `deploy-site.sh pickleball` or manually: `git pull → docker compose up -d --build → nginx -s reload`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `production` | |
| `DB_PATH` | `/data/pickleball.db` | SQLite path |
| `ADMIN_PASSWORD` | `pickle2024` | Admin login |
| `SESSION_SECRET` | `pickle-secret-2024` | Session signing |

On Fly.io: set via `flyctl secrets set KEY=value`
On Home server: set in `/home/nandha/server/sites/pickleball/.env`
