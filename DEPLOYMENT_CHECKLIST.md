# Deployment Checklist — remimber (NoteApp)

This app is a **React (Vite) SPA + Express API** that serves the built SPA from the
same origin, with **MongoDB** for storage, **local disk** for uploads, and a
**WebSocket** relay for live collaboration.

Architecture in one line: one Node process serves `/api`, `/auth`, `/uploads`, `/ws`,
and the built `client/dist` — so you only need **one port exposed**.

---

## 1. Before you deploy

### Env variables (`server/.env` — create from `.env.example`)
- [ ] `PORT` — external-facing port (e.g. `5000`, or let the platform inject it)
- [ ] `MONGO_URI` — a **real** connection string (Atlas / DigitalOcean / self-hosted). Localhost won't work on a remote server.
- [ ] `JWT_SECRET` — **must** be a long random string, not `change_me_dev_secret`
- [ ] `CLIENT_URL` — the public origin, e.g. `https://your-domain.com`
- [ ] `NODE_ENV=production` — makes auth cookies `Secure` (HTTPS only). Do NOT skip this or login breaks on HTTPS.
- [ ] Ensure `.env` is **never** committed (already in `.gitignore`).

### Build the client
- [ ] `cd client && npm install && npm run build` → produces `client/dist/`
- [ ] `client/dist/` must exist on the server at deploy time (server.js serves SPA from `../client/dist`)
- [ ] If you use a separate frontend host (Netlify/Vercel), set an absolute `VITE_API_URL` and point the axios client at it. (Currently the SPA assumes same-origin; simplest is one origin.)

### Install once on the server
- [ ] Node.js **18+** (uses ES modules, `node --watch`, modern features)
- [ ] `npm install --production` for the server
- [ ] Make sure `server/uploads/` exists and is writable (uploaded images + PDF page renders live here)

---

## 2. During hosting / platform checklist

### Process & restart
- [ ] Run with a process manager (`pm2 start server/server.js`, or use the platform's start command `npm start` from `server/`)
- [ ] Set the start command to the **server** package (`server/package.json` → `npm start`) — not the client.
- [ ] Restart policy: on crash, auto-restart (pm2: `--max-restarts`, platform: set healthcheck)

### Database
- [ ] MongoDB reachable from the server (whitelist the server IP / allow `0.0.0.0/0` only if port is firewalled)
- [ ] Create indexes eagerly (`userId` on notes) or let Mongoose autoCreate them
- [ ] Test DB connection before going live: request `/api/health` (`{ "ok": true }`)

### Persistent storage (IMPORTANT)
- [ ] `server/uploads/` must be on **persistent disk**, not an ephemeral instance FS
  - On platforms like Render/Railway: add a disk mount to a persistent volume
  - On bare VPS this is already persistent
- [ ] Uploaded images/PDFs will be **lost on redeploy** if the disk isn't persistent
- [ ] Optional: sooner or later move uploads to object storage (S3/Cloudinary) — code has a single `publicUrl()` helper to swap out

### Static + SPA routing
- [ ] Serves `client/dist/index.html` for deep links (`/s/:code`, `/notes/:id`) — verify a hard refresh on a deep link returns the app, not a 404
- [ ] Any reverse proxy (nginx/Caddy) must pass these through to Node:
  - `/api`, `/auth`, `/uploads`, `/ws` — never rewrite or cache `/ws`
- [ ] Favicon/asset paths are absolute (`/favicon.svg`) so they work behind a sub-path-free domain

### WebSocket (collaboration)
- [ ] `wss://` required when app is on HTTPS (browser blocks mixed content on `ws://`)
- [ ] Reverse proxy must enable **WebSocket upgrade** (nginx: `proxy_set_header Upgrade $http_upgrade; Connection "upgrade";`, or `proxy_http_version 1.1;`)
- [ ] Add a WS proxy timeout so long-lived sockets aren't killed (e.g. 24h+)
- [ ] If the platform doesn't support WS on a single instance, you'll need sticky sessions / a pub-sub store for multi-instance (out of scope here)

### HTTPS & cookies
- [ ] TLS cert valid + auto-renew (Let's Encrypt / platform default)
- [ ] `NODE_ENV=production` set so the JWT cookie is `Secure` (login must work over HTTPS)
- [ ] Cookie is `SameSite=Lax`, `HttpOnly` — fine for same-origin deployment
- [ ] Mixed-content check: all assets, `/api`, `/uploads` load as HTTPS

### CORS
- [ ] If SPA and API are on **different origins**, set `CLIENT_URL` to the exact SPA origin
- [ ] Same-origin deployment (recommended) needs no CORS work at all

### Uploads & PDF import
- [ ] `express.json({ limit: '10mb' })` — canvas `elements[]` payloads can be large; keep this limit or raise if notes exceed it
- [ ] Multer cap is 20MB per file — PDF pages are rasterized to JPEG (kept small)
- [ ] Unsaved/orphan files are handled: only the original PDF is deleted; each render produces `.jpg` files (expected to accumulate — plan a cleanup job)

### Security
- [ ] `JWT_SECRET` unguessable + different from any other secret
- [ ] Rate-limiting login/signup if exposed (not implemented in-app; add reverse-proxy limits)
- [ ] Sanitize uploads: extension + mimetype already filtered to images/PDF; consider a size/abuse cap
- [ ] `uploads/` served publicly by design (note images) — don't add auth that breaks embedded images in shared notes
- [ ] Don't expose Mongo URI or secrets in logs (dotenv loads once, fats on bad config)

---

## 3. Post-deploy smoke test (do every deploy)

- [ ] `GET /api/health` → `{ "ok": true }`
- [ ] Homepage loads (built SPA served at `/`)
- [ ] Sign up → auto-login cookie set → dashboard shows notes
- [ ] Create a note; add text + an image (tests `/api/upload/image` + `/uploads/...` static serving)
- [ ] Hard-refresh a deep link (`/notes/<id>`) — still renders the app
- [ ] Open two browsers on the same note → edits appear live (tests `/ws`)
- [ ] Share a note via invite link → open in second account → live collaboration works
- [ ] Pdf import produces pages as note images
- [ ] Log out → cookie cleared
- [ ] Kill the process (or restart) → it comes back up automatically
- [ ] Upload a file, then **redeploy/restart** → file still loads (persistence verified)

---

## 4. Production hardening (recommended)

- [ ] Add `helmet` for security headers
- [ ] Add rate limiting (`express-rate-limit`) on `/auth/*`
- [ ] Centralized logging (morgan → file/Logtail) instead of `server.log`
- [ ] Health check endpoint wired to platform monitor / uptime robot
- [ ] Backups: `mongodump` scheduled (or Atlas continuous backup)
- [ ] Register for the included WS rooms map is in-memory → single instance only. If scaling horizontally, move rooms to Redis.
- [ ] Move uploads to object storage when traffic grows