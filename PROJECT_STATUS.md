# PROJECT_STATUS.md — SkillSwap (single source of truth)

> **Every AI agent session MUST read this file first, before touching any code.**
> **Every session MUST update this file last.** If this file and the code disagree, the code wins: fix this file and note it in the Changelog.

- Repo: `ambulgerushabh45-star/skillswap`
- App: SkillSwap, a hyper-local skill-swap and meetup platform
- Last updated: 2026-11-17
- **Current phase: Phase 7b COMPLETE (Production Hardening, Google OAuth PKCE, Resend Email, Account Deletion & Launch Prep)**
- **Next task: Owner Tasks (Manual deployment to Render/Atlas, activate Google Cloud credentials, Resend sending domain, and Uptime monitoring)**

---

## 1. Agent Protocol (follow in this exact order)

1. **READ** this file fully, then `AGENT_RULES.md`.
2. **ANALYZE** the current code for the task. Never assume; open the files.
3. **PLAN**: write the plan to `docs/plans/<task-id>-<slug>.md` (goal, files to touch, steps, risks, how to verify). No coding before the plan exists.
4. **EXECUTE** only what the plan says. If the plan must change, update the plan file first and note why.
5. **VERIFY** with the quality gates (section 6). Do not mark a task done if any gate fails.
6. **RECORD**: tick the checkbox, update "Current phase / Next task", add a Changelog entry, log any decision or new known issue.
7. **STOP** after the requested task. Do not start the next task on your own.

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | JavaScript (ESM, JSX) | Plain JavaScript (`.js`, `.mjs`, `.jsx`), zero TypeScript, `@/* -> ./src/*` via `client/jsconfig.json` & Vite |
| Frontend (`client/`) | React 19.2.8, Vite 6.2+, React Router v7.1.5 | Client SPA on port `5173` in dev; compiled to `client/dist/` and served by Express in production |
| Backend (`server/`) | Express 4.21.2, Node.js ESM, Helmet 8 | Standalone REST API + production static/SPA server on port `4000` with strict Helmet CSP |
| UI | Tailwind CSS v4 (`@tailwindcss/vite`), Radix UI, Lucide | Responsive components in `client/src/components/ui/` |
| DB / ORM | MongoDB Replica Set (`rs0`, port 27018 / Atlas) via Prisma 6.4.0 (MongoDB connector) | 10 models (including `AvatarFile`), 3 enums, UUID strings mapped to `_id`, compound uniques `Match(userAId, userBId, matchedSkillId)` and `Review(fromUserId, toUserId)`; `prisma/dev.db` preserved as read-only archive (backed up to `D:\dev.db.backup19`) |
| Auth | Signed HS256 JWT in `HttpOnly`, `SameSite=Lax` cookie (`skillswap_session`), `bcryptjs` | Timing-attack protected login, Origin CSRF guard |
| Maps | Leaflet 1.9.4 + OpenStreetMap | Interactive markers & XSS-safe popups; Nominatim proxy via `/api/geocode` (`NOMINATIM_USER_AGENT` configured) |
| Image Processing | Sharp 0.35.5 | Auto-orient, 512x512 cover crop, WebP quality 80, EXIF/GPS metadata stripping, 25 MP cap |
| Chat | REST polling every 3s | Visibility-aware, scrollback-preserving polling in `ChatPage.jsx` |
| Validation | Zod 4 | Zod schemas in `server/src/lib/validators/`, centralized error responses in `server/src/lib/api-error.js` |
| Testing | Vitest 3.2.7 + Testing Library | `npm test` runs 181 server tests (16 suites) + 112 client tests (15 suites) = 293 unit/integration tests |

## 3. Data Model (11 models, 3 enums)

User (includes nullable `latitude Float?`, `longitude Float?` for distance calculations, and `emailNotifications Boolean?`), Skill, UserSkillsTeach, UserSkillsLearn, Match, Event (includes nullable `maxAttendees Int?` and `cancelledAt DateTime?` for P3.5 capacity and cancellation), EventAttendee, Review, Message, AvatarFile (stores WebP binary avatars directly in MongoDB for ephemeral disk resilience), and OAuthAccount (stores external OAuth provider accounts like Google).
- Primary Key Strategy: UUID string primary keys mapped to `_id` (`id String @id @default(uuid()) @map("_id")`); all foreign keys are plain `String` (NO `@db.ObjectId`), guaranteeing 100% ID compatibility across clients and archive data.
- Enums: `MatchStatus` (PENDING, ACCEPTED, DECLINED), `AttendanceStatus` (GOING, MAYBE, CANCELLED), `ProficiencyLevel` (Beginner, Intermediate, Advanced, Expert).
- Unique constraints: `User(email)`, `UserSkillsTeach(userId, skillId)`, `UserSkillsLearn(userId, skillId)`, `EventAttendee(eventId, userId)`, `Match(userAId, userBId, matchedSkillId)`, `Review(fromUserId, toUserId)`, `OAuthAccount(provider, providerAccountId)`.
- Query indexes: `Match(userAId, userBId, matchedSkillId)`, `Match(userAId)`, `Match(userBId)`, `Match(matchedSkillId)`, `Message(matchId, createdAt)`, `Message(senderId)`, `Event(dateTime)`, `Event(hostId)`, `EventAttendee(userId)`, `EventAttendee(eventId)`, `Review(fromUserId, toUserId)`, `Review(toUserId)`, `Review(fromUserId)`, `UserSkillsTeach(skillId)`, `UserSkillsLearn(skillId)`, `AvatarFile(userId)`, `OAuthAccount(userId)`.
- Cascade rules: All 15 relation edges enforce `onDelete: Cascade` (client-emulated by Prisma for MongoDB, reinforced by explicit dependency-ordered cascade during `DELETE /api/user/account`).

## 4. Routes & Storage

React SPA Routes (`client/`, served by Vite in dev on port 5173 and by Express fallback in production):
Pages: `/`, `/auth`, `/dashboard`, `/events`, `/chat`, `/reviews`, `/profile/setup`, `/profile/:id`, `/privacy`, `/terms`

Express Backend (`server/`, port 4000):
Auth: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`, `GET /api/auth/providers`, `GET /api/auth/google`, `GET /api/auth/google/callback`
Profile: `GET /api/user/profile`, `PUT /api/user/profile`, `DELETE /api/user/account`
Users: `GET /api/users/:id`
Skills: `GET /api/skills`, `POST /api/skills`
Matches: `GET /api/matches`, `POST /api/matches`, `PATCH /api/matches/:id`
Conversations: `GET /api/conversations`
Messages: `GET /api/messages`, `POST /api/messages`
Reviews: `GET /api/reviews`, `POST /api/reviews`
Events (P3.5): `GET /api/events`, `POST /api/events`, `PATCH /api/events/:id`, `POST /api/events/:id/cancel`, `POST /api/events/:id/rsvp`
Geocode: `GET /api/geocode`
Avatar: `POST /api/user/avatar`, `DELETE /api/user/avatar`, `GET /api/avatars/:file`
Health: `GET /api/health`, `GET /api/health/db`

Storage: Avatars persisted in MongoDB `AvatarFile` collection as binary WebP documents by default (`AVATAR_STORAGE=mongo`), with automatic fallback to local disk (`AVATAR_STORAGE_DIR="../public/uploads/avatars"`). Both `storage/` and `public/uploads/` paths are served solely through authenticated `/api/avatars/:file` rather than as open static directories.

Demo login: `alex@example.com` / `password123` (seed data only, remove before production).

### 4.1 API Pagination Contract (reusable reference)

All 5 list endpoints implement safe, backward-compatible pagination with a dual metadata contract:
- **Response Objects**: Endpoints preserve all existing top-level fields and add a `pagination` field.
- **Response Headers**: Every list endpoint sets standard HTTP pagination headers (`X-Total-Count`, `X-Limit`, etc.).
- **Default Caps (no query params)**: High enough to return today's full datasets with 0 truncation, but low enough to protect server memory.
- **Client Limit Range**: When supplied by client, `limit` must be an integer between 1 and 100 (`min(1).max(100)`). Out-of-bounds or invalid values return standard 400 Bad Request error.
- **Ordering & Stability**: All endpoints specify deterministic multi-field ordering with `id` tie-breaker to prevent skipped or duplicated records across pages.

| Endpoint | Type | Default Cap | Client Limits | Optional Query Params | Pagination Object Fields | Response Headers | Ordering |
|---|---|---|---|---|---|---|---|
| `GET /api/matches` | Page | 100 | 1..100 | `page`, `limit` | `total, page, limit, totalPages, hasNextPage, hasPrevPage` | `X-Total-Count, X-Page, X-Limit, X-Total-Pages, X-Has-Next-Page, X-Next-Page` | `matchScore desc, sharedInterests desc, name asc` |
| `GET /api/events` | Page | 100 | 1..100 | `page`, `limit` | `total, page, limit, totalPages, hasNextPage, hasPrevPage` | `X-Total-Count, X-Page, X-Limit, X-Total-Pages, X-Has-Next-Page, X-Next-Page` | `dateTime asc, id asc` |
| `GET /api/conversations` | Page | 100 | 1..100 | `page`, `limit` | `total, page, limit, totalPages, hasNextPage, hasPrevPage` | `X-Total-Count, X-Page, X-Limit, X-Total-Pages, X-Has-Next-Page, X-Next-Page` | `createdAt desc, id asc` |
| `GET /api/messages` | Cursor | 200 | 1..100 | `matchId` (req), `limit`, `cursor` | `total, limit, hasMore, nextCursor` | `X-Total-Count, X-Limit, X-Has-More, X-Next-Cursor` | Latest 200 in ascending chronological order (`createdAt asc`) |
| `GET /api/reviews` | Page | 50 | 1..100 | `toUserId` (req), `page`, `limit` | `total, page, limit, totalPages, hasNextPage, hasPrevPage` | `X-Total-Count, X-Page, X-Limit, X-Total-Pages, X-Has-Next-Page, X-Next-Page` | `createdAt desc, id desc` |

### 4.2 Rate Limits Contract (reusable reference)

In-memory rate limiter protects authentication and write endpoints against brute force and abuse:
- **Error Format**: HTTP 429 Too Many Requests with body `{ "error": "Too many requests. Please try again in N seconds." }`.
- **Response Headers**: `Retry-After: <seconds>`, `X-RateLimit-Limit: <limit>`, `X-RateLimit-Remaining: <remaining>`.
- **Testing Switch**: `RATE_LIMIT_DISABLED=true` turns off rate limiting in non-production environments (`NODE_ENV !== "production"`). Ignored in production.
- **Execution Order**: Session check (401) -> Rate limit check (429) -> Body validation (400) -> Business logic / DB. Rate-limited requests never query or touch the database.

| Action / Route | Method | Rate Limit Key | Limit | Window | Notes |
|---|---|---|---|---|---|
| Login (Authorize) | `POST` | `login:ip_email:<ip>:<email>` | 10 | 15 min (900s) | Protects specific accounts from brute-force guessing |
| Login (Authorize) | `POST` | `login:ip:<ip>` | 50 | 15 min (900s) | Protects against distributed credential stuffing per IP |
| `/api/auth/register` | `POST` | `register:<ip>` | 5 | 1 hour (3600s) | Prevents automated registration spam |
| `/api/messages` | `POST` | `messages:create:<userId>` | 30 | 1 min (60s) | Rapid chat support (1 every 2s) while blocking bot flooding |
| `/api/matches` (Connect) | `POST` | `matches:create:<userId>` | 20 | 1 hour (3600s) | Prevents spamming connection requests |
| `/api/matches/[id]` | `PATCH` | `matches:update:<userId>` | 60 | 1 hour (3600s) | Inbox triage / accept & decline capacity |
| `/api/reviews` | `POST` | `reviews:create:<userId>` | 10 | 1 hour (3600s) | Prevents fake review flooding |
| `/api/events` | `POST` | `events:create:<userId>` | 10 | 1 hour (3600s) | Meetup host event creation |
| `/api/events/[id]/rsvp` | `POST` | `events:rsvp:<userId>` | 60 | 1 hour (3600s) | RSVP browsing / toggle capacity |
| `/api/skills` | `POST` | `skills:create:<userId>` | 20 | 1 hour (3600s) | Custom community skill suggestions |
| `/api/user/profile` | `PUT` | `profile:update:<userId>` | 30 | 1 hour (3600s) | Profile edits and skill updates |
| `/api/user/avatar` (Upload) | `POST` | `avatar:upload:<userId>` | 10 | 1 hour (3600s) | Protects against upload flooding and disk exhaustion |
| `/api/user/avatar` (Remove) | `DELETE` | `avatar:delete:<userId>` | 30 | 1 hour (3600s) | Avatar deletion rate limit |
| `/api/geocode` | `GET` | `geocode:search:<userId>` | 20 | 1 min (60s) | Prevents automated geocoding abuse / scraping |
| GET Endpoints | `GET` | *Unthrottled* | - | - | Chat polling every 3s and feed fetching remain unthrottled |

### 4.3 Review Rules Contract
Business rules governing review creation in `POST /api/reviews`:
- **Single Review Per Peer**: Exactly one review permitted per reviewer and reviewed user pair (`fromUserId` + `toUserId`).
- **ACCEPTED Match Required**: The reviewer and recipient must have an existing match with status `ACCEPTED` (403 Forbidden otherwise).
- **Duplicate Prevention**: Attempting to review the same peer again returns HTTP 409 Conflict with `{ "error": "You have already reviewed this person." }`.
- **Self-Review Blocked**: Reviewing oneself returns HTTP 400 Bad Request with `{ "error": "You cannot review yourself" }`.
- **Concurrency Safety**: Enforced via composite index `@@index([fromUserId, toUserId])` and check-and-insert Prisma transactions catching `ALREADY_REVIEWED` and Prisma error `P2002`.

### 4.4 Geolocation & Privacy Distance Contract (P3.3)
- **Privacy Guarantees**: Raw geographic coordinates (`latitude` / `longitude`) of other users are **NEVER** serialized over the network or exposed to the client browser in `/api/matches` or `/api/users/[id]`. Only the viewer's own profile (`GET /api/user/profile`) provides their own coordinates to the authenticated user.
- **Peer Match Rounding**: Candidate distances in `GET /api/matches` are rounded to the nearest whole kilometre (step = 1). Values `< 1 km` round to `0` and are formatted as `"Less than 1 km away"` in the UI.
- **Event Distance Rounding**: Public event coordinates are already published on the map; event distances in `GET /api/events` are rounded to 0.1 km (e.g. `2.3 km away`).
- **Null Coordinates & Fallbacks**: If either party (viewer or peer / event) lacks coordinates, `distanceKm` returns `null`.
- **Response Fields**:
  - `GET /api/matches`: adds `currentUser.hasLocation` (boolean) to the viewer summary and `distanceKm: number | null` to each match item.
  - `GET /api/events`: adds `distanceKm: number | null` to each event item.
  - `GET & PUT /api/user/profile`: accepts and returns viewer's own `latitude` and `longitude` (validated within -90..90 and -180..180).

### 4.5 React (Vite) + Express Final Architecture

- **Architecture**: Decoupled React 19 (Vite) Single-Page Application (`client/`) + standalone Express backend (`server/`) in plain JavaScript (ES Modules, `"type": "module"`). Legacy Next.js monolith removed cleanly in M5.
- **Ports & Serving Modes**:
  - **Development (`npm run dev`)**: `scripts/dev.mjs` launches Express (`PORT=4000`) and Vite (`PORT=5173`) concurrently. Browser interacts with `http://localhost:5173`; Vite proxies `/api/*` to `http://localhost:4000` (`changeOrigin: false`), preserving same-origin cookies and `Origin` header.
  - **Production (`npm run build && npm start`)**: Express runs with `NODE_ENV=production` on `PORT` (default `4000`), serving hashed Vite assets from `client/dist/assets` with `Cache-Control: public, max-age=31536000, immutable`, `index.html` with `Cache-Control: no-cache`, SPA HTML fallback for non-`/api` GET requests accepting HTML, JSON 404 for unknown `/api/*` paths, early `..` path-traversal rejection (HTTP 400), and strict Helmet CSP (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`).
- **Database & Schema**: SQLite database file (`prisma/dev.db`) and schema (`prisma/schema.prisma`), 81 seeded rows across 9 models.
- **Authentication**: JWT signed via HS256 stored in an `HttpOnly`, `SameSite=Lax` (`Secure` in production) cookie named `skillswap_session` (path `/`, 7-day maxAge). Token payload carries only `{ sub: userId }`. Timing-attack protected via dummy bcrypt hash comparisons.
- **CSRF Protection**: For state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`), incoming `Origin` headers must match `ALLOWED_ORIGINS` (must include the real public origin in production), returning HTTP 403 `{ "error": "Invalid origin" }` if foreign.
- **Server Environment Variables (`server/.env`)**:
  - `PORT=4000`: HTTP listen port.
  - `DATABASE_URL="file:../../prisma/dev.db"`: Points to root SQLite database.
  - `JWT_SECRET`: Signing secret (min 32 chars). In production, server refuses to start if missing, short, or placeholder. In dev/test, generates a random per-process secret if omitted.
  - `NODE_ENV`: `development` | `production` | `test`.
  - `ALLOWED_ORIGINS`: Comma-separated trusted origins (`http://localhost:5173,http://localhost:4000` in dev; real site origin in prod).
  - `TRUST_PROXY`: Set to `true` behind a trusted reverse proxy.
  - `RATE_LIMIT_DISABLED`: Set to `true` to disable rate limiting (strictly ignored in production).
  - `NOMINATIM_USER_AGENT`: Geocoding user agent (`SkillSwap-App/1.0`).
  - `AVATAR_STORAGE_DIR`: Local avatar storage directory (`../public/uploads/avatars`, resolved relative to `server/`).

### 4.6 Feature P3.5 Contract (Host event edit/cancel, attendee limits & capacity enforcement)

Built natively in the Express backend (`server/`):
- **Schema Additions**: `Event` has nullable `maxAttendees Int?` (1..1000) and `cancelledAt DateTime?`.
- **Additive GET Fields**: Every event in `GET /api/events` includes `maxAttendees: number | null`, `cancelled: boolean`, `isFull: boolean`, and `goingCount: number`.
- **Cancelled Event Visibility**: Active events (`cancelledAt === null`) are visible to all. Cancelled events (`cancelledAt !== null`) are visible ONLY to the host or attendees with an existing RSVP record. Strangers and unauthenticated visitors cannot see cancelled events.
- **Host Edit (`PATCH /api/events/:id`)**: Host only (403 for non-host). Cannot edit cancelled event (409). Validates capacity: `maxAttendees` cannot be set below current `goingCount` (409 Conflict).
- **Host Cancel (`POST /api/events/:id/cancel`)**: Host only (403 for non-host). Idempotent guard: already cancelled event returns 409 Conflict. Sets `cancelledAt: new Date()` and preserves all attendee records.
- **RSVP with Capacity Guard (`POST /api/events/:id/rsvp`)**:
  - Cancelled event returns 409 Conflict `"This event has been cancelled."`.
  - Toggling OFF (`GOING` -> `CANCELLED`) is ALWAYS permitted, never blocked by capacity.
  - Joining (`GOING`): Enforces `goingCount < maxAttendees` inside a Prisma `$transaction`. If full, returns 409 Conflict `"This event is full."`.
- **Pure Rules**: Logic isolated in `server/src/lib/event-rules.js` (`canEditEvent`, `canCancelEvent`, `validateCapacityChange`, `computeIsFull`, `shouldShowCancelled`). Tested via 21 unit tests.

## 5. Roadmap and Task Checklist

### Phase 0: Bootstrap (docs and audit, no feature code)
- [x] P0.1 Audit the real codebase against this file; correct any mismatch
- [x] P0.2 Create `AGENT_RULES.md` and the agent rules file; create `docs/plans/` and `docs/DECISIONS.md`
- [x] P0.3 Capture the baseline: run tsc, lint, build and record the results in the Changelog

### Phase 1: Stabilize and quick wins
- [x] P1.1 Fix all 16 ESLint errors (unescaped JSX entities, `any` in MapView, hook deps); target 0 errors
- [x] P1.2 Align port and env (`NEXTAUTH_URL`, `.env.example`, fixed dev port)
- [x] P1.3 Add "Messages" link to the Navbar with an unread indicator placeholder
- [x] P1.4 Remove unused imports/variables; clear lint warnings

### Phase 2: Backend hardening (core of "production ready") — COMPLETE
- [x] P2.1 Audit every API route: auth guard, ownership checks, input validation
- [x] P2.2 Zod schemas for all request bodies and query params (shared `src/lib/validators`)
- [x] P2.3 Standard API error/response format and central error handler
- [x] P2.4 Prisma schema review: indexes, unique constraints, enums for status fields, `onDelete` rules
- [x] P2.5 Matching engine: extract to `src/lib/matching.js`, add unit tests, avoid N+1 queries
- [x] P2.6 Pagination for matches, events, messages, reviews (and conversations)
- [x] P2.7 Rate limiting on auth and message endpoints
- [x] P2.8 Review rules: one review per match/session, only after an ACCEPTED match (Phase 2 COMPLETE)

### Phase 3: Feature gaps
- [x] P3.1 Public profile page `/profile/[id]`
- [x] P3.2 Address geocoding via Nominatim in CreateEventDialog (with debounce and usage-policy compliance)
- [x] P3.3 Distance (Haversine) on match and event cards; user location on profile
- [x] P3.4 Avatar upload (storage provider decided in `docs/DECISIONS.md`)
- [x] P3.5 Host can edit or cancel their own events; optional attendee limit (built natively in Express in M2)
- [x] C1 Convert the whole project from TypeScript to plain JavaScript (JSX)

### Migration to React (Vite) + Express
- [x] M1 Express server foundation, auth (cookie JWT sessions), middleware (CSRF, error-handler, logger), profile, public profile, skills routes
- [x] M2 Remaining Express APIs (matches, messages, conversations, reviews, events/rsvp, geocode, avatar upload/serving) + Native P3.5 (host event edit/cancel, attendee limits)
- [x] M3 React (Vite) frontend scaffold (client/), routing, AuthContext, main layout, navbar, 4 core pages ported (/, /auth, /dashboard, /profile/:id)
- [x] M4a Port chat, reviews, and profile setup pages to React client (polling, star rating, address geocoding, avatar upload)
- [x] M4b Port events page to React client (Leaflet map, host edit/cancel, RSVP capacity, CreateEventDialog)
- [x] M5 Final parity validation, decommission Next.js, clean dependencies, update docs and rules (COMPLETE)

### Database Migration: MongoDB (MG1)
- [x] MG1 Migrate data layer from SQLite to MongoDB using Prisma MongoDB connector (UUID @map("_id"), replica set rs0 on port 27018, compound uniques, P2034 conflict handling, atomic RSVP recount/compensation, scratch DB test harness, dry-run migration script) (COMPLETE)

### Phase 4: Chat and notifications
- [ ] P4.1 Unread counts and read receipts
- [ ] P4.2 Replace fixed polling with smarter polling or SSE (decision logged)
- [ ] P4.3 In-app notifications (connect request, accepted, RSVP)

### Phase 5: Database migration
- [ ] P5.1 Switch Prisma to PostgreSQL (Neon or Supabase), create real migrations (`prisma migrate`)
- [ ] P5.2 Production seed vs dev seed separation

### Phase 6: Security, testing, CI
- [x] P6.1 Security headers, CSRF/session review, secrets audit, remove demo-credentials button in production
- [x] P6.2 Test suite: unit (matching, validators), API integration, key E2E flows (178 server tests, 103 client tests, 11 check scripts)
- [x] P6.3 GitHub Actions CI: install, lint, test, build (.github/workflows/ci.yml and .github/dependabot.yml)
- [x] P6.4 Google OAuth fully wired and tested (hand-written OAuth 2.0 PKCE flow, dormant until configured)
- [x] P6.5 Accessibility, responsive pass & client route-level code splitting (React.lazy, entry bundle < 350 kB raw / ~105 kB gzip)

### Phase 7: Deployment and operations
- [x] P7.1 Deployment Preparation (Accept/Decline UI gap, Avatars in MongoDB `AvatarFile`, production seed & restore tools `import-backup.mjs` with `--skills-only`, `render.yaml` Blueprint, engines `>=22.0.0`, `docs/DEPLOYMENT.md`)
- [x] P7.2 Transactional email via Resend (connect request, accept, cancelled events with 50-attendee cap; dormant until configured, abuse limits, dry run)
- [x] P7.3 Health monitoring (`/api/health/db` ping with 3s timeout), production single-line JSON logging, and unhandled exception credential redaction
- [x] P7.4 Account deletion (`DELETE /api/user/account` with full cascade), legal pages (`/privacy`, `/terms`), launch checklist (`docs/LAUNCH-CHECKLIST.md`), and clean-copy build proof

### Owner Tasks (To Be Executed by Platform Owner)
- [ ] Manual deployment to Render.com and MongoDB Atlas using `render.yaml` and `docs/DEPLOYMENT.md`
- [ ] Push database schema to Atlas: `npm --prefix server exec -- prisma db push --schema=prisma/schema.prisma`
- [ ] Configure Google Cloud Console OAuth 2.0 Web Client credentials and add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to Render
- [ ] Set up Resend sending domain and add `RESEND_API_KEY` / `EMAIL_FROM` to Render
- [ ] Set up free HTTP uptime monitor (e.g. UptimeRobot) pointing to `/api/health/db`
- [ ] Replace `CONTACT_EMAIL` placeholder in `client/src/config/site.js` and review Privacy Policy and Terms of Service

### Phase 8: Optional
- [ ] P8.1 WebRTC video sessions

### How to Run SkillSwap
- **Development (Express + Vite concurrently)**: `npm run dev` -> Open `http://localhost:5173` (Express API on `4000`, Vite SPA on `5173`)
- **Development (Individual)**: `npm run dev:server` (port `4000`) | `npm run dev:client` (port `5173`)
- **Production (`client/dist` served by Express)**: `npm run build && npm start` -> Open `http://localhost:4000` (requires production `JWT_SECRET` >= 32 chars & `ALLOWED_ORIGINS` in `server/.env`)

## 6. Quality Gates (all must pass before a task is marked done)

```
Unified Root Orchestrator:
npm run lint    -> 0 errors, 0 warnings (server + client ESLint)
npm test        -> passes (172 server tests across 15 suites + 103 client tests across 15 suites = 275 tests)
npm run build   -> exit 0 (Vite SPA production bundle in client/dist/)

Real-Server Automated Check Scripts:
npm run check                        -> runs all 10 server checks against port 4000 + isolated port 4100 write suite:
  8 Express check scripts            -> 161 assertions (security 20, validation 28, pagination 47, review 5, profile 13, geocode 12, distance 22, avatar 14)
  server/scripts/p35-check.mjs       -> 19 rejection assertions on port 4000 (0 DB mutations)
  server/scripts/p35-write-check.mjs -> 44 write-path assertions on isolated DB copy (0 leakage to dev.db)
node server/scripts/foundation-check.mjs -> 57 auth/CSRF/rate-limit assertions on fresh Express server (:4000)
node server/scripts/prod-smoke-check.mjs -> 35 production mode SPA/CSP/cache/auth assertions (:4000, NODE_ENV=production)
node client/scripts/smoke-check.mjs      -> 21 Vite proxy connectivity & auth assertions (:5173)
node client/scripts/m4a-check.mjs        -> 31 chat, reviews, profile, geocode, avatar proxy assertions (:5173)
node client/scripts/m4b-check.mjs        -> 31 events feed, P3.5 keys, host guards, validation assertions (:5173)
Database: node server/scripts/db-counts.mjs -> dev.db row counts strictly 81 across all 9 tables
```
Plus a manual check of the feature touched, described in the plan file.

## 7. Known Issues

| ID | Issue | Severity | Planned task |
|---|---|---|---|
| K1 | 16 ESLint errors, 26 warnings (Resolved in P1.1/P1.4: 0 errors, 0 warnings) | Resolved | P1.1, P1.4 |
| K2 | `/chat` not in Navbar (Resolved in P1.3: Messages link added to Navbar) | Resolved | P1.3 |
| K3 | No public profile route (Resolved in P3.1: public profile page at /profile/[id] and API at /api/users/[id]) | Resolved | P3.1 |
| K4 | Event creation needs manual lat/lng (Resolved in P3.2: Nominatim address search with manual coordinate fallback) | Resolved | P3.2 |
| K5 | `.env` port 3000 vs dev server 3001 (Resolved in P1.2: port 3001 standardized, dev script locked to -p 3001) | Resolved | P1.2 |
| K6 | No distance calculation (Resolved in P3.3: Haversine distance with whole-km privacy rounding on matches & 0.1km on events, profile setup location search) | Resolved | P3.3 |
| K7 | Avatars are pasted URLs only (Resolved in P3.4: local file upload with sharp WebP re-encoding, metadata stripping, and size caps) | Resolved | P3.4 |
| K8 | socket.io installed but unused (Resolved in M5: removed with Next.js root dependencies) | Resolved | M5 |
| K9 | SQLite is dev-only | High (for prod) | P5.1 |
| K10 | API hardening not yet audited (validation, authorization, rate limits) | High | P2.x |
| K11 | Security: Missing authorization/ownership check on `PATCH /api/matches/[id]` (Resolved in P2.1: verified participant, recipient-only accept/decline) | Resolved | P2.1 |
| K12 | Security: Missing participant checks on `GET /api/messages` & `POST /api/messages` (Resolved in P2.1: participant guard via `getMatchForParticipant`) | Resolved | P2.1 |
| K13 | Security: `POST /api/skills` has no session authentication guard (Resolved in P2.1: requires session 401) | Resolved | P2.1 |
| K14 | Data Integrity: `POST /api/reviews` does not verify prior `ACCEPTED` match (Resolved in P2.1: requires prior ACCEPTED match 403) | Resolved | P2.1, P2.8 |
| K15 | Validation: Zod installed in package.json but completely unused (Resolved in P2.2: all 10 API routes validate inputs with Zod 4 schemas) | Resolved | P2.2 |
| K16 | Testing: No test runner, scripts, or test suite configured (Resolved in P6: Vitest configured with 178 server tests, 103 client tests, and 11 check scripts) | Resolved | P6.2 |
| K17 | Chat messaging is allowed on PENDING matches (Resolved in P6: requester max 3 msgs, recipient 0 msgs until accept, declined 0 msgs 409) | Resolved | P6.1 |
| K19 | UI has no Load more / infinite scroll yet; add during Phase 3 or 4 if lists grow | Low | P3.x, P4.x |
| K20 | Rate limiter is in-memory; it does not work across multiple server instances and resets on restart; replace with Redis/Upstash in P7.1 | Medium | P7.1 |
| K21 | x-forwarded-for spoofing risk (Resolved in P6: replaced with Express req.ip and TRUST_PROXY setting) | Resolved | P6.1 |
| K22 | Reviews page and chat header offer review form for peers already reviewed (Resolved in P3.1: banner replaces form when already reviewed) | Resolved | P3.1 |
| K23 | Profile page has no pagination UI for reviews (API supports it) | Low | P3.x, P4.x |
| K24 | Geocode cache and throttle are in-memory (single instance only); move to a shared store in P7.1 | Medium | P7.1 |
| K25 | Nominatim public server is for light use; switch to a paid or self-hosted geocoder if traffic grows | Low | P7.x |
| K26 | Matches are not sortable by distance yet | Low | P3.x |
| K27 | Demo users need coordinates (run `node server/scripts/set-demo-locations.mjs --apply` after a backup) | Low | P3.x / P5.2 |
| K28 | Avatars are stored on local disk (`public/uploads/avatars` via `AVATAR_STORAGE_DIR`, fallback `storage/avatars`); switch to cloud object storage in P7.1 before deploying to a serverless host | Medium | P7.1 |
| K29 | Old avatar files are removed only on replace or delete (Resolved in P7b: DELETE /api/user/account cascades avatar files from DB and disk) | Resolved | P7b |
| K30 | No static type checking after C1 (runtime validation via Zod only); consider JSDoc plus checkJs later | Low | Post-C1 / Future |
| K31 | Google OAuth not yet rebuilt in Express (Resolved in P7b: hand-written OAuth 2.0 PKCE flow) | Resolved | P7b |
| K32 | Duplicate copies of src/lib modules exist in server/src/lib until M5 (Resolved in M5: legacy src/ deleted; server/src/lib is sole source) | Resolved | M5 |
| K33 | CSRF protection relies on Origin checks plus SameSite=Lax (Resolved in P6: added Sec-Fetch-Site: cross-site 403 Forbidden check) | Resolved | P6.1 |
| K34 | Rate limiter, geocode cache and throttle are in-memory (resets on restart) | Medium | P7.1 |
| K35 | GET /api/reviews was public (Resolved in P6: requires active session 401 Unauthorized) | Resolved | P6.1 |
| K36 | Client SPA bundle size (Resolved in P6: route-level code splitting with React.lazy, entry bundle split from 650 kB to 333 kB raw / 105 kB gzip) | Resolved | P6.5 |
| K37 | Google OAuth button on /auth is disabled 'Coming Soon' (Resolved in P7b: enabled when providers.google is true, hidden when false) | Resolved | P7b |
| K38 | Chat polling uses 3s setInterval fallback; planned for SSE/WebSocket in Phase 4 | Low | P4.2 |
| K39 | Event cancellation sends no notifications (Resolved in P7b: fire-and-forget email notifications to attendees) | Resolved | P7b |
| K40 | Map tiles come from the public OpenStreetMap tile server, fine for light use; switch to a tile provider before heavy traffic | Low | P7.1 |
| K41 | Google OAuth deferred to deployment (Resolved in P7b: implemented and dormant until configured) | Resolved | P7b |
| K42 | Production database must be MongoDB Atlas; local replica set is for development only | High | P7.1 |
| K43 | Avatars are stored on local disk (Resolved in P7a: stored directly in MongoDB via AvatarFile model with disk fallback) | Resolved | P7.1 |
| K44 | CI integration job unverified until the first GitHub run | Low | P6.3 / P7.1 |
| K45 | Render Free tier spins down after 15 min of inactivity; first request takes ~50s (cold start) (Mitigated in P7b: /api/health/db ping via uptime monitor) | Low | P7b |
| K46 | Single instance constraint: application uses in-memory rate limiting and in-memory Nominatim geocode cache; multi-instance scaling requires Redis | Medium | Documented |
| K47 | MongoDB Atlas M0 free tier does not include automated continuous backups; manual export via `export-backup.mjs` recommended | Low | Documented |
| K48 | Email ownership is not verified for password sign-ups (verification email flow deferred) | Low | Future |
| K49 | Email rate limits and pair caps are in-memory and reset on server restart | Low | Future |
| K50 | Deleted user accounts may remain in historical database backup archives | Low | Documented |
| K51 | Google OAuth flow is hand-written with PKCE (zero packages); review or replace with maintained library in future | Low | Future |

## 8. Decisions Log (summary; details in `docs/DECISIONS.md`)

| Date | Decision | Reason |
|---|---|---|
| 2026-10-21 | Use this file plus per-task plan files as the agent memory | Keeps AI sessions consistent and mistake-free |
| 2026-10-22 | Resolve `react-hooks/set-state-in-effect` using `useCallback` + microtask decoupling without disabling ESLint rules | Ensures React 19 compiler compatibility while eliminating cascading render warnings |
| 2026-10-22 | Fix dev port to 3001 via `next dev -p 3001` | Port 3000 occupied by existing node dev process (PID 30292); explicit flag prevents Next.js silent port-drifting |
| 2026-10-22 | Restrict connection acceptance/rejection strictly to the recipient (`userBId`) | Requesters (`userAId`) are forbidden (403) from accepting their own connection requests |
| 2026-10-22 | Preserve participant messaging across conversation states in `POST /api/messages` | Avoid breaking chat UI workflows across pending connection conversations while strictly enforcing participant access |
| 2026-10-22 | Eliminate `passwordHash` leaks in `/api/user/profile` via `SAFE_PROFILE_SELECT` | Explicit Prisma `select` projection guarantees `passwordHash` is never serialized over the wire |
| 2026-10-22 | Standardize API input validation on Zod 4 schemas with `strip` behavior in `src/lib/validators` | Centralized schemas enable reuse, reject invalid inputs with structured details, and strip extra fields |
| 2026-10-22 | Handle empty string coordinate inputs via Zod preprocessors in `createEventSchema` | `CreateEventDialog` sends `""` when lat/lng are omitted; preprocessing `""` to `undefined` allows optional coords without UI breaks |
| 2026-10-22 | Standardize error response format as `{ "error": string, "details": [...] }` via `src/lib/api-error.js` | Retains top-level `"error"` key required by current frontend while providing structured error details and catching malformed JSON |
| 2026-10-22 | Normalize login email to lowercase and trimmed in `src/lib/auth.js` | SQLite `@unique` is case-sensitive by default; normalizes credentials to ensure case-insensitive login consistency |
| 2026-10-22 | Migrate string status/proficiency fields to native Prisma enums (`MatchStatus`, `AttendanceStatus`, `ProficiencyLevel`) | Prisma 6.4 supports enums on SQLite, providing runtime type safety across DB and application layers without data loss |
| 2026-10-22 | Use composite index `@@index([userAId, userBId, matchedSkillId])` and runtime check on `Match` instead of schema `@@unique` | Adding schema `@@unique` on SQLite triggers destructive `--accept-data-loss` prompt during `prisma db push`; composite index + route check enforces integrity safely |
| 2026-10-22 | Extract matching logic into pure domain module `src/lib/matching.js` with in-memory Vitest unit tests | Pure functions enable deterministic testing without database setup or network side effects, while guaranteeing 100% snapshot parity |
| 2026-10-22 | Parallelize `GET /api/matches` queries via `Promise.all` and remove per-request `ensureSamplePeersExist` check | Removing `SELECT COUNT(*)` and executing `currentUser`, `otherUsers`, and `matches` lookups concurrently reduces latency and eliminates redundant count queries |
| 2026-10-22 | Safe backward-compatible pagination with dual metadata contract across all list endpoints | Preserves 100% backward compatibility with existing frontend consumers with zero UI edits. Default caps protect server memory while returning complete current dataset. |
| 2026-10-22 | In-memory sliding window rate limiter on globalThis with injectable clock and RATE_LIMIT_DISABLED testing switch | Avoids introducing cloud infrastructure dependencies before Phase 7 while immediately securing login and write endpoints; globalThis preserves state across Next.js HMR. |
| 2026-10-23 | Enforce one review per user pair via composite index and transactional concurrency check with 409 Conflict | Adding @@unique on SQLite requires destructive table recreation prompting for --accept-data-loss; composite index @@index([fromUserId, toUserId]) combined with a check-and-insert Prisma transaction guarantees race safety and returns HTTP 409 Conflict without risking database data loss. |
| 2026-10-23 | Strict privacy allow-list projection on GET /api/users/[id] and null average for 0 reviews | Never exposes email, passwordHash, or precise latitude/longitude over public profile API. Rating average returns null when count is 0 to avoid fabricating rating scores. On /reviews, form is conditionally replaced with already-reviewed notice (K22) to prevent failed submissions. |
| 2026-10-23 | Server-side proxy, 1 req/sec throttle gate, and 24h memory cache for OpenStreetMap Nominatim geocoding | Prevents leaking client IPs or user info to third parties, strictly adheres to Nominatim usage policy (1 req/sec max, custom User-Agent, attribution, 24h cache), and insulates client from upstream rate limits and failures with a friendly 503 fallback. |
| 2026-10-23 | Privacy-first Haversine distance calculation (whole-km peer rounding, 0.1 km event rounding) and reusable AddressSearch component | Never leaks another user's latitude or longitude to the browser. Peer distances are rounded to nearest whole km (<1 km rounds to 0, rendered as 'Less than 1 km away'). Public events are rounded to 0.1 km. Reusable AddressSearch component extracted from CreateEventDialog powers both event hosting and profile location setting with zero code duplication. |
| 2026-10-23 | Add nullable latitude and longitude (Float?) columns to User model | Added nullable `latitude Float?` and `longitude Float?` to model User in `prisma/schema.prisma` with the owner's explicit approval and applied via non-destructive `prisma db push`, preserving all existing data and rows. |
| 2026-10-24 | Avatar upload with sharp WebP re-encoding, EXIF stripping, magic-number detection, and swappable storage interface | Server-side sharp re-encodes to 512x512 WebP (quality 80) and strips all EXIF/GPS metadata. Input pixels capped to 25 MP. Types sniffed by magic bytes (JPEG/PNG/WebP only; SVG/HTML/PDF rejected). Storage abstracted behind `AvatarStorage` (save, delete, read) defaulting to `storage/avatars/` outside public/, enabling clean drop-in replacement with cloud object storage in P7.1. |
| 2026-11-06 | Convert entire project from TypeScript to plain JavaScript (JSX) (Task C1) | Owner requirement for plain JavaScript. Mechanical conversion in stages with zero behavior change; React stays, TypeScript syntax and packages removed; runtime validation via Zod 4 maintained. |
| 2026-11-06 | Migration to decoupled React (Vite) frontend + separate Express backend (M1 Foundation) | Strangler fig pattern keeps legacy Next.js app running untouched on port 3001 while Express server is built in server/ on port 4000 sharing dev.db and prisma/schema.prisma. HttpOnly JWT cookie (skillswap_session) replaces NextAuth session. |
| 2026-11-06 | Native P3.5 event editing, cancellation, and attendee limits in Express backend (Task M2) | Added nullable maxAttendees and cancelledAt to model Event in prisma/schema.prisma without data loss. Native Node 24 Request.prototype.formData() eliminates multer. Cancelled events visible only to hosts/attendees. Capacity limits enforced in Prisma transaction with 409 Conflict. Full parity across all ported routes verified against port 3001 and 4000 (36/36 parity assertions passed). |
| 2026-11-06 | React (Vite) client scaffold with same-origin dev proxy (Task M3) | Built client/ using Vite, React 19, React Router v7, and Tailwind CSS v4. Dev proxy forwards /api to Express on 4000 while preserving Origin (localhost:5173) for CSRF compliance. Centralized AuthContext with cookie session synchronization. 4 core pages ported (/, /auth, /dashboard, /profile/:id) and placeholders for M4. |
| 2026-11-06 | Port Chat, Reviews, and Profile Setup pages to React Vite client with resilient polling and race prevention (Task M4a) | In `ChatPage.jsx`, implemented resilient 3s polling with per-match in-flight protection (`inFlightMatchIdRef`), tab visibility pause/resume via `document.visibilitychange`, and active conversation switch discard guard (`activeMatchIdRef`). Auto-scroll preserves scrollback reading position (`isNearBottom`). In `ReviewsPage.jsx`, wired 1-5 star selector, 409 duplicate conflict handling, and pagination. In `ProfileSetupPage.jsx`, eliminated avatar upload race condition by immediately updating local state and calling `AuthContext.refresh()`, guaranteeing subsequent profile saves submit the newly generated avatar URL. Extracted reusable `AddressSearch.jsx` with request counter ignoring stale out-of-order geocodes and OpenStreetMap attribution. |
| 2026-11-06 | Direct Leaflet integration with bundler icon resolution, XSS-safe DOM popups, and unified EventDialog with P3.5 capacity handling (Task M4b) | Direct `leaflet` dependency matching root `^1.9.4` without `react-leaflet`. Local image imports for icon paths. Popups build DOM nodes using `textContent` for XSS prevention. Key-based form re-initialization in `EventDialog.jsx` eliminates `useEffect` state synchronization. Differential patching (`buildEventPatch`), capacity limit enforcement (`isFull`), and cancellation confirmation dialog. |
| 2026-11-11 | Decommission Next.js monolith, add Express production SPA serving with Helmet CSP, and rewrite root as thin orchestrator (Task M5) | Removed legacy `src/`, `.next/`, root Next configs/deps, and old port-3001 scripts/snapshots. Preserved `public/uploads/avatars/` for active `AVATAR_STORAGE_DIR` local avatars and fixed relative path resolution in `avatar-storage.js`. Implemented production static serving (`immutable` `/assets`, `no-cache` `index.html`), SPA HTML fallback, JSON `/api/*` 404 preservation, `..` traversal rejection, and exact 8-directive Helmet CSP (`useDefaults: false` avoids `upgrade-insecure-requests` on HTTP `localhost:4000`). Added `scripts/dev.mjs`, `scripts/start.mjs`, `server/scripts/run-checks.mjs`, `server/scripts/prod-smoke-check.mjs`, and `server/test/static-serving.test.js`. |

## 9. Changelog

- 2026-11-17 (Task P7b: Production Hardening, Logging, Account Deletion, Hand-Written OAuth PKCE, Resend Email & Launch Prep):
  - Pre-execution backup exported to `D:\skillswap-backups\2026-11-17T06-23-36-717Z` (81 documents). Confirmed byte-identical `prisma/dev.db` hash (`27DEF9FD4087FC8C71A4492F9FFD6D82CB94FDC8FF23F4C645EE442C5293D4C0`).
  - Baseline quality gate recorded (Part 0): server lint 0/0, client lint 0/0, server tests 189 passed (16 files), client tests 112 passed (15 files), client build ok, check scripts 245 assertions passed (11 scripts), prod smoke 35 passed, foundation 57 passed.
  - Part 1 (Interface Changes): Skipped per prompt rule since owner section contained placeholder `<<< FILL IN: ... >>>`.
  - Part 2 (Logging & Health):
    - Implemented production single JSON line request logger in `server/src/middleware/logger.js` (`timestamp`, `requestId`, `method`, `path` without query, `status`, `durationMs`, and `userId` if logged in). Explicitly omits headers, cookies, bodies, query strings, IP addresses, and emails.
    - Set UUID `X-Request-Id` header on all responses.
    - Implemented `redactMongoUri` helper redacting credentials in `mongodb://` and `mongodb+srv://` URIs; wired process crash handlers (`unhandledRejection`, `uncaughtException`) to log 1 redacted JSON line and exit(1).
    - Added `GET /api/health/db` endpoint with 3-second database ping timeout and 30 req/min/IP rate limit, returning `{ "status": "ok" }` (200) or `{ "status": "unavailable" }` (503). Added unit tests in `server/test/logging-health.test.js` (15 tests passed).
  - Part 3 (Account Deletion, Privacy & Terms):
    - Added `DELETE /api/user/account` endpoint with 3/hr rate limit, validating `{ confirm: "DELETE", password }` (password required unless account has an `OAuthAccount`, returning 403 on wrong password).
    - Executed strict dependency-ordered cascading cleanup across all collections: hosted events, attendances, matches, messages, reviews given and received, skills, avatar files (DB & disk), OAuth accounts, user document, and cleared session cookie. Added additive `authMethod` ("password" | "google") to `GET /api/user/profile`.
    - Scratch integration test in `server/test/account-deletion.test.js` proved zero orphaned records referencing user ID across all MongoDB collections, peer user data intact, and second delete returning 404.
    - Added Danger Zone in `ProfileSetupPage.jsx` with confirmation dialog modal.
    - Created `client/src/config/site.js`, `PrivacyPage.jsx` and `TermsPage.jsx` (with plain-language disclosures, stranger safety advice, and disclaimer banner), wired lazy routes `/privacy` and `/terms` in `App.jsx`, and linked from footer and signup form.
    - Added client tests in `client/src/test/legal-and-deletion.test.jsx` (7 tests passed).
  - Part 4 (Google Login via Hand-Written OAuth 2.0 PKCE):
    - Implemented PKCE helpers in `server/src/lib/oauth.js` using built-in `crypto` (zero new npm dependencies).
    - Added `GET /api/auth/providers` (`{ google: boolean }`), `GET /api/auth/google` (rate limited 20/10 min/IP, signed JWT in HttpOnly SameSite=Lax 10-minute cookie `skillswap_oauth`, 302 redirect to Google with code_challenge S256), and `GET /api/auth/google/callback`.
    - Callback verifies state with timing-safe comparison, clears cookie, exchanges code with 5s timeout, verifies `email_verified === true`, and enforces anti-pre-hijacking protection (`/auth?error=account_exists` when email exists without OAuth link). New users created with 48-byte random password and redirected to `/profile/setup`; existing OAuth users redirected to `/dashboard`.
    - Added enabled "Continue with Google" button on `AuthPage.jsx` (shown when providers.google is true, hidden when false) and friendly query error banners (`google_cancelled`, `account_exists`, `google_failed`, `google_unavailable`).
    - Added unit and scratch integration tests with local mock Google OAuth server in `server/test/google-auth.test.js` (12 tests passed) and client tests in `AuthPage.test.jsx`.
  - Part 5 (Email Notifications via Resend API):
    - Implemented `server/src/lib/email.js` using built-in `fetch` with 5s timeout. Dormant if `RESEND_API_KEY` or `EMAIL_FROM` missing; dry run mode logs subject and recipient domain only.
    - Implemented `server/src/lib/email-templates.js` with HTML escaping and CR/LF subject stripping (100 char cap). Crucially, templates NEVER include chat message text and include opt-out links.
    - Added fire-and-forget notification triggers in `matches.js` and `events.js` for new connection requests, accepted requests, and cancelled events (capped at 50 attendees, excluding host). Respects `User.emailNotifications` setting.
    - Enforced in-memory abuse limits: max 5/hr, 20/day per recipient, and max 1 request email per pair per 24 hours.
    - Added additive `emailNotifications` field on User (`GET`/`PUT /api/user/profile`) and toggle checkbox in `ProfileSetupPage.jsx`.
    - Added unit and scratch integration tests with local mock Resend server in `server/test/email.test.js` (10 tests passed).
  - Part 6 (Remove Unwanted Code):
    - Audited unused files: removed unused Next.js starter components `client/src/components/ui/table.jsx` (93 LOC) and `client/src/components/ui/scroll-area.jsx` (40 LOC), reducing CSS bundle size.
    - Audited dependencies: verified zero unused packages in `server/package.json`. Kept `@radix-ui/react-scroll-area` in `client/package.json` under "Not removed, owner to decide" to avoid package-lock.json mutation without owner instruction.
  - Part 7 (Docs & Launch Checklist):
    - Updated `render.yaml`, `server/.env.example`, and `.env.example` with `PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` using `sync: false`.
    - Created beginner-friendly, click-by-click `docs/LAUNCH-CHECKLIST.md`.
    - Updated `README.md`, `PROJECT_STATUS.md`, and `docs/DECISIONS.md`.
  - Verification: Server test suite: 228 passed across 20 test files; Client test suite: 124 passed across 16 test files (352 tests total, 100% passing). Server lint: 0/0, client lint: 0/0.

- 2026-11-17 (Task P7a: Deployment Preparation, Accept/Decline UI, Avatars in MongoDB & Data Tools):
  - Created plan file `docs/plans/P7a-deploy-prep.md` before coding.
  - Exported pre-execution backup of main database (`skillswap`) to `D:\skillswap-backups\2026-11-16T11-58-12-979Z` (81 documents). Confirmed byte-identical `prisma/dev.db` hash.
  - Part A (Accept/Decline UI Gap):
    - Audited `DashboardPage.jsx`, `ProfileDetailPage.jsx`, `ChatPage.jsx`, and APIs. Confirmed previous absence of Accept/Decline controls and lack of directional metadata.
    - Added additive `requestDirection` ("SENT" | "RECEIVED" | null) to `GET /api/matches`, `GET /api/conversations`, and `viewer.requestDirection` on `GET /api/users/:id`, calculated via pure helper `determineRequestDirection`.
    - Added unit tests in `matching.test.js` and `profile-view.test.js`.
    - Implemented UI controls: Dashboard "Wants to swap with you" badge and Accept/Decline buttons; Profile Accept/Decline action buttons; Chat received request banner with Accept/Decline, sent request counter hint, and disabled input with explanatory placeholder ("Accept the request to reply.").
    - Added comprehensive client tests in `DashboardPage.test.jsx`, `ProfileDetailPage.test.jsx`, and `ChatPage.test.jsx` (Client Vitest suite increased from 103 to 112 tests, 100% passing).
  - Part B (Avatars in MongoDB):
    - Added `model AvatarFile` (`id String @id @map("_id")`, `userId String`, `contentType String`, `size Int`, `data Bytes`, `createdAt DateTime`, `@@index([userId])`, `@@map("AvatarFile")`) to `prisma/schema.prisma`.
    - Applied schema push to main database; confirmed existing 81 documents remain untouched.
    - Implemented `MongoAvatarStorage` in `server/src/lib/avatar-storage.js` with `AVATAR_STORAGE=mongo` default and fallback to disk for legacy avatars; added unit tests in `server/test/avatar.test.js`.
    - Created `server/scripts/migrate-avatars-to-db.mjs` (default dry run, validates regex, verifies user existence, sha256 checksums, refuse to overwrite; proved on scratch DB, ran dry run on main DB finding 1 avatar, did not apply to main DB).
    - Updated `server/scripts/p35-write-check.mjs` Section C to verify MongoDB `AvatarFile` when `AVATAR_STORAGE !== 'disk'`.
  - Part C (Production Data Tools):
    - Created `server/scripts/import-backup.mjs` (default dry run, `--apply` writes, `--skills-only` option, topological dependency order, strict empty-destination safety refusal, validates unique constraints/enums/FKs). Tested and verified on scratch databases (full 81-doc restore and 13-doc `--skills-only` restore).
    - Added client-side production demo credential guard in `client/src/pages/AuthPage.jsx`: hides "Fill Demo Credentials" button when `import.meta.env.PROD` is true; added unit tests for dev and prod modes.
  - Part D (Deployment Preparation):
    - Added `"engines": { "node": ">=22.0.0" }` to root, `server/`, and `client/` `package.json`.
    - Added `binaryTargets = ["native", "debian-openssl-3.0.x"]` in `prisma/schema.prisma`.
    - Created Render Blueprint [`render.yaml`](file:///d:/project/render.yaml) (1 web service, Node 22, health check `/api/health`, NODE_ENV=production, AVATAR_STORAGE=mongo, TRUST_PROXY=true).
    - Proved clean scratch build and execution in `../skillswap-deploy-test` via `server/scripts/test-clean-deploy.mjs` (ran exact build command with `--prefix server` prisma pin, started production server with random secret, passed 32 production smoke assertions against scratch DB).
    - Documented single-instance constraint prominently in `PROJECT_STATUS.md`, `README.md`, and `docs/DEPLOYMENT.md`.
    - Created complete beginner-friendly click-by-click guide [`docs/DEPLOYMENT.md`](file:///d:/project/docs/DEPLOYMENT.md).
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings (server + client); `npm test` -> 293 passed (181 server across 16 suites + 112 client across 15 suites); `npm run build` -> exit 0; `npm run check` -> 11 scripts passed; `node server/scripts/prod-smoke-check.mjs` -> 35 passed; main database counts -> strictly 81 documents + 0 in AvatarFile; dev.db hash -> 27DEF9FD4087FC8C71A4492F9FFD6D82CB94FDC8FF23F4C645EE442C5293D4C0 (167,936 bytes).


- 2026-11-16 (Task P6: Security Hardening, Testing, Performance & CI Automation):
  - Created plan file `docs/plans/P6-security-ci.md` before coding.
  - Proved Task MG1 works via pre-execution quality gates against scratch database (172 server tests, 103 client tests, 161 checks + 19 p35 + 47 p35-write + 57 foundation + 35 prod smoke = ALL PASSED). Exported pre-task backup to `D:\skillswap-backups\2026-11-16T10-51-27-827Z` (81 documents).
  - Security hardening:
    - Added NoSQL injection & type mismatch defenses: verified all Zod schemas reject object payloads (`{"$ne": ""}`) and array query parameters with 400 Bad Request.
    - Required active user session on `GET /api/reviews` (returns 401 for unauthenticated requests).
    - Implemented messaging anti-abuse rules on connection states: requester allowed up to 3 messages while `PENDING` (409 on 4th); recipient rejected with 409 ("Accept the request to reply."); `DECLINED` requests reject all messages (409).
    - Hardened CSRF middleware: rejects state-changing requests with `Sec-Fetch-Site: cross-site` with 403 Forbidden.
    - Upgraded Helmet and security headers: added `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS in production (1 year), and disabled `X-Powered-By`. Expanded CSP `img-src` to `["'self'", 'data:', 'blob:', 'https:']` to support Unsplash avatars.
    - Eliminated IP spoofing in rate limiting: refactored `getClientIp` to rely on Express `req.ip` gated by configurable `TRUST_PROXY`.
    - Sanitized production 500 error responses via `sendInternalError` returning generic `{ "error": "Something went wrong" }`.
    - Added `server/scripts/security2-check.mjs` (18 assertions) and wired into `run-checks.mjs` (now 11 scripts).
  - Client performance & code-splitting:
    - Implemented route-level code-splitting in `client/src/App.jsx` with `React.lazy()` and `<Suspense>` fallback for `DashboardPage`, `ProfileDetailPage`, `ChatPage`, `ReviewsPage`, `ProfileSetupPage`, `EventsPage`, and `NotFoundPage`.
    - Reduced main entry bundle from 650.71 kB to 332.94 kB (~105 kB gzip), completely isolating Leaflet into `EventsPage` chunk (187 kB) and eliminating Vite chunk-size warnings.
    - Verified all 103 client unit tests pass with zero regressions.
  - Continuous Integration:
    - Created `.github/workflows/ci.yml` with dual `quality` (lint, unit tests, client build) and `integration` (containerized MongoDB 7 replica set `rs0`, schema push, seeding, full check suite, prod smoke check, foundation check, Vite preview client checks) jobs.
    - Created `.github/dependabot.yml` configured for weekly grouped npm dependency updates (minor and patch only).

- 2026-11-16 (Task MG1: Baseline Data Migration Applied to MongoDB):
  - Executed data migration: `node server/scripts/migrate-sqlite-to-mongo.mjs --apply`.
  - Migrated all 81 baseline records from SQLite (`prisma/dev.db`) into the active MongoDB replica set `rs0` (`skillswap` database on port 27018) in topological dependency order.
  - Verified post-import document counts across all 9 collections: User 13, Skill 13, UserSkillsTeach 17, UserSkillsLearn 15, Match 7, Event 5, EventAttendee 8, Review 1, Message 2 (Total: 81).
  - Validated Alex Kumar credentials (`password123`) via bcrypt verification against the imported hash.
  - Exported verified JSON backup to `D:\skillswap-backups\2026-11-16T10-38-29-520Z`.
  - Confirmed `prisma/dev.db` remains 100% byte-identical to `D:\dev.db.backup19`. All UUID primary keys and relations validated with zero duplicates or dangling references.

- 2026-11-13 (Task MG1: Move Data Layer from SQLite to MongoDB Replica Set via Prisma):
  - Pre-task backups created: `prisma/dev.db` backed up to `D:\dev.db.backup19` (167,936 bytes, 81 rows, SHA256 `27DEF9FD4087FC8C71A4492F9FFD6D82CB94FDC8FF23F4C645EE442C5293D4C0` verified); reference schema saved at `docs/legacy/schema.sqlite.prisma`.
  - Authored comprehensive execution plan: `docs/plans/MG1-mongodb.md` before coding.
  - Setup single-node replica set `rs0` on port 27018 with dbpath `D:\mongo-skillswap\data`, keeping standalone 27017 and external project databases (`smart_city`, `zipi`) 100% untouched.
  - Created `scripts/start-mongo.bat` for restarting the replica set across reboots.
  - Transformed `prisma/schema.prisma`:
    - Updated datasource provider to `"mongodb"` and url to `env("MONGODB_URL")`.
    - Generated Prisma Client directly into `server/node_modules/.prisma/client`.
    - Retained UUID string primary keys mapped to MongoDB's `_id` (`id String @id @default(uuid()) @map("_id")`); all foreign keys remain plain `String` (NO `@db.ObjectId`).
    - Added compound unique constraints: `Match @@unique([userAId, userBId, matchedSkillId])` and `Review @@unique([fromUserId, toUserId])`.
    - Ran `prisma db push` on main database `skillswap`, creating all 9 collections and indexes. Verified `skillswap` has strictly **0 documents** across all collections.
  - Updated server environment and runtime code:
    - `server/src/config/env.js`: Replaced `DATABASE_URL` with `MONGODB_URL` (Zod validated to start with `mongodb://` or `mongodb+srv://`), added `extractDatabaseName()` extracting `DB_NAME` without exposing secrets, removed SQLite path-resolution logic.
    - `server/src/db/prisma.js`: Updated datasource URL to `config.MONGODB_URL`.
    - `server/src/index.js`: Logs database name on boot without exposing credentials.
    - `server/src/routes/reviews.js`: Caught MongoDB replica set write conflict code `P2034` alongside `P2002` returning 409 Conflict.
    - `server/src/routes/events.js`: Handled MongoDB missing-field semantics in `GET /api/events` (`OR: [{ cancelledAt: null }, { cancelledAt: { isSet: false } }]`), set explicit `cancelledAt: null` on creation, and implemented atomic write-and-recount compensation in `POST /api/events/:id/rsvp` to guarantee `goingCount <= maxAttendees` under snapshot isolation.
  - Created migration & helper scripts:
    - `server/scripts/migrate-sqlite-to-mongo.mjs`: Read-only extraction using `node:sqlite`, dry-run default, topological batch insertion, 81-row verification, and bcrypt verification (`alex@example.com` / `password123`) without logging hashes.
    - `server/scripts/test-db-helper.mjs`: Manages ephemeral scratch databases (`skillswap_test_<timestamp>`) with strict `_test_` drop guards.
    - `server/scripts/export-backup.mjs`: Exports all 9 collections to JSON files in `../skillswap-backups/<timestamp>` without printing password hashes.
    - `server/scripts/seed.mjs`: Standalone ESM seed script for MongoDB that refuses to run if any users exist.
    - `server/scripts/run-checks.mjs`: Runs 9 server check scripts against a scratch database on port 4000, then executes `p35-write-check.mjs` on port 4100.
    - `server/scripts/db-inspect.mjs`: Ported duplicate detection from raw SQL to database-agnostic in-memory grouping.
  - Quality verification:
    - `npm run lint`: 0 errors, 0 warnings across server and client.
    - `npm test`: 172/172 server tests passed (15 suites) and 103/103 client tests passed (15 suites).
    - `npm run check`: All 10 server check scripts passed (227 total assertions, including 3 concurrency race condition tests).
    - `npm run build`: Vite client build succeeded with exit code 0.
    - `prisma/dev.db`: Verified 167,936 bytes and SHA256 byte-identical to pre-task backup.
    - `skillswap` database on port 27018: Verified strictly 0 documents across all 9 collections.

- 2026-11-11 (Task M5: Decommission Next.js, Clean Structure, Production Serving & Docs):
  - Created full pre-M5 backups outside the project: workspace snapshot at `D:\skillswap-before-m5` (471 files, excluding `node_modules/`, `.next/`, `client/dist/`) and database snapshot at `D:\dev.db.backup18` (167,936 bytes, 81 rows).
  - Verified baseline prior to deletion: 103 client tests, 163 server tests, 21 smoke, 31 m4a, 31 m4b, 161 server checks, 57 foundation checks, 19 p35 checks, 81 DB rows.
  - Authored execution plan: `docs/plans/M5-decommission-next.md` with complete file inventory, import-independence proof, script disposition table, root orchestrator design, and production serving/CSP architecture.
  - Decommissioned legacy Next.js application & root-only configs:
    - Removed `src/`, `.next/`, `next.config.mjs`, `jsconfig.json`, `eslint.config.mjs`, `vitest.config.js`, `postcss.config.mjs`, `components.json`.
    - Removed unused Next starter SVGs (`public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) while preserving `public/uploads/avatars/` used by `AVATAR_STORAGE_DIR` in `server/.env`.
    - Removed port-3001 check scripts (`scripts/*-check.mjs`), C1 snapshot scripts/fixtures (`scripts/take-snapshots.mjs`, `compare-snapshots.mjs`, `scripts/snapshots/`), and `server/scripts/parity-check.mjs`.
    - Ported and adapted `db-counts.mjs`, `db-inspect.mjs`, and `set-demo-locations.mjs` to `server/scripts/` using `../src/db/prisma.js`.
    - Updated `client/scripts/m4a-check.mjs` and `m4b-check.mjs` to import `{ prisma } from '../../server/src/db/prisma.js'` so `client/` and `server/` have zero dependencies on root `node_modules`.
  - Converted root `package.json` to a thin orchestrator (`skillswap`, private, ESM, zero dependencies; `dev`, `dev:server`, `dev:client`, `build`, `start`, `test`, `lint`, `check`) backed by plain-Node `scripts/dev.mjs`, `scripts/start.mjs`, and `server/scripts/run-checks.mjs`. Regenerated root `package-lock.json` via `npm install` (pruned 526 legacy root packages; 0 vulnerabilities).
  - Implemented Production Serving & CSP in `server/src/app.js` & `server/src/lib/avatar-storage.js`:
    - Added optional `{ isProduction, clientDistDir }` options to `createApp()`.
    - Added early path-traversal rejection (`rejectPathTraversal` middleware blocking encoded or raw `..` and `\` path segments with HTTP 400).
    - Enabled strict Helmet CSP in production (`useDefaults: false` with exact 8 directives: `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob: https://*.tile.openstreetmap.org`, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`) plus `same-origin` CORP.
    - Configured `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`, `index.html` with `Cache-Control: no-cache`, SPA HTML fallback for non-`/api` non-`/assets` GET requests accepting HTML, and guaranteed JSON 404 for unknown `/api/*` endpoints.
    - Fixed `LocalDiskAvatarStorage` in `server/src/lib/avatar-storage.js` to resolve relative `AVATAR_STORAGE_DIR` paths relative to `server/` root regardless of working directory.
    - Documented production `ALLOWED_ORIGINS` requirements in `server/.env.example`.
  - Added tests & smoke checks:
    - Authored `server/test/static-serving.test.js` (9 tests covering `/` shell & CSP, `/dashboard` SPA fallback, immutable `/assets` headers, `/api/*` JSON 404, missing `/assets/*` 404, JSON-Accept `/dashboard` 404, encoded & raw `..` path traversal rejection).
    - Authored `server/scripts/prod-smoke-check.mjs` (35 assertions validating production mode `:4000` with ephemeral secret, CSP, headers, immutable cache, SPA fallback, CSRF, login/session, and avatar WebP serving).
  - Updated `README.md`, `AGENT_RULES.md`, `.agent/rules/agent-rules.md`, `.agents/rules/agent-rules.md`, `.env.example`, `docs/DECISIONS.md`, and `PROJECT_STATUS.md` (resolved K8 & K32; advanced Next task to `MG1`).

- 2026-11-06 (Task M4b: Port Events Page, Leaflet Map, and Event Dialog with P3.5 Capacity/Edit/Cancel):
  - Pre-task database backup created: `D:\dev.db.backup17` (167,936 bytes, 81 rows) before touching any code.
  - Authored execution plan: `docs/plans/M4b-events-map.md` covering component layout, data flow contracts, Leaflet lifecycle, P3.5 state matrix, XSS sanitization, test plan, and quality gates.
  - Installed single approved dependency: `leaflet@^1.9.4` in `client/package.json` (matching root `package.json`). Zero extra dependencies (`react-leaflet` not used).
  - Authored pure event helpers (`client/src/lib/events.js`):
    - `toLocalInputValue(dateOrIso)`: converts Date or ISO UTC string to local `YYYY-MM-DDTHH:mm` format for `<input type="datetime-local">`, preserving local hours near midnight.
    - `fromLocalInputValue(localStr)`: parses local datetime input to valid ISO UTC string.
    - `buildEventPatch(original, form)`: compares original event with form state; returns only modified fields (`title`, `description`, `location`, `dateTime`, `lat`, `lng`, `maxAttendees`); returns `{}` when unchanged.
    - `canRsvp(event, viewer)`: checks RSVP permissions; blocks cancelled events and full events (for non-attendees); guarantees attendees who are already going can always toggle RSVP OFF even on full events.
    - `eventStatusLabel(event)`: returns status badge configuration for Cancelled, Full, and Host ("Your Event") states.
    - `formatEventDateTime(dateTimeStr)`: formats event date/time in user's local timezone (e.g. *"Wed, Oct 28 at 07:18 PM"*).
  - Ported Interactive Leaflet Map Component (`client/src/components/MapView.jsx`):
    - Bundler-safe Leaflet icon resolution via local image assets (`leaflet/dist/images/marker-icon.png`, `marker-icon-2x.png`, `marker-shadow.png`).
    - OpenStreetMap tile layer with required attribution (`&copy; OpenStreetMap contributors`).
    - Robust coordinates filtering: strictly rejects `null`, `undefined`, and empty coordinate strings (preventing `Number(null) === 0` false coordinate placement).
    - XSS Prevention: popups dynamically construct DOM elements using `document.createElement` and `textContent` rather than string interpolation, neutralizing script and image tag injection attacks.
    - Clean lifecycle management: `map.remove()` on component unmount; `map.invalidateSize()` called on mount and view switches to ensure crisp rendering without grey/unloaded tiles.
  - Ported Unified Event Dialog (`client/src/components/EventDialog.jsx`):
    - Dual Create and Edit modes in a single modal.
    - Key-based form re-initialization (`<EventFormContent key={event?.id || 'new-event'} ... />`), eliminating `useEffect` state syncing and satisfying React compiler rules without cascading renders.
    - Address search integration via `client/src/components/AddressSearch.jsx` (fills coordinates and fills location address display only if empty, never overwriting typed text).
    - Collapsible manual coordinates fallback (`lat`, `lng`).
    - Optional attendee limit input (`maxAttendees`, 1 to 1000).
    - In edit mode: computes differential patch via `buildEventPatch`; disables "Save Changes" button when nothing has changed; submits `PATCH /api/events/:id`.
    - Capacity error handling: displays 409 Conflict error from backend when trying to lower attendee limit below current attendees count.
    - Cancellation sub-dialog: confirmation modal (*"Cancel this event? Attendees will see it as cancelled. This cannot be undone."*) submitting `POST /api/events/:id/cancel`.
  - Ported Events Page (`client/src/pages/EventsPage.jsx`):
    - Header with "Local Skill Meetups & Events" title and "Host New Meetup Event" button (prompts unauthenticated users to log in).
    - Toggle between Cards grid and Map view; filter tabs between "Upcoming Meetups" and "My Events".
    - Event cards with host avatar/name linking to `/profile/:id`, formatted date/time, location address, distance indicator (`· X.X km away`), going count / capacity indicator (`3 / 10 going`), and status badges.
    - P3.5 Host controls: "Edit" button opens edit modal with cancel option; cancelled events greyed out (`opacity-70`) with "Cancelled" badge and no RSVP button.
    - RSVP toggle: calls `POST /api/events/:id/rsvp` with loading spinner, refreshes list on success or 409 conflict, and displays inline error messages.
    - Pagination support: renders "Load more" button when `pagination.hasNextPage` is true.
  - Route Configuration (`client/src/App.jsx`):
    - Replaced the final `<PlaceholderPage title="Local Events" />` with `<EventsPage />`.
    - Zero placeholders remain in the entire application! Every single route is a real ported page.
  - Client Unit Tests:
    - Authored 47 new unit tests across 4 test suites:
      - `events.test.js` (21 tests): datetime round trips near midnight, differential patch builder, canRsvp matrix, event status labels, datetime formatting.
      - `MapView.test.jsx` (6 tests): map initialization, tile layer attribution, coordinate validation, marker updates without map recreation, unmount cleanup, plain-text XSS neutralization test.
      - `EventDialog.test.jsx` (10 tests): create mode rendering, client validation, address search integration, location preservation, edit mode prefill, differential patch submission, 409 capacity conflict handling, cancel confirmation flow, cancel rejection handling.
      - `EventsPage.test.jsx` (10 tests): loading state, event cards rendering, capacity indicator, Full badge & disabled button, Cancelled badge & disabled RSVP, host Edit controls, RSVP toggle OFF on full events, 409 conflict reload, view mode toggle, load more pagination, empty state.
    - Total client unit tests: **103 passed across 15 test suites** (100%).
  - Real-Server Integration Verification (`client/scripts/m4b-check.mjs`):
    - Authored automated check script running through Vite proxy on port 5173.
    - Verified 31 assertions: SPA routing fallback, unauthenticated GET `/api/events`, login with Origin header, response shape containing all 18 keys (including `maxAttendees`, `cancelled`, `isFull`, `goingCount`, `distanceKm`), 403 non-host edit/cancel rejections, 400 validation rejections (empty patch, maxAttendees 0, maxAttendees 1001, invalid latitude), 404 unknown UUID rejections, and zero database mutations (before: 5 events, 8 attendees; after: 5 events, 8 attendees).
  - Quality Gates & Zero-Leakage Verification:
    - Client ESLint: `npm --prefix client run lint` -> 0 errors, 0 warnings.
    - Client Vitest: `npm --prefix client test` -> 103 passed across 15 test files.
    - Client Build: `npm --prefix client run build` -> exit 0 (HTML: 0.64 kB, CSS: 57.31 kB, JS: 650.60 kB).
    - Express Server: `npm --prefix server run lint` -> 0 errors, 0 warnings; `npm --prefix server test` -> 163 passed across 14 test files.
    - Real-Server Checks: `client/scripts/smoke-check.mjs` (21 passed), `client/scripts/m4a-check.mjs` (31 passed), `client/scripts/m4b-check.mjs` (31 passed), `server/scripts/p35-check.mjs` (19 passed), 8 root server check scripts (161 passed), `server/scripts/foundation-check.mjs` (57 passed). Total assertions passed: 320.
    - Legacy Next.js app: `npm run lint` -> 0 errors, 0 warnings; `npx vitest run src/lib` -> 121 passed (8 suites); `npm run build` -> exit 0 (20 Next.js routes compiled).
    - Zero Database Mutations: `prisma/dev.db` row counts strictly verified at 81 across all 9 tables.
    - Strangler Fig Integrity: Zero modifications to `src/`, `server/`, `scripts/`, `prisma/`, or root configs.
  - Ticked M4b; logged decision in `docs/DECISIONS.md`; added K39 and K40; advanced Next task to M5.

- 2026-11-06 (Task M4a: Port Chat, Reviews, and Profile Setup Pages to React Client):
  - Pre-task database backup created: `D:\dev.db.backup16` (167,936 bytes, 81 rows) before touching any code.
  - Authored execution plan: `docs/plans/M4a-chat-reviews-setup.md` covering component layout, data flow contracts, polling and concurrency architecture, avatar race prevention, test plan, and quality gates.
  - Extracted reusable geocoding component `client/src/components/AddressSearch.jsx`:
    - Free-text input with search button and Enter key trigger, disabled when trimmed query is <3 characters.
    - Asynchronous geocoding requests via `GET /api/geocode?q=...` with request counter (`searchRequestIdRef`) to ignore stale out-of-order responses.
    - Displays up to 5 location results and calls `onSelect` with coordinates rounded to 6 decimal places.
    - Selected location confirmation banner with optional `onClear` remove action.
    - OpenStreetMap attribution link: `https://www.openstreetmap.org/copyright`.
  - Ported Chat Page (`/chat` -> `client/src/pages/ChatPage.jsx`):
    - Two-panel layout: left sidebar for conversation list with search input filtering by peer name or matched skill, right panel for active message thread stream.
    - Preselects active conversation from URL query parameter `?matchId=...`.
    - Resilient 3-second polling mechanism:
      - Per-match in-flight guard (`inFlightMatchIdRef`) avoids duplicate concurrent fetches while allowing immediate fetching when switching conversations.
      - Tab visibility management: listens to `document.visibilitychange`, pauses timer when document is hidden, and triggers an immediate sync and resumes timer when document becomes visible.
      - Active match switch guard (`activeMatchIdRef`): discards asynchronous message responses if the user switched conversations before the response arrived.
      - Scrollback preservation: checks `isNearBottom` threshold (`scrollHeight - scrollTop - clientHeight < 80`) before auto-scrolling on background polling ticks, preventing unexpected view yanking while reading history. Always scrolls to bottom on user send or match switch.
      - Message submission: trims whitespace, disables button and displays spinner while sending, clears input on success, and preserves user input text with an inline error banner on failure (e.g. 429 rate limit).
      - Header actions: links to peer public profile (`/profile/:id`) and session rating (`/reviews?toUserId=:id&name=:name`).
  - Ported Reviews Page (`/reviews` -> `client/src/pages/ReviewsPage.jsx`):
    - Reads `toUserId` (or fallback `peerId`) and `name` from query parameters; renders friendly guide card prompting user to select a peer from dashboard if omitted.
    - Loads peer user profile (`GET /api/users/:id`) and existing reviews history (`GET /api/reviews?toUserId=:id`).
    - Interactive 5-star rating selector with hover preview and click states.
    - Duplicate review guard: if `viewer.hasReviewed === true` or API returns `409 Conflict`, replaces submission form with notice: *"You have already reviewed this person."*, while retaining full community review history.
    - Handles 400 validation errors, 403 authorization rejections, and 429 rate limit errors with inline alert banners.
    - Supports review pagination with a "Load more reviews" action button when `pagination.hasNextPage` is true.
  - Ported Profile Setup Page (`/profile/setup` -> `client/src/pages/ProfileSetupPage.jsx`):
    - Loads existing user profile (`GET /api/user/profile`) and available skills suggestions (`GET /api/skills`).
    - Basic Information inputs: location string, bio textarea (max 500 chars).
    - My Location: integrated `AddressSearch` component to search and store `latitude` and `longitude` coordinates with whole-km privacy notice.
    - Skills I Can Teach: tag inputs with 4 proficiency levels (`Beginner`, `Intermediate`, `Advanced`, `Expert`), quick suggestion pills, and badge removal actions.
    - Skills I Want to Learn: tag inputs, quick suggestion pills, and badge removal actions.
    - Avatar Management & Race Prevention:
      - Image file input with client-side type (JPG, PNG, WebP) and size (<2 MB) validation.
      - Multipart upload via `POST /api/user/avatar`: receives new `avatarUrl`, immediately updates page state, and immediately calls `AuthContext.refresh()`.
      - Prevents race conditions: subsequent "Save & Find Matches" (`PUT /api/user/profile`) sends the newly uploaded `avatarUrl`, preventing stale state overwrites.
      - Remove avatar action calling `DELETE /api/user/avatar`, clearing preview and refreshing session.
  - Route Configuration (`client/src/App.jsx`):
    - Replaced placeholder cards for `/chat`, `/reviews`, and `/profile/setup` with real protected routes.
    - `/events` remains the only placeholder card until Task M4b.
  - Client Unit Tests & Automated Check Script:
    - Authored 29 new client unit tests across 4 test suites:
      - `AddressSearch.test.jsx` (7 tests): query length validation, Enter key / button search, 6-decimal rounding, stale response cancellation, error banners, attribution link, clear action.
      - `ChatPage.test.jsx` (8 tests): conversation search filtering, query param preselection, 3s polling with fake timers, tab visibility pause/resume, stale conversation response discard, message sending, 429 rate limit preservation, peer profile & review action links.
      - `ReviewsPage.test.jsx` (7 tests): missing param prompt, peer profile & review history loading, 5-star selector, already-reviewed card, review submission success, 409 conflict handling, pagination loading.
      - `ProfileSetupPage.test.jsx` (7 tests): pre-population, teach/learn skill management, quick suggestions, location search/removal, client file validation, avatar upload race condition test, avatar removal.
    - Total client unit tests: **56 passed across 11 test suites** (100%).
    - Authored automated check script `client/scripts/m4a-check.mjs`: verified 31 assertions against port 5173 through Vite proxy (SPA fallbacks, Alex login, conversations list, match messages, unowned match 404, empty message 400, reviews list, self-review 400, duplicate review 409, profile data without passwordHash, geocode <3 chars 400, avatar traversal 400, fake upload 400, and 81 DB rows). 31 passed, 0 failed.
  - Quality Gates & Zero-Leakage Verification:
    - Client ESLint: `npm --prefix client run lint` -> 0 errors, 0 warnings.
    - Client Vitest: `npm --prefix client test` -> 56 passed across 11 test files.
    - Client Build: `npm --prefix client run build` -> exit 0 (HTML: 0.64 kB, CSS: 40.31 kB, JS: 463.51 kB).
    - Express Server: `npm --prefix server run lint` -> 0 errors, 0 warnings; `npm --prefix server test` -> 163 passed across 14 test files.
    - Foundation checks on port 4000: `node server/scripts/foundation-check.mjs` -> 57 passed, 0 failed.
    - Legacy Next.js app: `npm run lint` -> 0 errors, 0 warnings; `npx vitest run src/lib` -> 121 passed (8 suites); `npm run build` -> exit 0 (20 Next.js routes compiled).
    - Zero Database Mutations: `prisma/dev.db` row counts strictly verified at 81 across all 9 tables.
    - Strangler Fig Integrity: Zero modifications to `src/`, `server/`, `scripts/`, `prisma/`, or root configs.
  - Ticked M4a; logged decision in `docs/DECISIONS.md`; added K38; advanced Next task to M4b.
  - Pre-task database backup created: `D:\dev.db.backup15` (167,936 bytes, 81 rows) before touching any code.
  - Authored execution plan: `docs/plans/M3-react-client.md` covering directory structure, allowed dependencies, Vite dev proxy, AuthContext architecture, route table, component ports, and test verification.
  - Scaffolding `client/` (plain JavaScript ESM & JSX):
    - Created `client/package.json` (`"type": "module"`) with only approved dependencies: `react`, `react-dom` (19.2.8), `react-router-dom` (7.1.5), `@radix-ui` primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`, `tailwindcss` (v4), `@tailwindcss/vite`, `vite` (v6), `@vitejs/plugin-react`, `eslint`, `vitest`, `jsdom`, `@testing-library/react`. 0 vulnerabilities.
    - Configured `client/vite.config.js`: React plugin, Tailwind v4 plugin, path alias `@/*` -> `./src/*`, dev server on port 5173 with `strictPort: true`, dev proxy forwarding `/api` to Express on `http://localhost:4000` with `changeOrigin: false` (preserving original browser `Origin: http://localhost:5173` for CSRF verification).
    - Configured `client/index.html` with root container, favicon, and system font styling.
    - Configured `client/jsconfig.json` with `@/*` mapping to `./src/*`.
    - Configured `client/eslint.config.mjs` with React hooks rules; `npm --prefix client run lint` -> 0 errors, 0 warnings.
    - Configured `client/vitest.config.js` with jsdom environment and setup file.
    - Configured `client/src/index.css` with Tailwind v4 `@theme inline` system font stack and theme variables.
    - Ported shadcn UI components into `client/src/components/ui/` in plain JSX (avatar, badge, button, card, dialog, input, scroll-area, select, table, tabs, textarea).
  - API & Auth State Management:
    - Implemented `client/src/lib/api.js`: `ApiError` class and `apiFetch()` helper with standard `same-origin` credentials, JSON parsing, 204 support, 429 `Retry-After` extraction, and friendly network disconnection errors.
    - Implemented `client/src/context/AuthContext.jsx`: Session provider synchronizing with `GET /api/auth/session`, `login()`, `register()`, `logout()`, `refresh()`, and `useAuth()` custom hook.
    - Implemented `client/src/components/ProtectedRoute.jsx`: Session guard with loading spinner and redirect to `/auth` with intended location saved.
  - Navigation & Layout:
    - Implemented `client/src/components/Navbar.jsx`: React Router `NavLink`/`Link`, auth-aware user avatar, mobile messages shortcut, login/logout actions.
    - Implemented `client/src/components/Layout.jsx`: Application shell with Navbar, `<Outlet />`, and footer.
    - Implemented `client/src/pages/PlaceholderPage.jsx`: Reusable migration placeholder card for `/events`, `/chat`, `/reviews`, `/profile/setup` with link back to Find Matches.
    - Implemented `client/src/pages/NotFoundPage.jsx`: 404 page with return to dashboard.
    - Configured routes in `client/src/App.jsx` and mounted via `client/src/main.jsx`.
  - Core Ported Pages:
    - Landing (`/` -> `HomePage.jsx`): Hero, value propositions, feature highlights, and cards.
    - Auth (`/auth` -> `AuthPage.jsx`): Login/Signup tabs, `?tab=signup` query support, "Fill Demo Credentials" quick-fill button (`alex@example.com` / `password123`), server error banner, rate limit message handling (429), auto-login after register, disabled Google OAuth button with "Coming Soon" badge.
    - Dashboard (`/dashboard` -> `DashboardPage.jsx`): Fetches `/api/matches`, All/Mutual/Connected filter tabs with counts, search input, match cards with avatar linking to `/profile/:id`, location, rounded distance (`formatDistance`), "New" badge for 0 reviews, star rating, Can Teach and Wants to Learn tags, swap line, "Connect Swap" action, and "Set your location to see distances" notice linking to `/profile/setup`.
    - Public Profile (`/profile/:id` -> `ProfileDetailPage.jsx`): Reads `:id` from `useParams()`, fetches `/api/users/:id`, viewer action controls (`isSelf` -> Edit Profile; `NONE` -> Connect; `PENDING` -> Request Pending; `ACCEPTED` -> Message + Rate & Review; `DECLINED` -> note), 404 profile not found state, loading skeleton, and error retry state.
  - Automated Check Script & Client Unit Tests:
    - Authored 27 client unit tests across 7 test files in `client/src/test/` (`api.test.js` (6), `AuthContext.test.jsx` (4), `ProtectedRoute.test.jsx` (3), `Navbar.test.jsx` (2), `ProfileDetailPage.test.jsx` (4), `DashboardPage.test.jsx` (3), `AuthPage.test.jsx` (5)). 27 passed (100%).
    - Authored automated client smoke check `client/scripts/smoke-check.mjs`: Ran against Vite dev server on port 5173 with Express on port 4000. Verified HTML shell, SPA fallback, proxy `/api/health`, session when unauthenticated, login setting cookie, authenticated session, authenticated `/api/matches`, logout cookie clearing, and CSRF 403 rejection on untrusted Origin. 21 passed, 0 failed (0 DB mutations).
  - Quality Gates & Zero-Leakage Verification:
    - Client ESLint: `npm --prefix client run lint` -> 0 errors, 0 warnings.
    - Client Vitest: `npm --prefix client test` -> 27 passed across 7 test files.
    - Client Build: `npm --prefix client run build` -> exit 0 (HTML: 0.63 kB, CSS: 35.28 kB, JS: 354.29 kB).
    - Express Server: `npm --prefix server run lint` -> 0 errors, 0 warnings; `npm --prefix server test` -> 163 passed across 14 test files.
    - Foundation checks on port 4000: `node server/scripts/foundation-check.mjs` -> 57 passed, 0 failed.
    - Legacy Next.js app: `npm run lint` -> 0 errors, 0 warnings; `npx vitest run src/lib` -> 121 passed (8 suites); `npm run build` -> exit 0 (20 Next.js routes compiled).
    - Zero Database Mutations: `prisma/dev.db` row counts strictly verified at 81 across all 9 tables.
    - Strangler Fig Integrity: Zero modifications to `src/`, `server/`, `scripts/`, `prisma/`, or root configs.
  - Ticked M3; added K35, K36, K37; advanced Next task to M4a.

- 2026-11-06 (Task M2: Port All Remaining APIs to Express & Native P3.5 Events Feature):
  - Pre-task backups: Created database backup `D:\dev.db.backup14` (167,936 bytes, 81 rows) before changes.
  - Editor TS error check (Part A): Searched entire repository excluding node_modules, .next, .git for any .ts/.tsx/.d.ts files via `Get-ChildItem -Path . -Recurse -Include *.ts,*.tsx,*.d.ts`. Found 0 files. Confirmed `src/lib/api-auth.ts` does not exist on disk; `src/lib/api-auth.js` exists and is the active module. Confirmed `jsconfig.json` correctly maps `"@/*"` to `"./src/*"`. Determined editor errors were caused by stale IDE editor tabs.
  - Approved schema change: Added `maxAttendees Int?` (optional capacity limit) and `cancelledAt DateTime?` (optional cancellation timestamp) to `model Event` in `prisma/schema.prisma`. Applied safely via `npx prisma db push` with 0 warnings and 0 data loss. Generated updated client and copied to `server/node_modules/.prisma/client`. Database row count verified at strictly 81 rows across all 9 tables.
  - Allowed dependency: Added strictly `sharp` to `server/package.json` for avatar image re-encoding (0 vulnerabilities). Zero other dependencies added (no multer; native Node 24 `Request.prototype.formData()` used for multipart uploads).
  - Authored execution plan: Created `docs/plans/M2-remaining-apis-and-p35.md` covering all route specifications, P3.5 contracts, test plans, and verification gates.
  - Pure event rules module: Implemented `server/src/lib/event-rules.js` with zero DB dependencies (`canEditEvent`, `canCancelEvent`, `validateCapacityChange`, `computeIsFull`, `shouldShowCancelled`). Tested via 21 unit tests in `server/test/event-rules.test.js`.
  - Ported all remaining API routes into `server/src/routes/`:
    - `matches.js`: `GET /api/matches` (session guard, pagination, Haversine whole-km rounding, zero coordinate leaks, `currentUser.hasLocation`), `POST /api/matches` (20/hr rate limit, self-connect block 400, target 404, bidirectional duplicate 200, create PENDING 201), `PATCH /api/matches/:id` (60/hr limit, participant check 403, recipient-only accept/decline guard 403).
    - `conversations.js`: `GET /api/conversations` (session guard, pagination, participant matches with latest message snippet).
    - `messages.js`: `GET /api/messages` (session guard, cursor pagination clamped to 200, chronological asc order, participant check 403/404), `POST /api/messages` (30/min limit, 1..5000 chars, participant check 403/404).
    - `reviews.js`: `GET /api/reviews` (public, toUserId required, pagination, average rating), `POST /api/reviews` (10/hr limit, self-review 400, missing recipient 404, accepted match requirement 403, duplicate 409, transactional insert with P2002 error handling).
    - `events.js`: `GET /api/events` (optional session, pagination, distance 0.1km, additive P3.5 fields `maxAttendees`, `cancelled`, `isFull`, `goingCount`, cancelled event filtering), `POST /api/events` (10/hr limit, createEventSchema, host set as GOING), `PATCH /api/events/:id` (30/hr limit, host-only check 403, cancelled event check 409, capacity decrease check against goingCount 409), `POST /api/events/:id/cancel` (10/hr limit, host-only check 403, already cancelled check 409, sets `cancelledAt: new Date()`, preserves attendee rows), `POST /api/events/:id/rsvp` (60/hr limit, cancelled check 409, toggle OFF always allowed, join GOING capacity checked in `$transaction` -> 409 "This event is full.").
    - `geocode.js`: `GET /api/geocode` (session guard, 20/min limit, 3..200 chars, Nominatim proxy with custom User-Agent, 1 req/sec throttle, 24h memory cache, X-Cache: HIT/MISS).
    - `avatar.js`: `POST /api/user/avatar` (10/hr limit, native Node 24 formData, early 2.5MB check 413, 2MB size cap 413, magic bytes check via detectImageType, Sharp WebP 512x512 processing, atomic write to `<project>/storage/avatars/`, DB update, compensation delete on failure, delete old user avatar), `DELETE /api/user/avatar` (30/hr limit, nullify avatarUrl, delete file), `GET /api/avatars/:file` (session guard, strict filename regex, directory traversal block 400, private immutable cache headers).
  - Automated check scripts & tests:
    - `server/scripts/p35-check.mjs`: 19 rejection/denial assertions on port 4000 (0 DB mutations) — 19 passed, 0 failed.
    - Ported all 8 check scripts to `server/scripts/` running against port 4000: `security-check.mjs` (20), `validation-check.mjs` (28), `pagination-check.mjs` (47), `review-check.mjs` (5), `profile-check.mjs` (13), `geocode-check.mjs` (12), `distance-check.mjs` (22), `avatar-check.mjs` (14). Total: 161 passed, 0 failed.
    - `server/scripts/p35-write-check.mjs` & `server/test/p35-write.test.js`: Full write-path integration test on temporary database copy (`test.db`, port 4100). Verified event creation, edit, capacity reach (409), slot freeing, capacity lowering block (409), cancellation, second cancellation block (409), edit/rsvp blocked on cancelled event (409), cancelled event visibility rules, connect -> accept -> message -> review -> duplicate 409, avatar upload, webp serving, and deletion. 44 passed, 0 failed. Dev.db verified strictly untouched at 81 rows.
    - `server/scripts/parity-check.mjs`: Extended to compare legacy Next.js app (port 3001) and Express server (port 4000) across matches, events, conversations, reviews, messages, and error responses. 36 passed, 0 failed (100% parity).
  - Quality gates:
    - Legacy root Next.js: `npm run lint` -> 0 errors, `npx vitest run src/lib` -> 121 passed (8 suites), `npm run build` -> exit 0 (20 routes compiled).
    - Express server: `npm --prefix server run lint` -> 0 errors, `npm --prefix server test` -> 163 passed (14 suites).
    - Database row counts: strictly 81 across all 9 tables.
  - Ticked M2 and P3.5; set Next task to M3.

- 2026-11-06 (Task M1: Migration Plan and Express Server Foundation):
  - Pre-task backups: Copied full project to `D:\skillswap-before-migration` (excluding node_modules and .next) and database to `D:\dev.db.backup13` (167,936 bytes, 81 rows) before touching any code.
  - Authored comprehensive architecture migration plan in `docs/plans/MIGRATION-react-express.md` (folder layout, strangler fig pattern, route and page mapping tables, next/* replacements, dev proxy and prod serving, stage list M1–M5, rollback plan, post-migration roadmap, adapted test strategy) and detailed execution plan `docs/plans/M1-server-foundation.md`.
  - Strangler fig boundary respected: Legacy Next.js app under `src/`, `prisma/`, and `scripts/` left 100% untouched and continuously active on port 3001. All new backend code isolated in `server/`.
  - Created standalone Express server in `server/` with `"type": "module"` (ESM) and strictly allowed dependencies (`express`, `cookie-parser`, `jsonwebtoken`, `bcryptjs`, `zod`, `@prisma/client`, `helmet`, and devDependencies `prisma`, `vitest`, `eslint`, `@eslint/js`, `globals`). Zero TypeScript, zero build steps.
  - Server configuration (`server/src/config/env.js`): Startup Zod validation for `PORT`, `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ALLOWED_ORIGINS`, `TRUST_PROXY`, `RATE_LIMIT_DISABLED`, `NOMINATIM_USER_AGENT`, `AVATAR_STORAGE_DIR`. In production, startup fails if `JWT_SECRET` is missing, <32 chars, or a placeholder. In dev/test, warns loudly and falls back safely. Verified SQLite path resolves to existing `prisma/dev.db` (167,936 bytes).
  - Prisma Singleton (`server/src/db/prisma.js`): Singleton client on `globalThis` connected to `prisma/dev.db` via root schema. Zero schema changes, zero database resets.
  - Express App Factory (`server/src/app.js`): Modular pipeline with Helmet (JSON API headers), 100kb body limit, cookie-parser, safe request logger (no secrets/bodies/cookies logged), CSRF Origin validator, route mounts, JSON 404 handler, and central error handler (500 generic with internal server logging, 400 for malformed/oversized JSON).
  - Auth Engine (`server/src/lib/auth.js` & `server/src/middleware/auth.js`): Signed HS256 JWT in HttpOnly SameSite=Lax cookie (`skillswap_session`, 7-day maxAge). Verified with algorithm pinned to HS256. User details loaded fresh from database per request. Timing attack mitigation via dummy bcrypt compare when user is not found. `requireSession` middleware enforces standard 401 `{ "error": "Unauthorized" }`.
  - CSRF Middleware (`server/src/middleware/csrf.js`): Origin validation for state-changing requests (POST, PUT, PATCH, DELETE) enforcing `ALLOWED_ORIGINS` (403 `{ "error": "Invalid origin" }` for foreign origins).
  - Ported framework-free modules from `src/lib/` to `server/src/lib/`: `matching.js`, `geo.js`, `geocode.js`, `profile-view.js`, `rate-limit.js`, `pagination.js` (adapted for Express/standard Response), all 10 Zod validator schemas in `server/src/lib/validators/`, plus Express-adapted `api-error.js` and `api-auth.js`.
  - Implemented M1 Express Routes:
    - `GET /api/health`: Returns `{ status: "ok" }`.
    - `POST /api/auth/register`: 5/hr/IP limit, input validation, bcrypt hash, creates user, auto-sets cookie, returns 201 `{ user }`.
    - `POST /api/auth/login`: 50/15m/IP and 10/15m/IP+email limits, timing attack protected, returns 200 `{ user }` with HttpOnly Lax cookie.
    - `POST /api/auth/logout`: Clears cookie, returns 200 `{ message: "Logged out successfully" }`.
    - `GET /api/auth/session`: Reads cookie, returns `{ user: { id, name, email, image } }` or `{ user: null }` (200).
    - `GET & PUT /api/user/profile`: `requireSession`, `SAFE_PROFILE_SELECT` (no passwordHash), 30/hr limit on PUT, caller avatar ownership check, full relation updates.
    - `GET /api/users/:id`: `requireSession`, privacy projection (no email, passwordHash, coords), rating summary, viewer state, paginated reviews.
    - `GET & POST /api/skills`: Full skills list (with auto-seed if empty), 20/hr limit on POST, Zod validated upsert.
  - Quality gates & verification:
    - Server ESLint: 0 errors, 0 warnings.
    - Server Vitest: 12 test files, 141 tests passed (121 ported tests + 20 foundation tests: JWT sign/verify, expiry, tampering, secret mismatch, none-algo rejection, cookie options, CSRF origin checks, env validation, error handler mapping).
    - Foundation check (`server/scripts/foundation-check.mjs`): 57 assertions passed against port 4000 (0 database records created). Login rate limit resets in 900 seconds (15 minutes).
    - Parity check (`server/scripts/parity-check.mjs`): 14 assertions passed with 100% byte-for-byte JSON payload equality between old Next.js app (port 3001) and Express server (port 4000) across Alex & Rimi profiles, Priya & Alex public profiles, skills list, 404 unknown user, and 400 invalid category. 0 transient fields ignored.
    - Legacy root gates verified: `npm run lint` -> 0 errors, 0 warnings; `npm test` -> 121 tests passed (8 suites); `npm run build` -> exit 0 (20 Next.js routes compiled); all 8 legacy check scripts passed (161 assertions total).
    - Database row counts: Exactly 81 rows before and after across all 9 tables (0 data mutations).
  - Ticked M1; logged decision in `docs/DECISIONS.md`; added K31–K34; advanced Next task to M2.

- 2026-11-06 (Task C1: Complete Mechanical Conversion from TypeScript to Plain JavaScript JSX):
  - Made full project backup to `D:\skillswap-ts-backup` (excluding node_modules and .next) and database backup to `D:\dev.db.backup12` (167,936 bytes, 81 rows) before touching any code.
  - Authored comprehensive plan in `docs/plans/C1-convert-to-javascript.md` with complete file inventory, conversion order, risks, and stage-by-stage verification checklist.
  - Stage 0 Baseline: recorded 76 TS/TSX files (51 .ts, 25 .tsx), 16 .mjs, 121 tests passing (8 suites), 20 routes compiled, 81 database rows, captured 12 snapshot files (`baseline-c1-*.json`), and verified all 8 existing check scripts passing (161 checks total).
  - Stage 2 Config: Created `jsconfig.json` with `@/*` pointing to `./src/*`, converted `next.config.ts` to `next.config.mjs`, converted `vitest.config.ts` to `vitest.config.js`, updated `eslint.config.mjs` to lint `.js`/`.jsx` files with core Web Vitals (removing TypeScript-only rules), and set `prisma.seed` in `package.json` to `node prisma/seed.js`.
  - Stage 3 Logic & Vitest Tests: Converted all 10 validator files in `src/lib/validators/*.js`, all 13 pure logic files in `src/lib/*.js`, and all 8 Vitest test suites in `src/lib/*.test.js`. Removed `src/types/` folder and `next-auth.d.ts`. Verified `npm test` passed 121 tests across 8 suites.
  - Stage 4 API Routes: Converted all 15 API routes in `src/app/api/**/route.js` to plain JavaScript, preserving all export names, route handlers, error responses, and rate limiters. Verified against running dev server: all 8 check suites (161 assertions) passed.
  - Stage 5 Components, Pages & Layouts: Converted all 11 UI components in `src/components/ui/*.jsx`, `AuthProvider.jsx`, `AddressSearch.jsx`, `CreateEventDialog.jsx`, `MapView.jsx`, `Navbar.jsx`, and all 9 Next.js pages/layouts (`src/app/layout.jsx`, `page.jsx`, `auth/page.jsx`, `chat/page.jsx`, `dashboard/page.jsx`, `events/page.jsx`, `profile/setup/page.jsx`, `profile/[id]/page.jsx`, `reviews/page.jsx`). Preserved all hooks, polling, dynamic Leaflet imports, and form state. Verified: `npm run lint` -> 0 errors, 0 warnings; `npm test` -> 121 passed; `npm run build` -> exit 0 (20 routes); all 8 check suites passed (161 checks); snapshot comparison for Alex & Rimi (`stage5-c1-*.json` vs `baseline-c1-*.json`) 100% identical.
  - Stage 6 Seed & Clean-up: Converted `prisma/seed.ts` to `prisma/seed.js` using native Node CommonJS (`require("@prisma/client")` and `require("bcryptjs")`). Tested seed execution safely on a copy of the database (`prisma/test-seed.db`), keeping `prisma/dev.db` untouched. Deleted leftover `tsconfig.json`, `next-env.d.ts`, and `tsconfig.tsbuildinfo`. Removed `typescript`, `@types/bcryptjs`, `@types/node`, `@types/react`, `@types/react-dom`, and `@types/leaflet` from dependencies/devDependencies and updated lockfile via `npm install`. Confirmed 0 `.ts` or `.tsx` files remain in repository.
  - Stage 7 Final Verification:
    - `npm run lint` -> 0 errors, 0 warnings.
    - `npm test` -> 8 passed (8), 121 passed (121).
    - `npm run build` -> exit 0 (all 20 routes compiled).
    - Dev server check scripts (port 3001): security (20), validation (28), pagination (47), review (5), profile (13), geocode (12), distance (22), avatar (14) -> all 161 passed, 0 failed.
    - Final snapshot comparison (`baseline-c1` vs `final-c1`) -> 12 files 100% identical.
    - Database row counts -> 81 rows before and after (identical).
  - Ticked C1; updated tech stack and quality gates; added K30; Next task remains P3.5.

- 2026-10-24 (Phase 3: P3.4 Avatar Upload & Security Hardening):
  - Created plan `docs/plans/P3.4-avatar-upload.md` covering security checklist (magic byte sniffing, EXIF stripping, size caps, decompression bomb protection, path traversal rejection, caller ownership enforcement), swappable storage interface, and race condition prevention.
  - Backed up database `prisma/dev.db` to `D:\dev.db.backup11` (167,936 bytes). Confirmed 5 users have coordinates; table row count 81 total.
  - Installed `sharp` (v0.34.5); added `storage/` to `.gitignore`; documented `AVATAR_STORAGE_DIR="./storage/avatars"` in `.env.example`.
  - Created storage abstraction in `src/lib/avatar-storage.ts` (`AvatarStorage` interface, `LocalDiskAvatarStorage` class writing outside `public/`, singleton `avatarStorage`).
  - Created pure image processing & validation library `src/lib/avatar.ts`:
    - `detectImageType(buffer)`: inspects real magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF....WEBP`); rejects SVG, GIF, HTML, PDF, and fake renamed files.
    - `processAvatar(buffer)`: sharp pipeline with `failOn: "error"`, `limitInputPixels: 25000000` (25 MP decompression bomb cap), `.rotate()` (auto-orient by EXIF), `.resize(512, 512, { fit: "cover", position: "centre" })`, `.webp({ quality: 80 })`, stripping all EXIF and GPS metadata.
    - `buildAvatarFileName(userId, randomHex?)`: deterministic `<userId>-<16 lowercase hex chars>.webp`.
    - `isValidAvatarFileName(name)`: strict regex validation blocking traversal (`..`, `/`, `\`), non-WebP extensions, or malformed IDs.
    - `isValidAvatarUrl(url, callerUserId?)`: validates profile update avatar URLs (empty, external http(s), or own `/api/avatars/<file>` path).
  - Added 21 Vitest unit tests in `src/lib/avatar.test.ts` verifying magic bytes, sharp WebP conversion, 512x512 cropping, EXIF/GPS metadata stripping, corrupt buffer handling, decomp bomb limits, path traversal rejections, and caller URL ownership. Total tests: **121 passed (8 suites)**.
  - Implemented routes:
    - `POST /api/user/avatar`: `requireSession` (401), rate limit 10/hr (429), early Content-Length > 2.5 MB check (413), 2 MB payload size check (413), magic bytes check (400), sharp processing (400 on corrupt), safe unique filename generation, atomic storage save and DB update with compensation delete on DB error, cleanup of previous stored avatar, returns `{ avatarUrl }`.
    - `DELETE /api/user/avatar`: `requireSession` (401), rate limit 30/hr (429), sets user `avatarUrl: null`, deletes stored avatar file if owned by user, returns `{ avatarUrl: null }`.
    - `GET /api/avatars/[file]`: `requireSession` (401), strict regex validation before disk access (400 on invalid or traversal), 404 if missing, returns WebP with `X-Content-Type-Options: nosniff` and `Cache-Control: private, max-age=31536000, immutable`.
  - Updated validator `src/lib/validators/profile.ts`: `avatarUrl` in `updateProfileSchema` allows valid `/api/avatars/<file>` paths in addition to http(s) URLs and empty strings.
  - Updated `src/app/api/user/profile/route.ts`: enforced caller avatar ownership (400 if user tries to claim another user's avatar path).
  - Updated `src/app/profile/setup/page.tsx`:
    - Added avatar preview with initial fallback, hidden file input, "Upload photo" button with loading spinner, and "Remove photo" button.
    - Added user guidance: `"JPG, PNG or WebP, up to 2 MB. Your photo is resized and stripped of hidden data."`
    - Client-side size (< 2 MB) and MIME type checks before upload.
    - Secondary external link input for pasted URLs.
    - Fixed race condition: immediately updates component's `avatarUrl` state on upload / remove success so subsequent "Save Profile" submits the new photo instead of overwriting with stale state.
  - Created automated test script `scripts/avatar-check.mjs`: verified 14 rejection and read-only checks (401 unauth guards, 400 path traversals, 404 not found, 400 fake image, 400 SVG rejection, 413 oversize payload, 400 profile ownership & traversal rejections). Zero records or files created.
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm test` -> 121 passed (8 suites); `npm run build` -> exit 0 (all 20 routes compiled, including new `/api/avatars/[file]` and `/api/user/avatar`); dev server check scripts: security-check (20), validation-check (28), pagination-check (47), review-check (5), profile-check (13), geocode-check (12), distance-check (22), avatar-check (14) all passed.
  - Database row counts verified identical before and after (81 rows). Storage folder verified clean/absent.
  - Ticked P3.4; marked K7 resolved; added K28 and K29; advanced Next task to P3.5.

- 2026-10-23 (Phase 3: P3.3 Distance (Haversine) on Match & Event Cards, User Profile Location & Privacy Guarantees):
  - Created plan `docs/plans/P3.3-distance.md` covering Haversine formula (`R = 6371 km`), privacy guarantees (zero coordinate leaks for peers), whole-km rounding for peers (<1 km -> 0), 0.1 km rounding for public events, user location management on `/profile/setup`, `AddressSearch` extraction, unit tests, and check script.
  - Backed up database `prisma/dev.db` to `D:\dev.db.backup10` (167,936 bytes). Confirmed 0 users had coordinates; user authorized adding nullable `latitude Float?` and `longitude Float?` to `model User` in `prisma/schema.prisma` and applied via `npx prisma db push` and `npx prisma generate`. Zero data loss, all 81 rows preserved.
  - Implemented pure geospatial calculation module `src/lib/geo.ts`:
    - `EARTH_RADIUS_KM = 6371`.
    - `isValidCoordinate(lat, lon)`: finite range validation (-90..90, -180..180). (0, 0) treated as mathematically valid GPS.
    - `haversineKm(lat1, lon1, lat2, lon2)`: computes great-circle distance between two GPS points using spherical trigonometry.
    - `roundKm(distance, step)`: supports nullable distances; rounds to whole km (step=1) or decimal tenths (step=0.1).
    - `formatDistance(km)`: formats into user-facing text (`"Less than 1 km away"`, `"3 km away"`, `"2.3 km away"`).
  - Added 14 unit tests in `src/lib/geo.test.ts` (0 distance, Bengaluru Cubbon Park to Mumbai Bandra West ~842 km, symmetry, antipodal points, invalid inputs returning null, rounding thresholds at 0.49/0.5/1.4 km, and formatter strings). Total Vitest tests: **100 passed (100%)**.
  - Updated validator `src/lib/validators/profile.ts`: added optional and nullable `latitude` (-90..90) and `longitude` (-180..180) to `updateProfileSchema`.
  - Updated `/api/user/profile` (`src/app/api/user/profile/route.ts`): included `latitude` and `longitude` in `SAFE_PROFILE_SELECT` and in `PUT` handler to persist viewer's own coordinates.
  - Updated `/api/matches` (`src/app/api/matches/route.ts`):
    - Added `currentUser.hasLocation: boolean` to the response summary.
    - Attached rounded `distanceKm: number | null` (nearest whole km) to each match item.
    - Peer candidate coordinates are strictly excluded from the response payload (zero `latitude` or `longitude` keys).
    - Query count preserved via single parallel `Promise.all`.
  - Updated `/api/events` (`src/app/api/events/route.ts`):
    - Loaded viewer coordinates once in GET handler.
    - Attached `distanceKm: number | null` (0.1 km decimal precision) to each event item.
  - Extracted address search UI into reusable client component `src/components/AddressSearch.tsx` and integrated in both `CreateEventDialog.tsx` and `src/app/profile/setup/page.tsx`:
    - Search button (no search-as-you-type), 5 results, Nominatim attribution `"© OpenStreetMap contributors"`.
    - Confirmation banner with `"Location set: <label>"` and `"Remove my location"` button.
    - Privacy notice: `"Only a rounded distance is shown to others. Your exact coordinates are never shared."`.
  - Updated UI cards:
    - Match cards (`src/app/dashboard/page.tsx`): display formatted distance next to location text when `distanceKm !== null`. Header banner displays non-dismissible hint `"Set your location to see distances"` linking to `/profile/setup` when `!currentUser.hasLocation`.
    - Event cards (`src/app/events/page.tsx`): display formatted distance next to event location text when `distanceKm !== null`.
  - Authored optional demo data script `scripts/set-demo-locations.mjs` with `--apply` requirement and dry-run default (dry-run executed and confirmed no emails logged).
  - Authored automated verification script `scripts/distance-check.mjs` (22 checks against port 3001: unauth 401, matches/events field retention, whole number distanceKm on matches, zero coordinate leaks in full JSON text of matches and peer profile, and hasLocation boolean).
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm test` -> 100 passed (100% across 7 files); `npm run build` -> exit 0; all 7 check suites passed (security: 20, validation: 28, pagination: 47, review: 5, profile: 13, geocode: 12, distance: 22). Table row counts before and after remain identical (81 rows).
  - Ticked P3.3; marked K6 resolved; added K26 and K27; advanced Next task to P3.4.

- 2026-10-23 (Phase 3: P3.2 Address Search Geocoding via Nominatim & Event Dialog Integration):
  - Created plan `docs/plans/P3.2-geocoding.md` covering Nominatim usage policy, route architecture, rate limiting, throttle queue, LRU memory cache, dialog UX states, and test strategy.
  - Implemented pure geocoding module `src/lib/geocode.ts`:
    - `normalizeGeocodeQuery`: trims, converts to lowercase, and collapses whitespace sequences.
    - `parseNominatimResponse`: safely validates and clamps items to max 5 results with labels truncated to 150 chars and valid numeric coordinates within -90..90 and -180..180.
    - `GeocodeCache`: in-memory cache on `globalThis` with 24-hour TTL and 500-entry LRU eviction cap.
    - `NominatimThrottler`: global serial promise-queue gate enforcing at most 1 request per second across the server instance with injectable clock and sleep timer for deterministic tests.
    - `executeGeocodeSearch`: orchestrates normalization, cache lookup, throttle delay, upstream fetch with timeout (5000ms), and error propagation.
  - Added query validation schema `geocodeQuerySchema` in `src/lib/validators/geocode.ts` (trimmed query, 3..200 characters) and exported in `src/lib/validators/index.ts`.
  - Built endpoint `GET /api/geocode?q=...` in `src/app/api/geocode/route.ts`:
    - Session authentication guard (`requireSession` -> 401).
    - Rate limit: 20 searches per minute per user (`geocode:search:<userId>` -> 429).
    - Validates query with `geocodeQuerySchema` (400 on missing or invalid length).
    - Calls `executeGeocodeSearch`, returns `{ results }` with `Cache-Control: private, no-store` and `X-Cache: HIT | MISS`.
    - Returns standardized 503 Service Unavailable with friendly user message on upstream failures, timeouts, or rate limits without leaking raw errors or User-Agent.
  - Updated `src/components/CreateEventDialog.tsx`:
    - Added address search input with "Search address" button (and Enter key trigger), disabled when < 3 chars or searching.
    - Added loading state, no-results notice ("No results found. Try adding the city, or enter coordinates manually."), and friendly error alert.
    - Added selectable list of up to 5 results displaying location labels. Clicking a result populates `lat` and `lng` (rounded to 6 decimals), pre-fills `location` if empty, and displays confirmation banner: `"Location set: <label> (<lat>, <lng>)"`.
    - Included attribution: `"© OpenStreetMap contributors"`.
    - Added collapsible section `"Enter coordinates manually (Advanced fallback)"` keeping full manual coordinate entry functional.
    - Stale response guard via request ID ref to ignore superseded asynchronous responses.
  - Documented `NOMINATIM_USER_AGENT` in `.env.example` with instructions to provide valid application and contact details before going live.
  - Added 18 unit tests in `src/lib/geocode.test.ts` (normalization, parsing edge cases, coordinate validity, label truncation, result limit, cache hit/expiry/LRU eviction, throttle delay, and upstream error handling). Total Vitest tests: **86 passed (100%)**.
  - Created integration script `scripts/geocode-check.mjs` verifying unauth 401, query validation 400s (<3 chars, >200 chars, missing), real upstream search 200 with coordinates, User-Agent leak prevention, cache hit verification (`X-Cache: HIT`), 1-second throttle compliance, second search, and zero database rows created. Check result: 12 PASSED, 0 FAILED, 0 SKIPPED.
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm test` -> 86 passed (100% across 6 files); `npm run build` -> exit 0 (20 routes compiled); all 6 check suites (security, validation, pagination, review, profile, geocode) passed 100%.
  - Database row counts before and after remain identical (79 rows). Database backed up to `D:\dev.db.backup9`.
  - Ticked P3.2; marked K4 resolved; added K24 and K25; advanced Next task to P3.3.

- 2026-10-23 (Phase 3: P3.1 Public Peer Profile Page `/profile/[id]`, Privacy Projection & UI Enhancements):
  - Created plan `docs/plans/P3.1-public-profile.md` detailing API contract, privacy allow-list, UI states, viewer-specific actions, and verification checklist.
  - Implemented pure profile view helper `src/lib/profile-view.ts`:
    - `buildRatingSummary`: computes rating count and average rounded to 1 decimal place; strictly returns `null` for `average` when `count === 0` (no fabricated 4.9 ratings).
    - `resolveViewerState`: determines `isSelf`, mutual `matchStatus` (`NONE | PENDING | ACCEPTED | DECLINED`), `matchId`, and `hasReviewed` status across bidirectional `(userAId, userBId)` roles.
    - `buildSafeProfileUser`: maps user profile strictly according to privacy allow-list, stripping `email`, `passwordHash`, and exact `lat`/`lng`.
  - Added unit test suite `src/lib/profile-view.test.ts` (10 tests covering null average on 0 reviews, rounding, strict privacy leakage checks, and matchStatus mapping across userA/userB). Total Vitest tests: **68 passed (100%)**.
  - Implemented `GET /api/users/[id]` in `src/app/api/users/[id]/route.ts`:
    - Session authentication guard (`requireSession` -> 401).
    - Validates target `id` with `userIdParamSchema` (400 on empty/whitespace).
    - Returns standardized 404 `{ "error": "User not found" }` for unknown UUIDs.
    - Explicit Prisma `select` allow-list guarantees `email`, `passwordHash`, `lat`, and `lng` are never retrieved from SQLite or serialized.
    - Implements review pagination contract (default cap 50, optional `page` and `limit`) with newest-first ordering and stable `id` tie-breaker.
  - Built responsive public profile page at `src/app/profile/[id]/page.tsx`:
    - Header with user avatar, name, location text, and rating summary ("New" badge with "No reviews yet" when unreviewed).
    - Bio section, "Can teach" badges with proficiency level, and "Wants to learn" badges.
    - Reviews list showing reviewer avatar, name, star rating, comment, and formatted date (with a friendly empty state when unreviewed).
    - Contextual viewer action area:
      - Self: "Edit my profile" linking to `/profile/setup`.
      - Match NONE: "Connect" button calling `POST /api/matches` with real-time UI state updates and server error feedback.
      - Match PENDING: Disabled "Request pending" badge.
      - Match ACCEPTED: "Message" button linking to `/chat` and conditional "Rate & review" button (hidden if already reviewed).
      - Match DECLINED: Neutral status badge.
    - Full loading, friendly 404 ("Profile not found" with button to Find Matches), and error handling states.
  - Implemented UI enhancements:
    - **Links**: Peer avatar and name in dashboard match cards link to `/profile/[id]`; peer avatar and name in chat header link to `/profile/[id]`; peer name on `/reviews` links to `/profile/[id]`.
    - **K22 Resolution**: On `/reviews`, if `viewer.hasReviewed === true`, the review submission form is replaced with a notice: *"You have already reviewed this person."*, while retaining full review history.
    - **Placeholder Rating Fix**: On dashboard cards, when `peer.reviewCount === 0`, displays an emerald `"New"` badge instead of fabricated `"⭐ 4.9 (0)"`. When `reviewCount > 0`, displays existing star rating and count. Backend rating calculation and `src/lib/matching.ts` remain completely untouched.
  - Created automated check suite `scripts/profile-check.mjs` verifying 13 assertions: unauth 401, empty id 400, unknown UUID 404, real user 200, zero text leakage of `email`, `passwordHash`, `latitude`, `longitude`, `lat`, `lng`, Priya's review count 1, Alex viewing Priya hasReviewed true, viewer viewing self isSelf true, unreviewed user rating.average null, and 0 database rows created.
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm test` -> 68 passed (100% across 5 files); `npm run build` -> exit 0 (19 routes compiled); `node scripts/security-check.mjs` -> 20 PASSED; `node scripts/validation-check.mjs` -> 28 PASSED; `node scripts/pagination-check.mjs` -> 47 PASSED; `node scripts/review-check.mjs` -> 5 PASSED; `node scripts/profile-check.mjs` -> 13 PASSED.
  - Confirmed database row counts before and after remain identical (78 rows total). Database backed up to `D:\dev.db.backup8`.
  - Ticked P3.1; marked K3 and K22 resolved; added K23; advanced Next task to P3.2.

- 2026-10-23 (Phase 2: P2.8 Review Rules, Single Review Enforcement & Phase 2 Completion):
  - Verified Part A lint check: `package.json` `"lint"` script is already `"eslint"`; confirmed real `npm run lint` output produces 0 errors, 0 warnings.
  - Queried baseline reviews in `prisma/dev.db`: Exactly 1 seeded review exists (Alex Kumar -> Priya Patel), 0 duplicate `(fromUserId, toUserId)` pairs. Baseline row counts: 78 rows total.
  - Added query index `@@index([fromUserId, toUserId])` in `prisma/schema.prisma` applied safely with `npx prisma db push` without data loss. (Skipped schema `@@unique` because SQLite table recreation requires destructive `--accept-data-loss`).
  - Added HTTP 409 helper `conflictResponse(message)` in `src/lib/api-error.ts`.
  - Added pure domain logic helper `evaluateReviewEligibility` in `src/lib/api-auth.ts` enforcing: self-review guard (400), target user existence (404), duplicate review rejection (409), and mutual `ACCEPTED` match requirement (403).
  - Hardened `POST /api/reviews` in `src/app/api/reviews/route.ts`:
    - Evaluates `evaluateReviewEligibility` before mutating data.
    - Encapsulates insertion within a Prisma `$transaction` re-verifying `existingReview` and catching Prisma error `P2002` to guarantee race safety across concurrent review submissions.
    - Returns standardized HTTP 409 Conflict `{ "error": "You have already reviewed this person." }`.
  - Created unit tests in `src/lib/api-auth.test.ts` (7 tests covering valid eligibility, self-review, non-existent target, duplicate review, missing match, PENDING match, and DECLINED match). Total Vitest tests: **58 passed (100%)**.
  - Created automated integration check script `scripts/review-check.mjs` verifying 5 rejection-only assertions: unauth 401, self-review 400, unaccepted match 403, duplicate review 409, and zero database rows created.
  - Confirmed database row counts before and after remain 100% identical (78 rows total).
  - Added Known Issue K22 for chat header & reviews page form reachability.
  - Ticked P2.8; marked Phase 2 (Backend hardening) COMPLETE; advanced Current phase to Phase 3 and Next task to P3.1.

- 2026-10-22 (Phase 2: P2.7 Rate Limiting on Login, Registration, and Write Endpoints):
  - Created zero-dependency in-memory rate limiter `src/lib/rate-limit.ts` with injectable clock, `RateLimitStore` interface, `globalThis` persistence across Next.js HMR, and automated periodic cleanup of expired entries.
  - Implemented client IP extraction via `getClientIp` with `x-forwarded-for` (first entry) and safe `127.0.0.1` fallback.
  - Implemented testing bypass switch: `RATE_LIMIT_DISABLED=true` (guarded by `process.env.NODE_ENV !== "production"`, strictly ignored in production). Documented in `.env.example`.
  - Added HTTP 429 response helper `tooManyRequestsResponse` in `src/lib/api-error.ts` with `{ "error": "Too many requests. Please try again in N seconds." }` and `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers.
  - Enforced rate limiting across login and all 9 write routes:
    - Login (`src/lib/auth.ts` NextAuth `authorize`): 10 per 15 min per IP+email (`login:ip_email:<ip>:<email>`) and 50 per 15 min per IP (`login:ip:<ip>`). Rate limit evaluates before DB lookup to prevent user enumeration. Error surfaces cleanly in UI alert box: *"Too many login attempts. Please try again in N seconds."*.
    - Register (`POST /api/auth/register`): 5 per hour per IP.
    - Messages (`POST /api/messages`): 30 per minute per user.
    - Matches (`POST /api/matches`): 20 per hour per user.
    - Match update (`PATCH /api/matches/[id]`): 60 per hour per user.
    - Reviews (`POST /api/reviews`): 10 per hour per user.
    - Events (`POST /api/events`): 10 per hour per user.
    - Event RSVP (`POST /api/events/[id]/rsvp`): 60 per hour per user.
    - Skills (`POST /api/skills`): 20 per hour per user.
    - Profile (`PUT /api/user/profile`): 30 per hour per user.
  - Enforced strict execution order: session check (401) -> rate limit check (429) -> validation (400) -> business logic/DB. Rate-limited requests never query or touch the database.
  - Authored 8 new unit tests in `src/lib/rate-limit.test.ts` (limit enforcement, retryAfter calculation, clock progression, key isolation, store cleanup, production bypass guard, IP header parsing). Total unit tests: **51 passed (100%)**.
  - Authored automated check suite `scripts/rate-limit-check.mjs` verifying 10 assertions with limiter ENABLED: unauth 401 priority, 30 validly-throttled requests hitting 429 with `Retry-After` on request 31 with zero data created, 10 login attempts with lockout on attempt 11, and independent IP+email key isolation.
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm test` -> 51 passed (100%); `npm run build` -> exit 0 (18 routes compiled); `node scripts/security-check.mjs` -> 20 PASSED, 0 FAILED; `node scripts/validation-check.mjs` -> 28 PASSED, 0 FAILED; `node scripts/pagination-check.mjs` -> 47 PASSED, 0 FAILED; `node scripts/rate-limit-check.mjs` -> 10 PASSED, 0 FAILED.
  - Ticked P2.7; added K20, K21; advanced Next task to P2.8.
- 2026-10-22 (Phase 2: P2.6 Backward-Compatible API Pagination & Result Limits):
  - Added safe, 100% backward-compatible pagination across all 5 list API endpoints: `GET /api/matches`, `GET /api/events`, `GET /api/conversations`, `GET /api/messages`, `GET /api/reviews`.
  - Implemented pure pagination utilities in `src/lib/pagination.ts` (`clampLimit`, `buildPagePaginationMeta`, `buildCursorPaginationMeta`, `getPaginationHeaders`, `createPaginatedResponse`) with zero Prisma/database dependencies.
  - Implemented reusable Zod query validation schemas in `src/lib/validators/pagination.ts` and updated `validators/messages.ts`, `validators/reviews.ts`, and `validators/index.ts`. All client limit inputs are clamped between 1 and 100 (`min(1).max(100)`); invalid limits (`0`, `abc`, `100000`) and malformed cursors/pages fail with standardized 400 Bad Request responses.
  - Applied conservative default caps when client passes no parameters: matches 100 candidates, events 100, conversations 100, messages latest 200 in ascending chronological order, reviews 50.
  - Implemented dual metadata contract: Preserved all existing top-level object fields (`currentUser`, `matches`, `events`, `conversations`, `messages`, `avgRating`, `totalReviews`) and added top-level `pagination` object, while also setting HTTP response headers (`X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages`, `X-Has-Next-Page`, `X-Next-Page`, `X-Has-More`, `X-Next-Cursor`).
  - Messages cursor pagination: When no params are passed, returns latest 200 messages in ascending order. When `cursor` message ID is provided, fetches older messages chronologically before that message and returns them in ascending order with `X-Next-Cursor` pointing to the oldest message. Chat page 3-second polling remains completely uninterrupted.
  - Authored 24 new unit tests in `src/lib/pagination.test.ts` (clamping, page metadata, cursor metadata, header generation, response envelope, Zod schema validation). Vitest suite now runs 43 unit tests (19 matching + 24 pagination), all passing in <1s.
  - Created automated check suite `scripts/pagination-check.mjs` running 47 assertions against running server (unauth 401s, baseline 200s with headers, limit=1 single-item tests, non-repeating page progression, invalid limit/cursor 400s). All 47 assertions passed.
  - Snapshot verification: Captured baseline snapshots for 10 endpoint-user combinations (`before-p26-*.json`), captured post-implementation snapshots (`after-p26-*.json`), and verified 100% payload data equivalence using `scripts/compare-snapshots.mjs`. All 10 snapshots confirmed 100% identical.
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm test` -> 43 passed (100%); `npm run build` -> exit 0 (18 routes compiled); `node scripts/security-check.mjs` -> 20 PASSED, 0 FAILED; `node scripts/validation-check.mjs` -> 28 PASSED, 0 FAILED; `node scripts/pagination-check.mjs` -> 47 PASSED, 0 FAILED.
  - Ticked P2.6; added K19; advanced Next task to P2.7.
- 2026-10-22 (Phase 2: P2.5 Matching Engine Extraction & Query Optimization):
  - Extracted core matching algorithm from `src/app/api/matches/route.ts` into pure module `src/lib/matching.ts` (`calculateRating`, `determineMatchedSkillName`, `findConnectionStatus`, `computePeerMatch`, `computeAllMatches`) with zero database or network dependencies.
  - Installed Vitest 3.2.7 devDependency and configured `vitest.config.ts` with Next.js `@/*` path alias resolution; added `"test": "vitest run"` to `package.json`.
  - Authored comprehensive test suite in `src/lib/matching.test.ts` covering 19 unit test cases: mutual matching, one-way match, non-overlapping skills, empty skills ("ray" scenario), self-exclusion, connection statuses (`NONE`, `PENDING`, `ACCEPTED`, `DECLINED`) across bidirectional user roles, rating calculations (default 4.9 vs averages), case-insensitive matching, and empty inputs. All 19 tests passed in 12ms.
  - Refactored `GET /api/matches` to a thin handler querying `currentUser`, `otherUsers`, and `matches` concurrently via `Promise.all` and delegating computation directly to `computeAllMatches`.
  - Eliminated the redundant `ensureSamplePeersExist()` `SELECT COUNT(*)` executed on every request.
  - Verified 100% matching output parity: captured baseline snapshots for Alex Kumar (`alex@example.com`) and Rimi (`rimi@gmail.com`) before changes, captured post-refactor snapshots, and executed `scripts/compare-snapshots.mjs`. Confirmed 100% identical outputs across all fields, ordering, and values.
  - Reduced query count from 13 queries down to 12 queries per request (eliminating count query overhead and parallelizing remaining lookups).
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm test` -> 19 passed (100%); `npm run build` -> exit 0; `node scripts/security-check.mjs` -> 20 PASSED, 0 FAILED; `node scripts/validation-check.mjs` -> 28 PASSED, 0 FAILED.
  - Ticked P2.5; advanced Next task to P2.6.
- 2026-10-22 (Phase 2: P2.3-Fix & P2.4 Prisma Schema Hardening):
  - Verification Fix A1 (ID formats): Verified `prisma/schema.prisma` uses `@default(uuid())` across all 9 models; confirmed all 78 existing rows across all tables use valid UUIDv4 format; verified validators accept valid UUIDs. Corrected documentation references from CUID to UUID.
  - Verification Fix A2 (Email normalization): Updated `src/lib/auth.ts` credentials provider to trim and lowercase `credentials.email` identically to registration. Confirmed all 13 stored user emails are lowercase; verified login succeeds seamlessly with uppercase (`ALEX@EXAMPLE.COM`) and mixed-case (`Alex@Example.Com`).
  - Verification Fix A3 (Automated verification): Added Section 3 to `scripts/validation-check.mjs` verifying valid UUID parameters on GET routes and case-insensitive credentials login. Total assertions increased from 23 to 28 (28 passed, 0 failed).
  - Task B1 & B2: Confirmed `prisma/migrations` does not exist; schema is managed via `prisma db push`. Recorded pre-change row counts (78 rows total), distinct enum values, and confirmed 0 duplicates across candidate unique keys.
  - Task B3 (Schema Hardening):
    - Defined native Prisma enums on SQLite: `MatchStatus` (`PENDING`, `ACCEPTED`, `DECLINED`), `AttendanceStatus` (`GOING`, `MAYBE`, `CANCELLED`), and `ProficiencyLevel` (`Beginner`, `Intermediate`, `Advanced`, `Expert`).
    - Added query indexes across high-traffic paths: `Match(userAId, userBId, matchedSkillId)`, `Match(userAId)`, `Match(userBId)`, `Match(matchedSkillId)`, `Message(matchId, createdAt)`, `Message(senderId)`, `Event(dateTime)`, `Event(hostId)`, `EventAttendee(userId)`, `EventAttendee(eventId)`, `Review(toUserId)`, `Review(fromUserId)`, `UserSkillsTeach(skillId)`, `UserSkillsLearn(skillId)`.
    - Maintained composite index on `Match(userAId, userBId, matchedSkillId)` and bidirectional runtime uniqueness check in `POST /api/matches` (skipping schema-level `@@unique` which would require destructive `--accept-data-loss` on SQLite).
    - Confirmed all 14 relation edges enforce `onDelete: Cascade`.
  - Applied schema via `prisma db push` without data loss; regenerated Prisma Client.
  - Confirmed post-change row counts are 100% identical (78 rows total).
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm run build` -> exit 0; `node scripts/security-check.mjs` -> 20 PASSED, 0 FAILED; `node scripts/validation-check.mjs` -> 28 PASSED, 0 FAILED.
  - Ticked P2.4; added K18; advanced Next task to P2.5.
- 2026-10-22 (Phase 2: P2.2 & P2.3 Zod Validation & Standard Error Handling):
  - Created centralized error handling & parsing utility `src/lib/api-error.ts`:
    - `parseBody`, `parseQuery`, and `parseParams` helper functions for type-safe Zod validation.
    - Standardized error response builders: `validationErrorResponse` (400, format: `{ error: string, details: Array<{ field, message }> }`), `badRequestResponse` (400), `unauthorizedResponse` (401), `forbiddenResponse` (403), `notFoundResponse` (404), `internalErrorResponse` (500).
    - Safely catches non-JSON / malformed request bodies and returns 400 Bad Request instead of 500 server crashes.
  - Updated `src/lib/api-auth.ts` to utilize the unified error response format from `api-error.ts`.
  - Built modular Zod 4 validation schemas in `src/lib/validators/`:
    - `auth.ts`: `registerSchema` (email format, 8–72 char passwords, trimmed non-empty name).
    - `skills.ts`: `createSkillSchema` (validated name, description, 10 known categories).
    - `profile.ts`: `updateProfileSchema`, `skillTeachItemSchema`, `skillLearnItemSchema` (coordinates, bio, skills with valid proficiencies `Beginner | Intermediate | Advanced | Expert`).
    - `matches.ts`: `createMatchSchema` (CUID format target user ID), `updateMatchStatusSchema` (`ACCEPTED | DECLINED`), `matchIdParamSchema`.
    - `messages.ts`: `getMessagesQuerySchema` (CUID matchId), `createMessageSchema` (matchId, 1–5000 char trimmed content).
    - `reviews.ts`: `getReviewsQuerySchema` (optional CUID targetUserId), `createReviewSchema` (1–5 integer rating, optional comment, CUID targetUserId).
    - `events.ts`: `createEventSchema` (preprocesses empty string lat/lng to undefined, validates coordinates within -90..90 / -180..180, title, description, ISO date), `eventIdParamSchema`.
    - `index.ts`: Barrel export for all schemas.
  - Implemented Zod validation across all 10 API route handlers in `src/app/api/**`:
    - Session checks run before body/query parsing so anonymous callers receive 401 Unauthorized before validation execution.
    - Strips unrecognized/excess fields to prevent unintended mass-assignment.
    - All JSON parsing wrapped in `parseBody()` to guard against invalid JSON payloads.
  - Created automated validation test suite `scripts/validation-check.mjs` verifying 23 rejection cases (invalid registration inputs, malformed JSON, out-of-range ratings/coordinates, unauthorized params, invalid enums).
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm run build` -> exit 0 (18 routes compiled); `node scripts/security-check.mjs` -> 20 PASSED, 0 FAILED; `node scripts/validation-check.mjs` -> 23 PASSED, 0 FAILED.
  - Ticked P2.2 and P2.3; marked K15 resolved; added K17; advanced Next task to P2.4.
- 2026-10-22 (Phase 2: P2.1 API Authentication & Ownership Hardening):
  - Created reusable auth & ownership helper `src/lib/api-auth.ts` (`requireSession` and `getMatchForParticipant`).
  - Hardened `POST /api/skills`: Enforced session check (401 if unauthenticated).
  - Hardened `PATCH /api/matches/[id]`: Verified caller is a participant; restricted `ACCEPTED` and `DECLINED` status updates strictly to the recipient (`userBId`, 403 for requester `userAId`).
  - Hardened `POST /api/matches`: Derived requester strictly from session (`auth.user.id`), blocked self-connections (400), verified target user exists (404).
  - Hardened `GET` & `POST /api/messages`: Enforced match participant checks via `getMatchForParticipant` (403 for non-participants); derived sender strictly from session (`auth.user.id`). Preserved messaging across existing conversation statuses so `/chat` remains functional.
  - Hardened `GET /api/conversations`: Standardized with `requireSession()`, confirmed queries only session user's matches.
  - Hardened `POST /api/reviews`: Derived reviewer strictly from session, retained self-review block (400), enforced prior `ACCEPTED` match requirement (403 otherwise).
  - Hardened `GET` & `PUT /api/user/profile`: Target user strictly bound to session user; introduced `SAFE_PROFILE_SELECT` to completely eliminate `passwordHash` serialization leaks.
  - Hardened `POST /api/events` & `POST /api/events/[id]/rsvp`: Bound host and attendee strictly to session user; verified event existence (404) before mutating attendee state.
  - Created automated security check script `scripts/security-check.mjs` verifying 20 denial and sanitization assertions (401 unauth guards, 403 non-participant guards, 403 self-accept guard, 400 self-review/connect guards, and zero `passwordHash` leakage). All 20 passed.
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm run build` -> exit 0 (18 routes compiled); `node scripts/security-check.mjs` -> 20 PASSED, 0 FAILED.
  - Ticked P2.1; marked K11, K12, K13, K14 resolved; advanced Next task to P2.2.
- 2026-10-22 (Phase 1: P1.2 & P1.3 Port Alignment & Navbar Messages Link):
  - Fixed dev port to 3001: updated `package.json` dev script to `next dev -p 3001`, updated `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` in `.env` to `http://localhost:3001`, removed stray `PORT=3000` from `.env`.
  - Created comprehensive `.env.example` with placeholders, generation instructions for `NEXTAUTH_SECRET` (`openssl rand -base64 32`), and explanatory comments.
  - Verified `.gitignore` contains `.env`, `*.db`, and `prisma/dev.db`.
  - Added protected "Messages" navigation link to `/chat` in `src/components/Navbar.tsx` using `lucide-react` `MessageCircle`, matching existing active-state styling and mobile layout, with a TODO placeholder comment for P4.1 unread count badge.
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm run build` -> exit 0 (18 routes compiled).
  - Ticked P1.2 and P1.3; marked K2 and K5 resolved; Phase 1 complete; advanced to Phase 2 (Next task: P2.1).
- 2026-10-22 (Phase 1: P1.1 & P1.4 ESLint Clean Pass):
  - Resolved all 42 ESLint problems (16 errors, 26 warnings). Current count: **0 errors, 0 warnings**.
  - Modified 10 files: `src/app/api/matches/route.ts`, `src/app/auth/page.tsx`, `src/app/chat/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/events/page.tsx`, `src/app/profile/setup/page.tsx`, `src/app/reviews/page.tsx`, `src/components/CreateEventDialog.tsx`, `src/components/MapView.tsx`, `src/components/Navbar.tsx`.
  - Quality gates: `npm run lint` -> 0 errors, 0 warnings; `npx tsc --noEmit` -> 0 errors; `npm run build` -> exit 0 (18 routes compiled).
  - `eslint-disable` used: None (0).
  - Ticked P1.1 and P1.4; marked K1 resolved; set Next task to P1.2.
- 2026-10-22 (Phase 0 Bootstrap & Audit):
  - Completed tasks P0.1, P0.2, P0.3.
  - Authored `docs/AUDIT.md` containing exhaustive dependency, Prisma schema (9 models, 0 enums), env vars, and API security/validation matrix.
  - Authored `AGENT_RULES.md`, `.agent/rules/agent-rules.md`, `.agents/rules/agent-rules.md`, `docs/plans/README.md`, and `docs/DECISIONS.md`.
  - Baseline capture:
    - `npx tsc --noEmit` -> 0 errors (Exit code 0)
    - `npm run lint` -> 42 problems (16 errors, 26 warnings) (Exit code 1)
    - `npm run build` -> Exit code 0 (Turbopack, 18 routes compiled successfully)
    - `npm test` -> Not configured
  - Corrected Section 2 (Zod usage, testing status) and Section 3 (model count updated to 9, enum status).
  - Appended new known security & architecture issues K11–K16 to Section 7.
  - Phase 0 complete; advanced to Phase 1 (Next task: P1.1).
- 2026-10-21: Project status file created from the initial analysis report. Frontend complete; builds pass; backend works in dev form but is not production-hardened.
