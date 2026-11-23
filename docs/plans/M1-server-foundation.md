# Stage M1 Plan: Express Server Foundation & Initial APIs

## 1. Goal & Context

Stage M1 establishes the standalone Node.js Express backend in `server/` written in plain JavaScript (ES modules, `"type": "module"`). It introduces:
- Zod-based environment validation.
- Prisma client singleton connecting to the existing root `prisma/dev.db`.
- Express app factory (`createApp`) with security headers (Helmet), body parsing, cookie parsing, request logging, and centralized error handling.
- A secure JWT-in-cookie session authentication mechanism replacing NextAuth (`skillswap_session`, HS256, SameSite=Lax, HttpOnly).
- Ported framework-free domain logic modules (`matching`, `pagination`, `rate-limit`, `geocode`, `geo`, `profile-view`, `avatar`, and Zod validators).
- Express routes for `/api/health`, `/api/auth/*`, `/api/user/profile`, `/api/users/:id`, and `/api/skills`.
- Full automated test coverage in `server/` (Vitest unit tests, `foundation-check.mjs`, and `parity-check.mjs`).

---

## 2. Directory Layout for `server/`

```
server/
├── package.json
├── .env.example
├── .env
├── eslint.config.mjs
├── vitest.config.js
├── src/
│   ├── index.js
│   ├── app.js
│   ├── config/
│   │   └── env.js
│   ├── db/
│   │   └── prisma.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── csrf.js
│   │   ├── error-handler.js
│   │   ├── logger.js
│   │   ├── not-found.js
│   │   └── rate-limiter.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── health.js
│   │   ├── profile.js
│   │   ├── skills.js
│   │   └── users.js
│   └── lib/
│       ├── api-auth.js
│       ├── api-error.js
│       ├── avatar-storage.js
│       ├── avatar.js
│       ├── geo.js
│       ├── geocode.js
│       ├── matching.js
│       ├── pagination.js
│       ├── profile-view.js
│       ├── rate-limit.js
│       └── validators/
│           ├── auth.js
│           ├── events.js
│           ├── geocode.js
│           ├── index.js
│           ├── matches.js
│           ├── messages.js
│           ├── pagination.js
│           ├── profile.js
│           ├── reviews.js
│           └── skills.js
├── tests/
│   ├── auth.test.js
│   ├── env.test.js
│   ├── middleware.test.js
│   ├── api-auth.test.js
│   ├── avatar.test.js
│   ├── geo.test.js
│   ├── geocode.test.js
│   ├── matching.test.js
│   ├── pagination.test.js
│   ├── profile-view.test.js
│   └── rate-limit.test.js
└── scripts/
    ├── foundation-check.mjs
    └── parity-check.mjs
```

---

## 3. Detailed Implementation Steps

### Step 3.1: Server Dependencies (`server/package.json`)
Only the permitted dependencies will be installed:
- Production: `express`, `cookie-parser`, `jsonwebtoken`, `bcryptjs`, `zod`, `@prisma/client`, `helmet`.
- Development: `prisma`, `vitest`, `eslint`, `@eslint/js`, `globals`.
- Package configuration: `"type": "module"`.
- Scripts:
  - `"dev"`: `"node --watch src/index.js"`
  - `"start"`: `"node src/index.js"`
  - `"lint"`: `"eslint"`
  - `"test"`: `"vitest run"`

### Step 3.2: Environment Validation (`server/src/config/env.js`)
- Validates variables at startup using Zod:
  - `PORT`: Coerced number, default `4000`.
  - `NODE_ENV`: `"development" | "production" | "test"`, default `"development"`.
  - `DATABASE_URL`: String, defaults to resolving `../../prisma/dev.db`.
  - `JWT_SECRET`: Minimum 32 characters in production. In development, a missing secret issues a visible warning and uses a generated fallback.
  - `ALLOWED_ORIGINS`: Comma-separated or array of URLs, default `["http://localhost:5173", "http://localhost:4000"]`.
  - `TRUST_PROXY`: Boolean, default `false`.
  - `RATE_LIMIT_DISABLED`: Boolean, strictly ignored in production.
  - `NOMINATIM_USER_AGENT`: Optional string.
  - `AVATAR_STORAGE_DIR`: Optional string.
- Creates `server/.env.example` with clear comments.

### Step 3.3: Database Connection (`server/src/db/prisma.js`)
- Instantiates `@prisma/client` singleton on `globalThis`.
- Connects to SQLite file: `file:../../prisma/dev.db`.
- Verifies path resolution matches the active 81-row database file.

### Step 3.4: Express Factory & Middleware Pipeline (`server/src/app.js`)
- `createApp()` exports the unlistened Express app for testing:
  1. `helmet`: JSON API security headers.
  2. `express.json({ limit: "100kb" })`: Parses JSON request bodies; catches syntax errors and returns standard 400 Bad Request.
  3. `cookieParser()`: Reads cookies into `req.cookies`.
  4. Safe request logger: Prints method, path, and status code without bodies, cookies, or secrets.
  5. CSRF origin check: Rejects mismatched Origin headers on POST/PUT/PATCH/DELETE with 403.
  6. API routes mounted under `/api`.
  7. Catch-all JSON 404 for unmatched `/api/*` routes.
  8. Central error handler: Catches unexpected exceptions, logs internally, and returns `500 { "error": "Something went wrong" }`.

### Step 3.5: Authentication (`server/src/routes/auth.js` & `server/src/middleware/auth.js`)
- JWT cookie: Name `skillswap_session`, 7 days, HttpOnly, SameSite=Lax.
- `POST /api/auth/register`: Zod validation (`registerSchema`), checks email uniqueness, hashes password, inserts user into database, signs JWT, sets cookie, returns `201 { user: { id, name, email } }`.
- `POST /api/auth/login`: Trims & lowercases email; enforces rate limits; looks up user. If missing, compares password against a dummy hash to prevent timing leaks. Signs JWT, sets cookie, returns `200 { user: { id, name, email } }`.
- `POST /api/auth/logout`: Clears `skillswap_session` cookie; returns `200 { message: "Logged out successfully" }`.
- `GET /api/auth/session`: Reads cookie. If valid, loads user from database and returns `200 { user: { id, name, email, image } }`. If missing or invalid, returns `200 { user: null }`.
- `requireSession` middleware: Reads JWT cookie, verifies HS256 signature, attaches `req.user = { id }`. If invalid or missing, returns standard `401 { "error": "Unauthorized" }`.

### Step 3.6: Port Domain Logic & Validators
- Port pure modules from `src/lib/` to `server/src/lib/`:
  - `matching.js`, `pagination.js`, `rate-limit.js`, `geocode.js`, `geo.js`, `profile-view.js`, `avatar.js`, `avatar-storage.js`.
  - All 10 validator modules in `server/src/lib/validators/`.
- Adapt `api-error.js` and `api-auth.js` for Express:
  - `api-error.js`: Adapts `parseBody`, `parseQuery`, `parseParams` to Express `req.body`, `req.query`, `req.params`.
  - `api-auth.js`: Implements Express-compatible `evaluateReviewEligibility`.
- Copy corresponding Vitest test suites into `server/tests/`.

### Step 3.7: Port Stage M1 Routes
- `GET /api/user/profile`: Calls `requireSession`, uses `SAFE_PROFILE_SELECT`, returns `{ user }`.
- `PUT /api/user/profile`: Rate limit (30/hr), validates `updateProfileSchema`, checks avatar ownership, updates user, returns `{ user }`.
- `GET /api/users/:id`: Validates UUID, queries user, rating summary, reviews, viewer state with privacy projection (no email, no passwordHash, no coordinates).
- `GET /api/skills`: Returns all skills ordered by name.
- `POST /api/skills`: Rate limit (20/hr), validates `createSkillSchema`, inserts skill, returns `{ skill }`.
- `GET /api/health`: Returns `{ "status": "ok" }`.

---

## 4. Verification & Testing Strategy

### 1. Server Unit Tests (`server/tests/`)
- JWT signing & verification (valid, expired, tampered, wrong secret, "none" algorithm rejected).
- Cookie options across development and production environments.
- CSRF origin check middleware.
- Environment validation (missing/short secret in production).
- Error handler mapping.
- All ported unit test suites (matching, pagination, rate-limit, geocode, geo, profile-view, avatar, api-auth).

### 2. Integration Check (`server/scripts/foundation-check.mjs`)
- Runs against `http://localhost:4000`.
- Zero database mutations (read-only and rejection-only tests).
- Asserts `/api/health` 200, unauthenticated 401s, logout session state, registration validation rejections, Alex credentials login, mixed-case email login, tampered cookie rejection, foreign Origin 403, privacy leak prevention, and login rate limiting.

### 3. Parity Check (`server/scripts/parity-check.mjs`)
- Runs simultaneously against Next.js (`http://localhost:3001`) and Express (`http://localhost:4000`).
- Signs in as `alex@example.com` and `rimi@gmail.com`.
- Compares JSON responses for:
  - `GET /api/user/profile`
  - `GET /api/users/<priya_id>`
  - `GET /api/users/<alex_id>`
  - `GET /api/skills`
  - `GET /api/users/non-existent-uuid` (404)
  - `POST /api/skills` validation failure (400)
- Confirms 100% payload equality.

### 4. Legacy Application Regression Verification
- Root Next.js app passes:
  - `npm run lint` -> 0 errors, 0 warnings.
  - `npm test` -> 121 passed (8 suites).
  - `npm run build` -> exit 0 (20 routes).
  - All 8 legacy check scripts -> 161 passed.
- Database row counts verified identical before and after (81 rows).

