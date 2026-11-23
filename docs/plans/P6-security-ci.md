# P6: Security Hardening, Testing, Performance & CI Plan

## 1. Context & Baseline Findings

Following Task MG1 (MongoDB replica set data migration), the SkillSwap application runs with React 19 (Vite) in `client/`, Express 4 in `server/`, and Prisma ORM on MongoDB replica set `rs0` on port 27018.

### Audit Findings:
1. **MongoDB Injection & Parameter Handling**:
   - Prisma uses parameterized BSON queries, preventing classical SQL injection. However, if request parameters accept raw objects (e.g. NoSQL operator objects like `{"$ne": ""}`), unexpected query semantics could occur.
   - Zod schemas must enforce strict primitive types (`z.string()`) and reject unexpected objects or arrays (such as `matchId=a&matchId=b` query parameter arrays parsed by Express's query parser).
2. **Review Access Control**:
   - Currently, `GET /api/reviews` is public (no `requireSession`). In the application UI, reviews are only viewed by logged-in users. Requiring a valid session protects user review metadata and prevents anonymous scraping.
3. **Messaging Abuse (Pending & Declined Matches)**:
   - In `routes/messages.js`, any participant can send unlimited messages even when a match is in `PENDING` status, creating potential spam avenues before a connection is accepted.
   - A business rule is needed: while `PENDING`, only the requester (userA) may send up to 3 messages total; recipients cannot send until they accept the request; messages on `DECLINED` matches must be rejected with 409 Conflict.
4. **CSRF & Cookies**:
   - `csrfOriginCheck` inspects `Origin` when present, but requests without an `Origin` header are currently permitted. Adding a check for `Sec-Fetch-Site: cross-site` on state-changing requests blocks cross-site attacks where `Origin` is omitted.
   - Session cookies must enforce `HttpOnly`, `Secure` (in production), `SameSite=Lax`, and `Path=/`.
5. **Security Headers**:
   - Helmet provides baseline protection, but `x-powered-by` should be explicitly disabled, and modern security headers should be added: `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`, and `Strict-Transport-Security` (HSTS) in production.
   - CSP `img-src` currently allows only `'self'`, data/blob, and OpenStreetMap tiles. Seeded avatars use external HTTPS URLs (e.g. Unsplash), which are blocked in production. Expanding `img-src` to `['self', 'data:', 'blob:', 'https:']` resolves this issue.
6. **Rate Limiting Behind Proxies**:
   - `server/src/lib/rate-limit.js` contains a `getClientIp` function that manually reads the `X-Forwarded-For` header. This allows IP spoofing to bypass rate limits unless strictly managed. IP resolution must rely solely on Express's `req.ip`, which only respects proxies when `TRUST_PROXY=true` is explicitly configured.
7. **Production Error Masking**:
   - In production, internal 500 errors must never leak stack traces, SQL/MongoDB driver messages, or internal file paths; they must consistently return `{ "error": "Something went wrong" }`.
8. **Client Bundle Performance**:
   - The client application currently bundles all routes and dependencies (including Leaflet 1.9.4 and OpenStreetMap icons) into a single monolithic bundle (`index-DtKNSiOU.js` ~650 kB).
   - Route-level code splitting using `React.lazy` and `Suspense` will defer heavy modules (Leaflet, MapView, profile editing, chat) until requested, reducing the initial landing page bundle to well under 300 kB.
9. **Continuous Integration**:
   - Add `.github/workflows/ci.yml` with dual jobs: a "quality" job (lint, unit tests, client build) and an "integration" job (spinning up a MongoDB 7 replica set container, pushing schema, and running integration check scripts). Add `.github/dependabot.yml` for automated dependency maintenance.

---

## 2. Step-by-Step Implementation Plan

### Step 3a: MongoDB Injection & Parameter Type Hardening
- **Target**: `server/src/routes/auth.js`, `server/src/lib/validators/`
- **Actions**:
  - Verify all Zod string fields explicitly specify `z.string()` and fail on objects (`{"$ne": ""}`).
  - Add explicit array-rejection refinement or schema validation for query parameters in `parseQuery` and `server/src/lib/validators/`.
  - For `req.params`, ensure UUID validators reject malformed or non-string inputs with 400 Bad Request.

### Step 3b: Protect `GET /api/reviews`
- **Target**: `server/src/routes/reviews.js`, `server/scripts/pagination-check.mjs`, `server/scripts/validation-check.mjs`, `server/scripts/security-check.mjs`
- **Actions**:
  - Add `requireSession` middleware to `router.get('/', requireSession, ...)`.
  - Update `pagination-check.mjs` and `validation-check.mjs` to supply auth cookie headers.
  - Add unauthenticated 401 assertion to `security-check.mjs`.
  - Log decision in `docs/DECISIONS.md`.

### Step 3c: Messaging Abuse Prevention
- **Target**: `server/src/lib/api-auth.js`, `server/src/routes/messages.js`, `server/test/messaging-rules.test.js`
- **Actions**:
  - Author pure function `evaluateMessagingEligibility({ match, senderId, messageCount })`:
    - `match.status === 'DECLINED'` -> `{ allowed: false, status: 409, error: "This connection request was declined." }`
    - `match.status === 'PENDING'`:
      - `match.userAId !== senderId` -> `{ allowed: false, status: 409, error: "Accept the request to reply." }`
      - `messageCount >= 3` -> `{ allowed: false, status: 409, error: "You can send up to 3 messages until the request is accepted." }`
    - `match.status === 'ACCEPTED'` -> `{ allowed: true }`
  - In `POST /api/messages`: call `evaluateMessagingEligibility` after fetching the match. Count existing messages in match only if status is `PENDING`.
  - Add unit tests covering all branches in `server/test/messaging-rules.test.js`.

### Step 3d: CSRF & Sec-Fetch-Site Protection
- **Target**: `server/src/middleware/csrf.js`, `server/test/csrf.test.js`
- **Actions**:
  - For state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`): if `req.headers['sec-fetch-site'] === 'cross-site'`, reject with 403 Forbidden.
  - Maintain Origin whitelist validation when Origin header is present.

### Step 3e: Security Headers & CSP Image Policy
- **Target**: `server/src/app.js`, `server/scripts/prod-smoke-check.mjs`, `server/test/static-serving.test.js`
- **Actions**:
  - Add `app.disable('x-powered-by')`.
  - Configure Helmet with:
    - `referrerPolicy: { policy: 'strict-origin-when-cross-origin' }`
    - `crossOriginOpenerPolicy: { policy: 'same-origin' }`
    - `crossOriginResourcePolicy: { policy: isProduction ? 'same-origin' : 'cross-origin' }`
    - `hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false`
    - CSP `imgSrc: ["'self'", 'data:', 'blob:', 'https:']`
  - Add middleware for `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - Update `prod-smoke-check.mjs` assertions for the new headers.

### Step 3f: Rate Limiting & Proxy Trust Hardening
- **Target**: `server/src/lib/rate-limit.js`, `README.md`, `server/.env.example`
- **Actions**:
  - Refactor `getClientIp(req)` to use `req.ip || req.socket?.remoteAddress || '127.0.0.1'`. Remove manual reading of `x-forwarded-for`.
  - Document `TRUST_PROXY` risks and instructions in `README.md` and `server/.env.example`.

### Step 3g: Production Error Masking
- **Target**: `server/src/lib/api-error.js`, `server/src/middleware/error-handler.js`
- **Actions**:
  - Update `sendInternalError` to guarantee `{ error: 'Something went wrong' }` in production.

### Step 3h: Dependency Audit
- **Target**: `server/`, `client/`
- **Actions**:
  - Run `npm audit --omit=dev` and report status (currently 0 vulnerabilities).

### Step 3i: Secrets Scan & .gitignore Updates
- **Target**: `.gitignore`
- **Actions**:
  - Add `public/uploads/avatars/*` (with `!public/uploads/avatars/.gitkeep`), `backups/`, `*backups/`, `*.backup*`.
  - Verify no secret patterns exist in git history.

### Step 3j: Security Verification Script (`security2-check.mjs`)
- **Target**: `server/scripts/security2-check.mjs`
- **Actions**:
  - Author standalone verification script testing:
    1. Object-injection login (`{"email": {"$ne": ""}}`) -> 400 Bad Request.
    2. Array query parameters (`/api/messages?matchId=a&matchId=b`) -> 400 Bad Request.
    3. PENDING message quota: 1st, 2nd, 3rd succeed (201); 4th rejected (409).
    4. Recipient sending on PENDING match rejected (409 "Accept the request to reply.").
    5. Sending on DECLINED match rejected (409 "This connection request was declined.").
    6. Cross-site `Sec-Fetch-Site` request on state-changing route rejected (403).
    7. Unauthenticated `GET /api/reviews` rejected (401).
    8. Production security headers verified (`Permissions-Policy`, `Referrer-Policy`, `COOP`, `CSP`).
    9. Forced internal error returns generic `{ "error": "Something went wrong" }`.
  - Add to `server/scripts/run-checks.mjs`.

### Step 4: Client Performance & Code Splitting
- **Target**: `client/src/App.jsx`
- **Actions**:
  - Convert route page imports to `React.lazy()` for heavy pages (`DashboardPage`, `ProfileDetailPage`, `ChatPage`, `ReviewsPage`, `ProfileSetupPage`, `EventsPage`, `NotFoundPage`).
  - Keep `HomePage`, `AuthPage`, `Layout` in the initial entry bundle.
  - Wrap lazy routes in `<Suspense fallback={<PageFallback />}>`.
  - Run `npm run build` and compare bundle chunk sizes before and after.

### Step 5: Continuous Integration (GitHub Actions) & Dependabot
- **Target**: `.github/workflows/ci.yml`, `.github/dependabot.yml`
- **Actions**:
  - Author GitHub Actions workflow with pinned standard actions (`actions/checkout@v4`, `actions/setup-node@v4` with Node 22).
  - Job 1: `quality` (install, prisma generate, lint, unit tests, client build).
  - Job 2: `integration` (single-node MongoDB 7 replica set container, schema push, integration checks).
  - Author `.github/dependabot.yml` for weekly grouped npm updates.
  - Document CI in `README.md`.

---

## 3. Risks & Rollback Strategy
- **Risk**: Requiring authentication on `GET /api/reviews` might break existing tests or check scripts.
  - *Mitigation*: Updated all test runners and scripts (`pagination-check.mjs`, `validation-check.mjs`, `security-check.mjs`) to pass authentication cookies.
- **Risk**: Route-level lazy loading could cause hydration flicker or break tests that render `App.jsx`.
  - *Mitigation*: Client unit tests test individual page components directly rather than the full router tree. Suspense fallback uses the existing spinner design.
- **Database Safety**: All automated tests run on ephemeral scratch databases (`skillswap_test_<timestamp>`) with strict `_test_` deletion guards. Main database `skillswap` remains untouched (81 rows).
- **Archive Safety**: `prisma/dev.db` remains 100% read-only and backed up at `D:\dev.db.backup19`.

---

## 4. Verification Checklist
- [ ] Server lint: 0 errors, 0 warnings.
- [ ] Client lint: 0 errors, 0 warnings.
- [ ] Server unit tests pass (172+ tests).
- [ ] Client unit tests pass (103 tests).
- [ ] All check scripts pass (security, validation, pagination, review, profile, geocode, distance, avatar, p35, p35-write, foundation, client smoke, m4a, m4b).
- [ ] New `security2-check.mjs` passes all assertions.
- [ ] Production smoke check passes (35 assertions).
- [ ] Client build succeeds with route chunks split; entry bundle well under 300 kB.
- [ ] Main database document count verified at strictly 81.
- [ ] `prisma/dev.db` hash verified byte-identical.

