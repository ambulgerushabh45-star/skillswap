# Plan P7b: All-in-One Hardening, Google Auth, Email Notifications, Deletion & Launch Prep

**Date**: 2026-11-17  
**Status**: DRAFT -> IN PROGRESS  
**Scope**: Server logging & health, account deletion cascade, privacy/terms pages, Google OAuth PKCE, Resend email notifications, code cleanup, deployment configuration & launch checklist.

---

## 1. Baseline Quality Gate & Findings (Part 0)

### 1.1 Pre-execution Safety Checklist
- [x] Main database backup exported: `D:\skillswap-backups\2026-11-17T06-23-36-717Z` (81 documents verified).
- [x] `prisma/dev.db` hash verified: `27DEF9FD4087FC8C71A4492F9FFD6D82CB94FDC8FF23F4C645EE442C5293D4C0` (167,936 bytes).
- [x] Zero commits made. No secrets printed or logged.
- [x] Scratch database isolation: all write tests use `<main>_test_<timestamp>` and drop afterwards.

### 1.2 Baseline Metrics Recorded (Scratch DB)
- **Server lint**: 0 errors, 0 warnings
- **Server tests**: 189 passed (16 test files)
- **Client lint**: 0 errors, 0 warnings
- **Client tests**: 112 passed (15 test files)
- **Client build**: Completed in ~2.45s (chunk ~332 kB / 105 kB gzip)
- **Check scripts (`npm run check`)**: 245 assertions across 11 scripts PASSED
- **Production smoke check**: 35 passed
- **Foundation check**: 57 passed
- **Client checks**: smoke (21), m4a (31), m4b (31) all PASSED
- **Codebase size**:
  - `server/`: 89 files, 12,430 LOC; 8 dependencies, 5 devDependencies (13 total)
  - `client/`: 61 files, 10,283 LOC; 15 dependencies, 14 devDependencies (29 total)

### 1.3 Findings from Codebase Audit (0.2)
1. **Authentication & Session**: `server/src/lib/auth.js` uses JWT in an `httpOnly`, `SameSite=Lax`, `Secure` (in prod) cookie named `skillswap_session`. Normal login requires email and bcrypt password hash.
2. **Rate Limiting**: `server/src/lib/rate-limit.js` provides an in-memory window-based rate limiter `createRateLimiter({ windowMs, max, keyGenerator, message })` suitable for IP or user keying.
3. **Logging & Errors**: `server/src/middleware/logger.js` currently uses `morgan` with dev/combined format. In production, we need a custom middleware logging strictly 1 structured JSON line per request with timing and sanitized paths.
4. **Health Route**: `server/src/routes/health.js` has `GET /api/health` returning `{ status: 'ok' }`. We need to add `GET /api/health/db` with Prisma ping, 3s timeout, rate limited to 30/min/IP.
5. **Account Deletion Cascade**: MongoDB Prisma emulates cascades, but cross-model dependencies (`EventAttendee`, `Review` author/subject, `Message` in `Match`, `AvatarFile`, disk files) must be cleanly and safely deleted in dependency order in `DELETE /api/user/account`.
6. **Part 1 Auto-Skip**: The user prompt template contains `<<< FILL IN: ... >>>` and was not filled in. Per instruction, Part 1 is explicitly SKIPPED.

---

## 2. Approved Schema Changes & Migration Procedure

### 2.1 Changes to `prisma/schema.prisma`
1. `model User`:
   - Add `emailNotifications Boolean?` (null means ON / opt-in by default).
   - Add relation `oauthAccounts OAuthAccount[]`.
2. New model `OAuthAccount`:
   ```prisma
   model OAuthAccount {
     id                String   @id @default(uuid()) @map("_id")
     provider          String
     providerAccountId String
     userId            String
     createdAt         DateTime @default(now())

     user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@unique([provider, providerAccountId])
     @@index([userId])
     @@map("OAuthAccount")
   }
   ```

### 2.2 Schema Application Procedure
1. Modify `prisma/schema.prisma`.
2. Run `prisma db push` on a scratch test database first:
   Verify Prisma outputs only additions with zero warnings of data loss or destructive operations.
3. Run `prisma db push` against the main database `skillswap`.
4. Verify document count on main database: must remain 81 documents, with 0 documents in `OAuthAccount` and `AvatarFile`.

---

## 3. Detailed Design per Part

### Part 1 — Interface Changes
- **Status**: SKIPPED (Prompt placeholder `<<< FILL IN: ... >>>` was not provided).

### Part 2 — Logging and Health
1. **Production Request Logger**:
   - In production (`process.env.NODE_ENV === 'production'`), generate UUID `requestId = crypto.randomUUID()`.
   - Set response header `X-Request-Id: <requestId>`.
   - On request finish, output exactly 1 JSON line to `process.stdout`:
     ```json
     {"timestamp":"2026-11-17T...Z","requestId":"...","method":"GET","path":"/api/users","status":200,"durationMs":12,"userId":"..."}
     ```
   - Path must be stripped of any query string (`req.baseUrl + req.path` or `req.originalUrl.split('?')[0]`).
   - Strict privacy: NEVER log query strings, headers, cookies, request bodies, IP addresses, or emails.
   - Development keeps existing human-readable `morgan('dev')`.
2. **Crash & Unhandled Rejection Handlers**:
   - Helper `redactMongoUri(str)`: replaces credentials in `mongodb://user:pass@host` and `mongodb+srv://user:pass@host` with `mongodb://[REDACTED]@host` and `mongodb+srv://[REDACTED]@host`.
   - Process handlers:
     - `process.on('unhandledRejection', (reason, promise) => { ... })`
     - `process.on('uncaughtException', (error) => { ... })`
     - Outputs single JSON error line `{ level: "error", message: redactMongoUri(...), stack: redactMongoUri(...) }` and exits with `process.exit(1)`.
3. **Health Endpoints**:
   - Keep existing `GET /api/health` returning `{ "status": "ok" }`.
   - Add `GET /api/health/db`:
     - Rate limit: 30 requests per minute per IP using `createRateLimiter`.
     - 3-second timeout ping using `Promise.race([prisma.$runCommandRaw({ ping: 1 }), timeout])`.
     - On success: HTTP 200 `{ "status": "ok" }`.
     - On failure or timeout: HTTP 503 `{ "status": "unavailable" }`.
4. **Tests**:
   - `server/test/logging-health.test.js`:
     - Test `redactMongoUri` with various mongo strings.
     - Test production logger omits query strings, cookies, headers, and logs valid JSON.
     - Test `X-Request-Id` header is returned.
     - Test `GET /api/health/db` returns 200 on DB healthy, 503 on DB ping failure/timeout.

### Part 3 — Account Deletion, Privacy and Terms
1. **Endpoint `DELETE /api/user/account`**:
   - Authentication: `requireSession`.
   - Rate limiting: max 3 attempts per hour per user/IP.
   - Validation: `{ confirm: "DELETE", password }`.
   - Password check:
     - If user has an associated `OAuthAccount` record, `password` is optional.
     - If user has NO `OAuthAccount` record, `password` is required and verified against `user.passwordHash`.
     - Wrong password returns standard 403 error: `{ error: { code: 'FORBIDDEN', message: 'Invalid password' } }`.
   - Cascade cleanup in dependency order:
     - Find all user's hosted events -> delete attendees for those events -> delete events.
     - Delete user's RSVPs to other events (`EventAttendee`).
     - Find all matches involving user (as `userAId` or `userBId`) -> delete messages in those matches -> delete matches.
     - Delete reviews given (`authorId == user.id`) and reviews received (`subjectId == user.id`).
     - Delete user skills (`UserSkillsTeach`, `UserSkillsLearn`).
     - Delete `AvatarFile` records and disk files (if stored on disk in `uploads/avatars/`).
     - Delete `OAuthAccount` records.
     - Delete `User` record.
     - Clear session cookie `res.clearCookie('skillswap_session')`.
   - Standard response: HTTP 200 `{ message: 'Account successfully deleted' }`.
2. **Profile API Additive Field**:
   - `GET /api/user/profile`: Add `authMethod: user.oauthAccounts?.length > 0 ? 'google' : 'password'`.
3. **Client Danger Zone**:
   - `client/src/pages/ProfileSetupPage.jsx`:
     - Add "Danger Zone" card at bottom: "Delete my account".
     - Confirmation modal explaining irreversible loss of skills, matches, messages, reviews, and events.
     - Asks to type `DELETE` in text input.
     - Asks for password unless `authMethod === 'google'`.
     - On success: clear auth state, redirect to `/` with alert message.
4. **Privacy & Terms Pages**:
   - Create `client/src/config/site.js` containing `SITE_NAME = 'SkillSwap'`, `CONTACT_EMAIL = 'privacy@skillswap.local'`.
   - Create `client/src/pages/PrivacyPage.jsx`:
     - Disclaimer banner: "Template for review by owner; not legal advice".
     - Truthful disclosures: data collected (name, email, password hash, bio, skills, location coordinates, profile photo, messages, reviews, events/RSVPs); purposes; third parties (OpenStreetMap, Google OAuth if enabled, Resend if enabled, hosting/database); session cookie; self-service deletion.
   - Create `client/src/pages/TermsPage.jsx`:
     - Acceptable use (no spam, harassment, illegal content); user-generated content; safety advice for meeting strangers (public locations, notify friends, unverified identities).
   - Lazy load routes `/privacy` and `/terms` in `client/src/App.jsx`.
   - Link from `Layout.jsx` footer and `AuthPage.jsx` signup form.
5. **Tests**:
   - `server/test/account-deletion.test.js`: Comprehensive integration test on scratch DB:
     - Create rich user with skills, matches, messages, reviews (sent & received), hosted event with attendees, RSVPs elsewhere, avatar, and OAuthAccount.
     - Delete account.
     - Verify EVERY collection in MongoDB contains zero documents referencing the deleted user's ID.
     - Verify other users' data remains intact.
     - Verify second delete fails (401 unauthenticated).
   - Client tests in `client/src/test/legal-and-deletion.test.jsx`.

### Part 4 — Google Login (OAuth 2.0 PKCE, Zero Packages)
1. **Configuration**:
   - Environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_URL`.
   - Non-production overrides: `GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_USERINFO_URL`.
   - Redirect URI: `${PUBLIC_URL}/api/auth/google/callback` (in dev: `http://localhost:5173/api/auth/google/callback`).
2. **Endpoints**:
   - `GET /api/auth/providers`:
     - Returns `{ google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) }`.
   - `GET /api/auth/google`:
     - Rate limit 20 per 10 minutes per IP.
     - If unconfigured, redirect to `/auth?error=google_unavailable`.
     - Generate random 32-byte base64url `state` and PKCE `code_verifier`.
     - Compute `code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url')`.
     - Sign JWT with secret `JWT_SECRET` containing `{ state, code_verifier }`, exp 10 min.
     - Set cookie `skillswap_oauth`: `httpOnly: true`, `sameSite: 'lax'`, `secure: isProduction`, `path: '/api/auth/google'`, `maxAge: 10 * 60 * 1000`.
     - Redirect 302 to Google auth URL:
       `response_type=code`, `client_id=GOOGLE_CLIENT_ID`, `redirect_uri=...`, `scope=openid email profile`, `state=...`, `code_challenge=...`, `code_challenge_method=S256`, `prompt=select_account`.
   - `GET /api/auth/google/callback`:
     - If `req.query.error`: redirect to `/auth?error=google_cancelled`.
     - Read and clear cookie `skillswap_oauth`.
     - Verify JWT: if invalid, expired, or state mismatch (via `crypto.timingSafeEqual`), redirect to `/auth?error=google_failed`.
     - Exchange code via POST to Google token URL (`grant_type=authorization_code`, `code`, `code_verifier`, `client_id`, `client_secret`, `redirect_uri`) with 5s timeout.
     - Fetch userinfo from Google userinfo URL with Bearer access token (5s timeout).
     - Require `sub`, `email`, and `email_verified === true`. If not, redirect `/auth?error=google_failed`.
     - Check:
       1. `OAuthAccount` exists with `provider: 'google'` and `providerAccountId: sub`:
          Log user in with standard session cookie -> redirect `/dashboard`.
       2. Else if `User` with trimmed, lowercased `email` already exists:
          Redirect to `/auth?error=account_exists` (anti-pre-hijacking protection).
       3. Else create user + OAuthAccount:
          - `name`: Google name (sliced to 100 chars) or email prefix.
          - `email`: lowercased.
          - `passwordHash`: bcrypt cost 10 of 48 random bytes.
          - Create user and nested `OAuthAccount`.
          - Set session cookie -> redirect `/profile/setup` (for onboarding).
     - Any catch or failure redirects to `/auth?error=google_failed` (fixed relative path, never leaking error details).
3. **Client UI**:
   - `AuthPage.jsx`:
     - Fetch `/api/auth/providers` on mount.
     - If `google === true`, show "Continue with Google" button -> `window.location.assign('/api/auth/google')`.
     - Query error handling: show banner for `google_cancelled`, `account_exists`, `google_failed`, `google_unavailable`.
4. **Tests**:
   - Unit tests: state validation, timing safety, PKCE generation, error redirects.
   - Scratch integration test with local mock Google OAuth server:
     - Tests new user signup + redirect to `/profile/setup`.
     - Tests returning user login + redirect to `/dashboard`.
     - Tests existing email rejection with `account_exists`.
     - Tests unverified email rejection.
     - Tests token / userinfo network failures.

### Part 5 — Email Notifications (Dormant Until Configured)
1. **Library `server/src/lib/email.js`**:
   - Built-in `fetch` to `https://api.resend.com/emails` (or `RESEND_API_URL` in non-prod).
   - Bearer `RESEND_API_KEY`, 5-second timeout, zero retries.
   - Dormant mode: if `RESEND_API_KEY` or `EMAIL_FROM` is missing, log startup notice and resolve `{ skipped: true }`.
   - Dry run mode: if `EMAIL_DRY_RUN=true`, log subject and recipient domain only (no email address).
   - Rate limiting (in-memory):
     - Max 5 emails/hour and 20 emails/day per recipient email.
     - Max 1 connection-request email per `(senderId, recipientId)` pair per 24 hours.
   - Never throws into caller; logs errors safely without sensitive emails.
2. **Templates `server/src/lib/email-templates.js`**:
   - Sanitize: HTML escape helper for dynamic values (`name`, `event title`).
   - Strip CR (`\r`) and LF (`\n`) from email subjects; limit subject to 100 chars.
   - NEVER include chat message content.
   - Footers: explain why email was sent, include disclaimer "If you did not create a SkillSwap account you can ignore this message", and link to `${PUBLIC_URL}/profile/setup` to opt out.
   - Events supported:
     1. New connection request -> recipient.
     2. Connection request accepted -> requester.
     3. Event cancelled -> attendees with status `GOING` (except host, capped at 50 attendees).
3. **Fire-and-Forget Integration**:
   - Call after database transaction commits in `matches.js` and `events.js`.
   - Check recipient's `emailNotifications !== false`.
4. **API & UI**:
   - `GET` & `PUT /api/user/profile`: Add `emailNotifications` field. Default `true` if null.
   - `ProfileSetupPage.jsx`: Checkbox "Email me about new requests and cancelled events" (checked by default).
5. **Tests**:
   - Unit tests: HTML escaping, CR/LF stripping, dormancy, dry run, opt-out logic, abuse limits, attendee cap.
   - Scratch integration test with mock Resend server.

### Part 6 — Remove Unwanted Code (Audit & Prune)
1. **Strict Guardrails**:
   - Never delete core files (`migrate-sqlite-to-mongo`, `import-backup`, `export-backup`, `dev.db`, rules, docs history).
   - Inspect files with zero imports and zero references across git grep.
   - Record exact before/after metrics: LOC, file count, dependencies.
   - Any questionable item is marked "Not removed, owner to decide".

### Part 7 — Docs & Launch Checklist
1. Update `render.yaml`: add `PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` with `sync: false`.
2. Update `.env.example` and `server/.env.example`.
3. Create `docs/LAUNCH-CHECKLIST.md` with step-by-step beginner guide:
   - Atlas schema push instructions.
   - Google Cloud OAuth credentials setup.
   - Resend domain & API key setup.
   - Uptime monitor setup on `/api/health/db`.
   - Live smoke test checklist.
4. Update `README.md`, `PROJECT_STATUS.md`, `docs/DECISIONS.md`.

---

## 4. Environment Variables Specification

| Variable | Scope | Description | Default / Example |
|---|---|---|---|
| `PUBLIC_URL` | Server & Client | Full public URL for callbacks and email links | `http://localhost:5173` (dev) / `https://skillswap.onrender.com` (prod) |
| `GOOGLE_CLIENT_ID` | Server | Google OAuth 2.0 Web Client ID | Dormant if unset |
| `GOOGLE_CLIENT_SECRET` | Server | Google OAuth 2.0 Web Client Secret | Dormant if unset |
| `GOOGLE_AUTH_URL` | Server (test only) | Override for mock Google auth | unset in prod |
| `GOOGLE_TOKEN_URL` | Server (test only) | Override for mock Google token exchange | unset in prod |
| `GOOGLE_USERINFO_URL` | Server (test only) | Override for mock Google userinfo | unset in prod |
| `RESEND_API_KEY` | Server | API key for Resend HTTP API | Dormant if unset |
| `EMAIL_FROM` | Server | Sender address | e.g. `notifications@skillswap.app` |
| `EMAIL_DRY_RUN` | Server | Log instead of sending | `true` / `false` |
| `RESEND_API_URL` | Server (test only) | Override for mock Resend server | unset in prod |

---

## 5. Risks & Mitigations

1. **Risk: Account Pre-Hijacking via Google OAuth**:
   - *Mitigation*: If Google returns an email that matches an existing local user who has no linked `OAuthAccount`, do NOT link or log in; redirect to `/auth?error=account_exists`.
2. **Risk: Orphaned Records on Account Deletion**:
   - *Mitigation*: Explicit, transactional deletion of all related collections in dependency order, verified by scratch test asserting zero residual user ID references across all collections.
3. **Risk: Email Header Injection / Spamming**:
   - *Mitigation*: Subjects strictly stripped of `\r` and `\n` and capped to 100 characters; in-memory rate limiting per recipient (5/hr, 20/day) and per pair (1/24hr).
4. **Risk: Sensitive Data Leak in Logs**:
   - *Mitigation*: Production logger strips query strings, ignores bodies/headers/cookies, and applies credential redaction helper for any MongoDB URIs.

---

## 6. Verification Checklist
- [ ] Schema push to scratch DB succeeded with no warnings.
- [ ] Schema push to main DB succeeded; document count 81 verified.
- [ ] Part 2 tests pass (production JSON log, no sensitive data, MongoDB URI redaction, db health check).
- [ ] Part 3 tests pass (account deletion cascade, no orphans in any collection, privacy & terms pages).
- [ ] Part 4 tests pass (Google OAuth PKCE, state security, mock server sign-up/login/rejection).
- [ ] Part 5 tests pass (Resend email delivery, dormancy, dry run, abuse caps, attendee caps).
- [ ] Part 6 audit completed with clean metrics.
- [ ] Part 7 docs and `docs/LAUNCH-CHECKLIST.md` created.
- [ ] Full regression suite passes: `npm run lint`, `npm test`, `npm run build`, `npm run check`, `prod-smoke-check.mjs`, `foundation-check.mjs`, `client-checks`.
- [ ] Clean deployment proof `server/scripts/test-clean-deploy.mjs` passes.
- [ ] Dev.db hash unchanged. Main database document count unchanged.

