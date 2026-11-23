# SkillSwap — Local Skill-Swap & Event Platform

SkillSwap is a full-stack web platform where users list skills they can teach and skills they want to learn, connect with nearby peers for mutual skill swaps, message connections, exchange session reviews, and host or join local skill meetups on an interactive map.

---

## Features

- **Cookie JWT Authentication**: Email/password registration and login (`bcryptjs` cost 10) backed by signed HS256 JWTs stored in `HttpOnly`, `SameSite=Lax` cookies (`skillswap_session`) with timing-attack mitigation and Origin CSRF validation. Optional Google OAuth 2.0 PKCE authentication (zero external OAuth packages).
- **Skill Profiles & Matching Engine**: Manage teach skills (with *Beginner*–*Expert* levels) and learn skills, automatically discovering mutual swaps and ranked community matches.
- **Geolocation & Privacy-First Distance**: Nominatim OpenStreetMap address search proxied and cached server-side (`/api/geocode`), whole-km rounded peer distances on `/dashboard`, and 0.1 km rounded distances on events — never exposing raw peer coordinates to the browser.
- **Secure Avatar Uploads**: Server-side magic-byte sniffing, 25 MP cap, 512×512 WebP conversion (`sharp`), EXIF/GPS metadata stripping, and path-traversal-guarded serving at `/api/avatars/:file`.
- **Local Meetups & Interactive Leaflet Map (P3.5)**: Browse upcoming/hosted meetups, toggle between card grid and Leaflet map view, search addresses, set optional attendee limits (`maxAttendees`), edit/cancel hosted events, and toggle RSVPs with capacity enforcement.
- **Messaging & Reviews**: Two-panel chat with visibility-aware 3-second polling and accepted-match-gated 5-star session reviews (one review per peer pair).
- **Email Notifications (Resend)**: Fire-and-forget transactional notifications (new connection request, request accepted, event cancelled) with strict abuse limits, recipient opt-outs, and dormant graceful fallback.
- **Account Deletion & Data Privacy**: GDPR-compliant self-service account deletion (`DELETE /api/user/account`) with strict cascading purge across all collections, and dedicated Privacy Policy & Terms of Service pages.
- **Production Observability & Health**: Structured single-line JSON request logging with unique `X-Request-Id`, redacted credential dumps on unhandled crashes, and `/api/health/db` with 3-second ping timeout.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend (`client/`)** | React 19, Vite 6, React Router v7, Tailwind CSS v4, Radix UI, Lucide icons, Leaflet `1.9.4` (ES Modules, JSX — plain JavaScript) |
| **Backend (`server/`)** | Node.js (ESM), Express 4, Helmet (CSP & security headers), `cookie-parser`, Zod 4, `jsonwebtoken`, `bcryptjs`, `sharp` |
| **Database (`prisma/`)** | MongoDB Replica Set (port `27018`, `rs0` or Atlas) via Prisma ORM `6.4.0` (10 models, 3 enums, indexed queries); read-only archive in `prisma/dev.db` |
| **Testing & Lint** | Vitest 3 (`node` + `jsdom`), Testing Library, ESLint 9 |

---

## Folder Structure

```text
skillswap/
├── client/                  # React (Vite) Single-Page Application (port 5173 in dev)
│   ├── public/              # Static client assets (favicon.svg)
│   ├── scripts/             # Client proxy verification scripts (smoke, m4a, m4b)
│   ├── src/
│   │   ├── components/      # Navbar, Layout, ProtectedRoute, MapView, EventDialog, AddressSearch, ui/
│   │   ├── config/          # Site-wide configuration and legal contact details (site.js)
│   │   ├── context/         # AuthContext (session synchronization)
│   │   ├── lib/             # api.js, geo.js, events.js
│   │   ├── pages/           # HomePage, AuthPage, DashboardPage, ProfileDetailPage, ChatPage, ReviewsPage, ProfileSetupPage, EventsPage, PrivacyPage, TermsPage
│   │   └── test/            # Vitest + Testing Library unit tests (124 tests across 16 suites)
│   └── dist/                # Production build output served by Express in NODE_ENV=production
├── server/                  # Standalone Express API & production SPA server (port 4000)
│   ├── scripts/             # Real-server integration & DB utilities (161 checks, foundation, P3.5, prod smoke, db-counts)
│   ├── src/
│   │   ├── config/          # Zod-validated environment configuration (env.js)
│   │   ├── db/              # Prisma client singleton
│   │   ├── lib/             # Domain rules (matching, geo, geocode, avatar, pagination, rate-limit, event-rules, validators, oauth, email, email-templates)
│   │   ├── middleware/      # auth, csrf, logger, not-found, error-handler
│   │   └── routes/          # auth, profile, users, skills, matches, conversations, messages, reviews, events, geocode, avatar, health
│   └── test/                # Vitest unit & integration suites (228 tests across 20 suites)
├── prisma/                  # Shared Prisma schema, SQLite database (dev.db), and seed script (seed.js)
├── public/uploads/avatars/  # Local WebP avatar storage directory (configured via AVATAR_STORAGE_DIR)
├── scripts/                 # Cross-platform root orchestrators (dev.mjs, start.mjs)
├── docs/                    # Audit, architecture decisions, plans, and deployment/launch guides
└── package.json             # Thin root orchestrator
```

---

## Environment Variables

Configure environment variables in `server/.env` (copy `server/.env.example`):

| Variable | Required | Default / Example | Description |
|---|---|---|---|
| `PORT` | No | `4000` | Express server listen port |
| `MONGODB_URL` | Yes | `"mongodb://127.0.0.1:27018/skillswap?replicaSet=rs0&directConnection=true"` | MongoDB connection string (starts with `mongodb://` or `mongodb+srv://`) |
| `JWT_SECRET` | Yes (Prod) | *(random >= 32 chars)* | HS256 signing key. **Required** (`>= 32` chars, non-placeholder) when `NODE_ENV=production`. |
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `ALLOWED_ORIGINS` | Yes (Prod) | `http://localhost:5173,http://localhost:4000` | Comma-separated origins allowed by CSRF checks. Must include your public production origin! |
| `PUBLIC_URL` | No | *(auto-detected)* | Fully qualified canonical public URL (e.g. `https://skillswap.onrender.com`). Used for OAuth redirects and email notification links. |
| `TRUST_PROXY` | No | `false` | Set `true` behind a reverse proxy (NGINX, Render, Railway) |
| `RATE_LIMIT_DISABLED` | No | `false` | Disables in-memory rate limits in non-production only (ignored when `NODE_ENV=production`) |
| `NOMINATIM_USER_AGENT` | No | `SkillSwap-App/1.0` | User-Agent header sent to OpenStreetMap Nominatim geocoding API |
| `AVATAR_STORAGE` | No | `mongo` | Avatar storage engine (`mongo` stores WebP in MongoDB `AvatarFile`; `disk` writes to filesystem) |
| `AVATAR_STORAGE_DIR` | No | `../public/uploads/avatars` | Directory for processed WebP avatars when `AVATAR_STORAGE=disk` (resolved relative to `server/`) |
| `GOOGLE_CLIENT_ID` | Optional | `""` | Google Cloud OAuth 2.0 Web Client ID. Enables Google Sign-In when paired with client secret. |
| `GOOGLE_CLIENT_SECRET` | Optional | `""` | Google Cloud OAuth 2.0 Web Client Secret. |
| `RESEND_API_KEY` | Optional | `""` | Resend API key (`re_...`). Enables transactional email notifications when paired with sender address. |
| `EMAIL_FROM` | Optional | `""` | Verified sender email address (e.g. `SkillSwap <notifications@skillswap.com>`). |

Note: Root `.env` also contains `MONGODB_URL` if invoking Prisma CLI directly at the root.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 2. Configure MongoDB Replica Set & Environment
1. Ensure the dedicated MongoDB replica set (`rs0`) is running on port 27018:
   ```cmd
   scripts\start-mongo.bat
   ```
2. Configure `server/.env` (copy `server/.env.example`):
   ```bash
   cp server/.env.example server/.env
   ```
3. Generate the Prisma Client:
   ```bash
   npm --prefix server exec -- prisma generate --schema=prisma/schema.prisma
   ```
4. Push collections and indexes to MongoDB:
   ```bash
   npm --prefix server exec -- prisma db push --schema=prisma/schema.prisma
   ```
5. Migrate baseline data from SQLite (`prisma/dev.db`, 81 rows) into MongoDB:
   ```bash
   # Dry-run validation (no writes):
   node server/scripts/migrate-sqlite-to-mongo.mjs

   # Apply migration:
   node server/scripts/migrate-sqlite-to-mongo.mjs --apply
   ```
*(To inspect row counts across all 9 collections: `node server/scripts/db-counts.mjs`. To export external JSON backups: `node server/scripts/export-backup.mjs`.)*

### 3. Run in Development Mode
Start both the Express backend (port `4000`) and React Vite dev server (port `5173`) concurrently with prefixed logs:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. Vite proxies `/api/*` requests to `http://localhost:4000`.
- Demo account: `alex@example.com` / `password123`

Run individually if needed:
- `npm run dev:server` (Express on port `4000`)
- `npm run dev:client` (Vite on port `5173`)

### 4. Build & Run in Production Mode
In production (`NODE_ENV=production`), Express serves the built React SPA from `client/dist/` alongside the `/api/*` routes on a single origin with strict CSP and immutable `/assets/*` caching:

```bash
# 1. Build the React frontend bundle into client/dist/
npm run build

# 2. Ensure server/.env (or process env) sets a strong JWT_SECRET and production ALLOWED_ORIGINS
# 3. Start Express in production mode on PORT (default 4000)
npm start
```
Open [http://localhost:4000](http://localhost:4000).

---

## Production Deployment (Render.com + MongoDB Atlas)

SkillSwap is production-ready for deployment on [Render.com](https://render.com) using the Infrastructure-as-Code Blueprint (`render.yaml`) connected to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas):

- **Render Blueprint**: [`render.yaml`](file:///d:/project/render.yaml) automatically provisions the Node 22 Web Service with health check `/api/health`, automatic `JWT_SECRET` generation, and `TRUST_PROXY=true`.
- **Avatars in MongoDB**: WebP avatars are saved in the `AvatarFile` collection, surviving ephemeral disk redeployments on Render free tier.
- **Data Seeding & Migration Tools**:
  - `node server/scripts/import-backup.mjs --skills-only --apply`: Seeds the 13-category skill taxonomy into an empty production database.
  - `node server/scripts/import-backup.mjs --apply`: Restores the complete 81-document baseline dataset.
  - `node server/scripts/migrate-avatars-to-db.mjs --apply`: Migrates disk avatars into the MongoDB `AvatarFile` collection.
- **Click-by-Click Guide**: Complete beginner deployment guide in [`docs/DEPLOYMENT.md`](file:///d:/project/docs/DEPLOYMENT.md).
- **Production Launch Checklist**: Pre-flight verification checklist in [`docs/LAUNCH-CHECKLIST.md`](file:///d:/project/docs/LAUNCH-CHECKLIST.md).

> [!WARNING]
> **Single Instance Constraint**: The application uses in-memory sliding-window rate limiting and in-memory Nominatim geocode caching. Deploy strictly 1 instance on Render. Multi-instance horizontal scaling requires external Redis caching.

---

## Quality Gates, Tests & Check Scripts

```bash
# Lint both server and client (0 errors, 0 warnings expected)
npm run lint

# Run all unit & isolated integration tests (228 server tests + 124 client tests)
npm test

# Build production client bundle (code-split with lazy routes, entry bundle < 350 kB raw / ~105 kB gzip)
npm run build
```

### Real-Server Integration Check Scripts
The server check suite executes against isolated scratch databases (`skillswap_test_<timestamp>`), guaranteeing zero writes or mutations into the main development database:
```bash
# Runs 11 server verification scripts (security, validation, pagination, review, profile, geocode, distance, avatar, P3.5 rejection, security2 abuse hardening, and P3.5 write/concurrency checks)
npm run check

# Run Vite proxy & client integration checks
node client/scripts/smoke-check.mjs
node client/scripts/m4a-check.mjs
node client/scripts/m4b-check.mjs

# Run foundation auth/CSRF/rate-limit check against a freshly started Express server
node server/scripts/foundation-check.mjs

# Run automated production serving smoke test (builds/requires client/dist and launches port 4000 in NODE_ENV=production)
node server/scripts/prod-smoke-check.mjs
```

---

## Continuous Integration & Security (Phase 6)

SkillSwap includes automated Continuous Integration and dependency governance via GitHub Actions and Dependabot:

- **`.github/workflows/ci.yml`**:
  - **`quality` job**: Runs on `ubuntu-latest` with Node.js 22, installs dependencies with `npm ci`, runs `prisma generate`, executes ESLint across server and client, runs unit tests (Vitest), and verifies the production client build.
  - **`integration` job**: Starts a containerized MongoDB 7 replica set (`rs0` on port 27017 via `docker run mongo:7 mongod --replSet rs0 --bind_ip_all`), initiates the replica set via `mongosh`, runs `prisma db push`, executes the server test check suite (`run-checks.mjs`), production smoke check (`prod-smoke-check.mjs`), foundation checks, and Vite preview client checks.
- **`.github/dependabot.yml`**: Configured for weekly dependency audits of npm packages in `server/` and `client/` (grouped into minor/patch updates, ignoring major breaking changes to avoid PR floods).

### Security Architecture Summary
- **NoSQL Injection Resistance**: All endpoints validate incoming request shapes with Zod schemas, explicitly enforcing primitives and rejecting nested operator objects (`{ $ne: "" }`).
- **CSRF & Sec-Fetch-Site Defense**: Rejects state-changing requests with `Sec-Fetch-Site: cross-site` (403 Forbidden) and validates `Origin` against `ALLOWED_ORIGINS`.
- **Anti-Abuse Messaging Rules**: On `PENDING` connection requests, only the requester may send up to 3 introductory messages; recipients cannot message until accepting (`409 Conflict`); `DECLINED` requests reject all messages (`409 Conflict`).
- **Protected Reviews**: `GET /api/reviews` requires active session authentication (401 Unauthorized for unauthenticated callers).
- **Hardened Security Headers**: Helmet with `crossOriginOpenerPolicy: "same-origin"`, `referrerPolicy: "strict-origin-when-cross-origin"`, restrictive `Permissions-Policy: camera=(), microphone=(), geolocation=()`, HSTS in production, and `x-powered-by` disabled.
- **Safe Proxy Handling**: In-memory rate limiting relies on Express `req.ip` rather than raw `X-Forwarded-For`, preventing IP-spoofing bypasses unless `TRUST_PROXY=true` is deliberately enabled behind a trusted reverse proxy.
