# Implementation Plan — Task M2: Remaining APIs and Native P3.5 Events Feature

## 1. Task Goal & Context
Task M2 completes the backend migration to Express by:
1. Porting all remaining Next.js API routes into `server/src/routes/` with 100% behavioral, shape, status, validation, and rate-limit parity.
2. Implementing the new roadmap feature **P3.5** (host event edit and cancellation, optional attendee limit with capacity enforcement) natively in Express.
3. Applying the approved, non-breaking schema additions (`maxAttendees Int?` and `cancelledAt DateTime?` on `Event`).
4. Maintaining the Strangler Fig boundary: the legacy Next.js app on port 3001 remains completely untouched.

---

## 2. Route-by-Route Porting Notes

### 2.1 Matches (`server/src/routes/matches.js`)
- **GET /api/matches**:
  - Guard: `requireSession` (401).
  - Rate limit: Unthrottled.
  - Logic: Fetch `currentUser`, `otherUsers` (excluding current user), and user's `matches`.
  - Matching Engine: `computeAllMatches()` from `server/src/lib/matching.js`.
  - Privacy & Distance: Compute distance via `haversineKm` and `roundKm(d, 1)`. Output `currentUser.hasLocation: boolean` and `distanceKm: number | null` on each candidate. Coordinate fields (`latitude`, `longitude`) MUST NOT appear in output.
  - Pagination: Query params `page`, `limit` clamped via `clampLimit(limit, 100)`. Meta built via `buildPagePaginationMeta`. Headers set via `sendPaginated`.
- **POST /api/matches**:
  - Guard: `requireSession` (401).
  - Rate limit: 20/hr (`matches:create:<userId>`).
  - Validation: `createMatchSchema` (`targetUserId` non-empty string).
  - Logic: Prevent self-connection (400 `"Cannot connect with yourself"`). Verify target user exists (404 `"Target user not found"`). Check existing bidirectional match (409 `"Match request already exists"`). Create match with `status: "PENDING"`, `userAId: req.user.id`, `userBId: targetUserId`. Return 201 `{ match }`.
- **PATCH /api/matches/:id**:
  - Guard: `requireSession` (401).
  - Rate limit: 60/hr (`matches:update:<userId>`).
  - Validation: `matchIdParamSchema` + `updateMatchStatusSchema` (`status` in `ACCEPTED`, `DECLINED`).
  - Logic: Fetch match. If not found -> 404 `"Match not found"`. Participant guard: caller must be `userAId` or `userBId` (403 `"Forbidden: You are not a participant in this match"`). Recipient guard: only `userBId` can accept or decline (403 `"Forbidden: Only the recipient can accept or decline a match request"`). Update status. Return 200 `{ message: "Match updated successfully", match }`.

### 2.2 Conversations (`server/src/routes/conversations.js`)
- **GET /api/conversations**:
  - Guard: `requireSession` (401).
  - Rate limit: Unthrottled.
  - Pagination: `pagePaginationQuerySchema`, clamped to 100.
  - Logic: Find user's matches ordered by `createdAt desc, id asc`. For each match, load latest message snippet. Format conversation items. Send paginated response with headers.

### 2.3 Messages (`server/src/routes/messages.js`)
- **GET /api/messages**:
  - Guard: `requireSession` (401).
  - Rate limit: Unthrottled.
  - Validation: `getMessagesQuerySchema` (`matchId` required UUID, `limit` optional 1..100, `cursor` optional string).
  - Participant guard: `getMatchForParticipant` (403 for non-participants, 404 for nonexistent match).
  - Cursor Pagination: Limit clamped to default 200, max 100. Query latest messages in ascending chronological order (`createdAt asc`). Build `buildCursorPaginationMeta`. Send paginated response with `X-Next-Cursor` and headers.
- **POST /api/messages**:
  - Guard: `requireSession` (401).
  - Rate limit: 30/min (`messages:create:<userId>`).
  - Validation: `createMessageSchema` (`matchId`, `content` trimmed 1..5000 chars).
  - Logic: `getMatchForParticipant` participant check (403/404). Note: Chat on PENDING matches stays allowed as in the legacy app. Insert message with `senderId: req.user.id`. Return 201 `{ message }`.

### 2.4 Reviews (`server/src/routes/reviews.js`)
- **GET /api/reviews**:
  - Guard: None (public).
  - Validation: `getReviewsQuerySchema` (`toUserId` required, `page`, `limit`).
  - Logic: Count reviews for `toUserId`. Query paginated reviews ordered by `createdAt desc, id desc`. Include `fromUser` (id, name, avatarUrl). Send paginated response.
- **POST /api/reviews**:
  - Guard: `requireSession` (401).
  - Rate limit: 10/hr (`reviews:create:<userId>`).
  - Validation: `createReviewSchema` (`toUserId`, `rating` integer 1..5, optional `comment` max 1000).
  - Business rules: Evaluated via `evaluateReviewEligibility`:
    - Self-review -> 400 `"You cannot review yourself"`
    - Recipient missing -> 404 `"Recipient user not found"`
    - No `ACCEPTED` match -> 403 `"You can only review users you have an accepted match with"`
    - Existing review -> 409 `"You have already reviewed this person."`
  - Transactional insert catching Prisma `P2002` duplicate review error -> 409. Return 201 `{ message: "Review submitted successfully", review }`.

### 2.5 Geocode (`server/src/routes/geocode.js`)
- **GET /api/geocode**:
  - Guard: `requireSession` (401).
  - Rate limit: 20/min (`geocode:search:<userId>`).
  - Validation: `geocodeQuerySchema` (`q` trimmed 3..200 chars).
  - Proxy rules: OpenStreetMap Nominatim upstream call with custom User-Agent from `config.NOMINATIM_USER_AGENT`.
  - Throttle: Global serial promise queue enforcing at least 1000ms between upstream calls.
  - Cache: In-memory Map caching normalized query results for 24h with a 500-entry max cap. Set `X-Cache: HIT` or `X-Cache: MISS`.
  - Privacy: Never forwards client IP or user cookies/tokens to Nominatim. Friendly 503 if upstream fails.

### 2.6 Avatar Upload & Serving (`server/src/routes/avatar.js`)
- **POST /api/user/avatar**:
  - Guard: `requireSession` (401).
  - Rate limit: 10 uploads/hr (`avatar:upload:<userId>`).
  - Multipart handling: Native Node 24 `Request.prototype.formData()` without third-party multer dependency. Early `Content-Length > 2.5MB` check -> 413. File size <= 2MB check -> 413.
  - Validation: Magic-byte sniffing (`detectImageType`: JPEG, PNG, WebP only; rejects SVG/HTML/PDF/corrupt). Sharp pipeline: auto-orient, 512x512 cover crop, WebP q80, EXIF/GPS metadata stripped, 25 MP decomp-bomb cap.
  - Storage: Store in `<project>/storage/avatars/` (or `AVATAR_STORAGE_DIR`). Filename: `<userId>-<16 hex chars>.webp`. Update `user.avatarUrl`. Delete old avatar file if owned by user. Return 200 `{ avatarUrl }`.
- **DELETE /api/user/avatar**:
  - Guard: `requireSession` (401).
  - Rate limit: 30/hr (`avatar:delete:<userId>`).
  - Logic: Clear `avatarUrl` to null. Delete stored file if owned. Return 200 `{ message: "Avatar deleted successfully" }`.
- **GET /api/avatars/:file**:
  - Guard: `requireSession` (401).
  - Security: Strict filename regex (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}\.webp$`). Blocks directory traversal (`..`, `/`, `\`) with 400.
  - Serving: Read file from storage dir. Return 404 if missing. Headers: `Content-Type: image/webp`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=31536000, immutable`.

---

## 3. Feature P3.5 Design (Native Express Events)

### 3.1 Event Model Schema Additions
In `prisma/schema.prisma`:
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
  maxAttendees Int?            // P3.5: Nullable maximum attendee limit
  cancelledAt  DateTime?       // P3.5: Nullable cancellation timestamp
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @default(now()) @updatedAt

  host         User            @relation("HostedEvents", fields: [hostId], references: [id], onDelete: Cascade)
  attendees    EventAttendee[]

  @@index([dateTime])
  @@index([hostId])
}
```

### 3.2 Additive GET /api/events Fields
Every event in `GET /api/events` includes:
- `goingCount: number`: Total attendees with status `GOING`.
- `maxAttendees: number | null`: Capacity limit or null if unlimited.
- `cancelled: boolean`: `Boolean(event.cancelledAt)`.
- `isFull: boolean`: `maxAttendees !== null && goingCount >= maxAttendees`.
- Distance: `distanceKm` rounded to 0.1 km.

**Visibility of Cancelled Events**:
- Active events (`cancelledAt === null`) are returned to all users.
- Cancelled events (`cancelledAt !== null`) are returned ONLY to:
  1. The event host (`hostId === req.user?.id`), OR
  2. Users who had an RSVP record for that event.
- For all other users, cancelled events are filtered out.

### 3.3 PATCH /api/events/:id (Edit Event)
- Guard: `requireSession` (401).
- Rate limit: 30/hr (`events:update:<userId>`).
- Authorization:
  - If event not found -> 404 `"Event not found"`.
  - If `event.hostId !== req.user.id` -> 403 `"Forbidden: Only the event host can edit this event"`.
  - If event is cancelled (`event.cancelledAt !== null`) -> 409 `"Cannot edit a cancelled event"`.
- Validation:
  - Editable fields: `title`, `description`, `dateTime`, `location`, `latitude`/`lat`, `longitude`/`lng`, `maxAttendees`.
  - At least one field required (400 if empty).
  - `maxAttendees`: Integer between 1 and 1000, or `null` to remove limit.
  - If `maxAttendees` is provided and `< goingCount` -> 409 `"maxAttendees cannot be set below the current attendee count (X)"`.
  - `dateTime`: Must be valid ISO date string. If creation allows past dates, keep consistent.
- Execution: Update record, return 200 `{ message: "Event updated successfully", event }`.

### 3.4 POST /api/events/:id/cancel (Cancel Event)
- Guard: `requireSession` (401).
- Rate limit: 10/hr (`events:cancel:<userId>`).
- Authorization:
  - If event not found -> 404 `"Event not found"`.
  - If `event.hostId !== req.user.id` -> 403 `"Forbidden: Only the event host can cancel this event"`.
  - If already cancelled (`event.cancelledAt !== null`) -> 409 `"Event is already cancelled"`.
- Execution: Set `cancelledAt: new Date()`. Preserve all attendee rows. Return 200 `{ message: "Event cancelled successfully" }`.

### 3.5 POST /api/events/:id/rsvp (RSVP with Capacity & Cancel Checks)
- Guard: `requireSession` (401).
- Rate limit: 60/hr (`events:rsvp:<userId>`).
- Logic:
  - Fetch event. If not found -> 404.
  - If cancelled (`event.cancelledAt !== null`) -> 409 `"This event has been cancelled."`
  - Existing RSVP check:
    - If user currently has `GOING` status and requests to toggle off (e.g. `CANCELLED` or delete) -> ALWAYS ALLOWED (toggling off must never be blocked).
    - If user is joining (`GOING`):
      - Check capacity inside `$transaction`:
        - Count attendees with `status: "GOING"`.
        - If `event.maxAttendees !== null && goingCount >= event.maxAttendees` -> 409 `"This event is full."`
        - Otherwise upsert RSVP to `GOING`.
  - Return updated status.

### 3.6 Pure Rules Module (`server/src/lib/event-rules.js`)
Pure functions with zero database/Prisma dependencies:
- `canEditEvent(event, userId)`
- `canCancelEvent(event, userId)`
- `validateCapacityChange(currentGoingCount, newMaxAttendees)`
- `computeIsFull(goingCount, maxAttendees)`
- `shouldShowCancelled(event, userId, userRsvpStatus)`
- `normalizeEventPatchPayload(input)`

---

## 4. Schema Change Procedure
1. Confirm both servers (3001 and 4000) are stopped.
2. Confirm backup `D:\dev.db.backup14` exists.
3. Edit `prisma/schema.prisma` to add `maxAttendees Int?` and `cancelledAt DateTime?` to `model Event`.
4. Run `npx prisma db push` from project root (strictly without `--accept-data-loss` and without `--force-reset`).
5. Copy updated Prisma Client to `server/node_modules/.prisma/client`.
6. Confirm database row counts across all 9 tables remain exactly 81 rows.
7. Confirm root quality gates (`npm run lint`, `npm test`, `npm run build`, check scripts).

---

## 5. Tests and Verification Plan
1. **Unit Tests (`server/test/`)**:
   - `event-rules.test.js`: Comprehensive tests for pure event logic (capacity checks, host authorization, cancelled event blocks, full state edge cases).
   - Port all existing unit test suites (matching, profile-view, geocode, rate-limit, geo, avatar, pagination, api-auth, auth, csrf, env, error-handler).
2. **Ported Check Scripts (`server/scripts/`)**:
   - Port all 8 check scripts to run against `http://localhost:4000`:
     - `security-check.mjs` (20 assertions)
     - `validation-check.mjs` (28 assertions)
     - `pagination-check.mjs` (47 assertions)
     - `review-check.mjs` (5 assertions)
     - `profile-check.mjs` (13 assertions)
     - `geocode-check.mjs` (12 assertions)
     - `distance-check.mjs` (22 assertions)
     - `avatar-check.mjs` (14 assertions)
     - Total: 161 assertions.
   - Shared authentication helper uses `POST /api/auth/login` (with `signSessionToken` for non-credential test accounts).
3. **Parity Check (`server/scripts/parity-check.mjs`)**:
   - Run against port 3001 (old) and port 4000 (new).
   - Compare GET `/api/matches`, `/api/events`, `/api/conversations`, `/api/reviews`, `/api/messages`, and error cases (400, 401, 403, 404).
   - Verify 100% byte-for-byte equality, ignoring ONLY the 3 additive P3.5 fields on event items (`maxAttendees`, `cancelled`, `isFull`).
4. **P3.5 Rejection Checks (`server/scripts/p35-check.mjs`)**:
   - Automated denial tests against port 4000 (creates NO data in dev.db):
     - Unauthenticated PATCH/POST cancel -> 401
     - Non-host PATCH/POST cancel -> 403
     - Unknown UUID -> 404
     - Invalid payloads (empty patch, maxAttendees 0, 1001, 2.5, bad coordinates) -> 400
5. **Write-Path Integration Tests on DB Copy (`server/test/integration/p35-write.test.js`)**:
   - Copies `prisma/dev.db` to a temporary file (`server/tmp/test.db`).
   - Starts Express on test port 4100 pointing `DATABASE_URL` to the copy.
   - Executes real write workflows:
     - Host creates event, edits title and capacity limit.
     - Multiple users RSVP until capacity is reached; verify next user receives 409 `"This event is full."`.
     - Attendee toggles OFF (cancels RSVP); verify another user can now join.
     - Host tries to set capacity below current attendee count -> receives 409.
     - Host cancels event -> receives 200.
     - Host tries to cancel again -> receives 409 `"Event is already cancelled"`.
     - User tries to edit or RSVP to cancelled event -> receives 409.
     - Verify cancelled event is visible to host and attendees, but hidden from strangers.
     - Complete connect -> accept -> message -> review (duplicate 409) flow.
     - Avatar upload with generated test image and deletion.
   - Teardown: Stop test server, delete temporary DB and avatar folder.
   - Confirm `prisma/dev.db` row counts remain untouched (81 rows).
6. **Documentation**:
   - Update `PROJECT_STATUS.md` and `docs/DECISIONS.md`.

