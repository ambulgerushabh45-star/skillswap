# Implementation Plan — Task M2: Remaining Express APIs & Native P3.5 Events Feature

## 1. Goal & Context
Task M2 completes the backend migration to Express by implementing all remaining API endpoints in `server/`, achieving 100% functional and behavioral parity with the legacy Next.js app (which remains untouched on port 3001), AND natively implementing the new roadmap feature **P3.5** (host event edit and cancellation, optional attendee limit with capacity enforcement).

---

## 2. Scope & Target Endpoints

### 2.1 Remaining Endpoints to Port to Express
1. **Matches (`server/src/routes/matches.js`)**:
   - `GET /api/matches`: `requireSession`, pagination (`total, page, limit, totalPages, hasNextPage, hasPrevPage`), Haversine distance calculation rounded to nearest whole km, privacy coordinates exclusion (`currentUser.hasLocation`, `distanceKm`), candidate scoring.
   - `POST /api/matches`: `requireSession`, rate limit 20/hr (`matches:create:<userId>`), `createMatchSchema`, prevent self-connections, upsert/create match with `status: PENDING`.
   - `PATCH /api/matches/:id`: `requireSession`, rate limit 60/hr (`matches:update:<userId>`), `matchIdParamSchema` + `updateMatchStatusSchema`, participant authorization (recipient-only `userBId` can accept/decline; requester `userAId` blocked with 403).
2. **Messages (`server/src/routes/messages.js`)**:
   - `GET /api/messages`: `requireSession`, `getMessagesQuerySchema` (`matchId`, `limit`, `cursor`), cursor-based pagination with headers, participant authorization check via `getMatchForParticipant`.
   - `POST /api/messages`: `requireSession`, rate limit 30/min (`messages:create:<userId>`), `createMessageSchema`, participant authorization, inserts message.
3. **Conversations (`server/src/routes/conversations.js`)**:
   - `GET /api/conversations`: `requireSession`, page-based pagination, queries user's active conversations/matches with last message snippet.
4. **Reviews (`server/src/routes/reviews.js`)**:
   - `GET /api/reviews`: public/open query, `getReviewsQuerySchema` (`toUserId`, `page`, `limit`), page pagination.
   - `POST /api/reviews`: `requireSession`, rate limit 10/hr (`reviews:create:<userId>`), `createReviewSchema`, business rules via `evaluateReviewEligibility` (blocks self-review 400, missing target 404, duplicate review 409, requires ACCEPTED match 403).
5. **Geocode (`server/src/routes/geocode.js`)**:
   - `GET /api/geocode`: `requireSession`, rate limit 20/min (`geocode:search:<userId>`), Nominatim proxy with 1 req/sec throttle queue and 24h in-memory cache, strips User-Agent from client, query validation (3..200 chars).
6. **Avatar Upload & Serving (`server/src/routes/avatar.js`)**:
   - `POST /api/user/avatar`: `requireSession`, rate limit 10/hr (`avatar:upload:<userId>`), multipart upload (2 MB limit), magic byte sniffing (JPEG/PNG/WebP), Sharp pipeline (auto-orient, 512x512 crop, WebP q80, EXIF/GPS stripping, 25 MP decomp-bomb cap), atomic disk write to storage dir, user record update.
   - `DELETE /api/user/avatar`: `requireSession`, rate limit 30/hr (`avatar:delete:<userId>`), removes stored file and nullifies `avatarUrl`.
   - `GET /api/avatars/:file`: `requireSession`, path traversal protection, serves WebP image with appropriate content-type and cache headers.

### 2.2 P3.5 Native Feature Implementation (`server/src/routes/events.js`)
- `GET /api/events`: public/optional session, page pagination, Haversine distance (0.1 km rounding), attendee count, attendee limit indicators, cancelled status indicators.
- `POST /api/events`: `requireSession`, rate limit 10/hr (`events:create:<userId>`), `createEventSchema` (extended with optional `maxAttendees`).
- `PUT / PATCH /api/events/:id`: `requireSession`, rate limit 30/hr (`events:update:<userId>`), host-only authorization (403 if not host, 404 if not found), validation for updated title, description, location, coordinates, dateTime, and maxAttendees.
- `DELETE /api/events/:id` (or Cancel): `requireSession`, rate limit 30/hr, host-only authorization, marks event as cancelled (or soft cancellation `isCancelled = true`).
- `POST /api/events/:id/rsvp`: `requireSession`, rate limit 60/hr (`events:rsvp:<userId>`), host cannot RSVP to own event (or already host), checks if event is cancelled (blocked with 400/409), checks capacity (`maxAttendees`): if attendee count >= maxAttendees and status changing to GOING, reject with 409 Conflict `{ error: "Event has reached maximum attendee capacity" }`.

---

## 3. Proposed Schema Additions for P3.5
Per the Strangler Rules: *Any schema change for P3.5 needs the owner's explicit approval first and may only be applied with a plain `prisma db push` without any data-loss flag.*

Proposed additions to `model Event` in `prisma/schema.prisma`:
```prisma
model Event {
  id           String          @id @default(uuid())
  hostId       String
  title        String
  description  String
  location     String
  lat          Float?
  lng          Float?
  dateTime     DateTime
  maxAttendees Int?            // P3.5: Nullable maximum attendee capacity
  isCancelled  Boolean         @default(false) // P3.5: Cancellation state
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @default(now()) @updatedAt

  host         User            @relation("HostedEvents", fields: [hostId], references: [id], onDelete: Cascade)
  attendees    EventAttendee[]

  @@index([dateTime])
  @@index([hostId])
}
```
*Note: Both new fields are non-breaking (`maxAttendees` is nullable `Int?`, and `isCancelled` has `@default(false)`). Applying this via `npx prisma db push` will NOT cause any data loss.*

---

## 4. Dependencies
- Allowed in `server/package.json`: `sharp` for avatar processing.
- For multipart form-data handling in Express: `multer` (recommended and standard) or lightweight streaming parser. We explicitly request approval to install `multer` in `server/package.json`.

---

## 5. Verification Plan
1. **Vitest Unit & Integration Tests**:
   - Port all existing matching, geo, geocode, rate-limit, avatar, pagination, api-auth unit tests.
   - Add new tests for P3.5 event editing, cancellation, capacity checks, and RSVP conflict rules.
2. **Automated M2 Verification Script (`server/scripts/m2-check.mjs`)**:
   - Matches: connect, pagination, distance, recipient-only accept/decline.
   - Messages & Conversations: cursor pagination, participant guards.
   - Reviews: eligibility rules (duplicate 409, self 400, no match 403).
   - Geocode: Nominatim proxy, cache hit/miss, 1 req/sec throttle.
   - Avatar: upload, magic byte check, WebP conversion, traversal protection, deletion.
   - Events (P3.5): host edit, host cancel, non-host rejection (403), capacity limit rejection (409), cancelled event RSVP rejection.
3. **Parity Check (`server/scripts/parity-check.mjs`)**:
   - Validate parity between port 3001 and port 4000 across all shared endpoints.
4. **Legacy App Integrity**:
   - Confirm root `npm run lint`, `npm test` (121 passing), `npm run build` (20 routes), and all 8 legacy check scripts pass against port 3001.

