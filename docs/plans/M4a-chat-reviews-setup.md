# M4a Plan: Port Chat, Reviews, and Profile Setup Pages to React (Vite) Client

## 1. Goal & Context
In Task M4a of the SkillSwap migration, we replace the placeholder cards for `/chat`, `/reviews`, and `/profile/setup` in the React (Vite) client (`client/`) with fully functional plain JavaScript (ESM, JSX) implementations ported from the legacy Next.js app (`src/app/`).
The `/events` route remains a placeholder card until Task M4b (which will port events, Leaflet map, host edit/cancel, and RSVP).

### Strangler Fig Constraints
1. `src/` (legacy Next.js on port 3001), `server/` (Express on port 4000), `scripts/`, `prisma/`, and root configs remain **100% untouched**.
2. All new code resides strictly in `client/` plus `.gitignore`, `docs/`, `PROJECT_STATUS.md`, and `docs/DECISIONS.md`.
3. Database `prisma/dev.db` is never modified, deleted, or reset. Row counts must stay strictly at **81 rows**.
4. Zero new dependencies in `client/package.json` or root `package.json`.
5. Strict ports: Vite on **5173** (`strictPort: true`), Express on **4000**, Next.js on **3001**.

---

## 2. Component & File Layout

```
client/
├── src/
│   ├── components/
│   │   ├── AddressSearch.jsx          # Reusable Nominatim geocoding search component
│   │   ├── Layout.jsx                 # Existing SPA layout
│   │   ├── Navbar.jsx                 # Existing responsive navbar
│   │   └── ProtectedRoute.jsx         # Existing session guard
│   ├── pages/
│   │   ├── ChatPage.jsx               # Two-panel chat with robust 3s polling
│   │   ├── ReviewsPage.jsx            # Star rating and review submission & history
│   │   ├── ProfileSetupPage.jsx       # Bio, skills, location (AddressSearch), avatar upload
│   │   └── PlaceholderPage.jsx        # Keeps /events as the only placeholder
│   ├── test/
│   │   ├── AddressSearch.test.jsx     # Geocode search interaction & attribution tests
│   │   ├── ChatPage.test.jsx          # Polling, message sending, filtering, error tests
│   │   ├── ReviewsPage.test.jsx       # Param parsing, 5-star rating, 409 conflict, list tests
│   │   └── ProfileSetupPage.test.jsx  # Skill add/remove, avatar upload race condition tests
│   └── App.jsx                        # Routes configuration (wire real pages)
└── scripts/
    └── m4a-check.mjs                  # Read-only and rejection verification script on port 5173
```

---

## 3. Data Flow & API Contracts

### A. Chat Page (`/chat`, `ChatPage.jsx`)
- **Conversations**: `GET /api/conversations`
  - Returns `{ conversations: [{ matchId, peerId, peerName, peerAvatar, peerLocation, matchedSkillName, lastMessage: { content, createdAt } }], pagination }`.
  - Filterable by `peerName` or `matchedSkillName` using client search input.
  - Periodic list sync every 15s, and immediately upon sending a message.
- **Messages**: `GET /api/messages?matchId=<id>`
  - Returns `{ messages: [{ id, matchId, senderId, senderName, senderAvatar, content, createdAt }], total, hasMore, nextCursor }`.
  - Polled every 3000ms.
- **Send Message**: `POST /api/messages`
  - Payload: `{ matchId, content }`.
  - On error (e.g. 429 Too Many Requests, 403 Forbidden, 400 Bad Request): preserves the input content and renders an alert banner.
  - On success: clears input, triggers immediate `loadMessages` and `loadConversations`.

### B. Reviews Page (`/reviews`, `ReviewsPage.jsx`)
- **Query Parameters**: `?toUserId=<id>&name=<name>` (or `?peerId=<id>`).
  - If missing: shows friendly card prompting user to select a peer from dashboard or chat.
- **Target User & Viewer State**: `GET /api/users/:id`
  - Returns `{ user: { id, name, avatarUrl, bio }, viewer: { isSelf, hasAcceptedMatch, hasReviewed, canReview } }`.
- **Review History**: `GET /api/reviews?toUserId=<id>&page=1&limit=50`
  - Returns `{ reviews: [{ id, rating, comment, createdAt, fromUser }], avgRating, totalReviews, pagination }`.
- **Submit Review**: `POST /api/reviews`
  - Payload: `{ toUserId, rating, comment }`.
  - Validation: 1 to 5 stars, non-empty comment.
  - Duplicate guard: if `viewer.hasReviewed === true` or API returns `409 Conflict`, renders "You have already reviewed this person" card.
  - "Load more" button if `pagination.hasNextPage`.

### C. AddressSearch Component (`AddressSearch.jsx`)
- Reusable for profile setup (M4a) and event creation dialog (M4b).
- Input for query string.
- Search button (and Enter key). Disabled if trimmed query length < 3 or while request is in flight.
- Request counter (`searchRequestIdRef`) to ignore stale out-of-order network responses.
- Calls `GET /api/geocode?q=<query>`.
- Displays up to 5 location results.
- `onSelect({ label, latitude, longitude })` callback rounds coordinates to 6 decimal places.
- Clear action button (`onClear`).
- OpenStreetMap attribution link: `https://www.openstreetmap.org/copyright`.

### D. Profile Setup Page (`/profile/setup`, `ProfileSetupPage.jsx`)
- **Initial Load**:
  - `GET /api/skills` -> list of available skills for presets/suggestions.
  - `GET /api/user/profile` -> current user details (`bio`, `location`, `latitude`, `longitude`, `avatarUrl`, `skillsTeach`, `skillsLearn`).
- **Skills Management**:
  - Teach skills: Name, proficiency (`Beginner`, `Intermediate`, `Advanced`, `Expert`). Prevents case-insensitive duplicates.
  - Learn skills: Name. Prevents case-insensitive duplicates.
- **Avatar Management & Race Prevention**:
  - Upload file: `POST /api/user/avatar` with `FormData` ("file" field, JPG/PNG/WebP, <= 2 MB).
  - Returns `{ avatarUrl }`.
  - **Immediate local state update**: `setAvatarUrl(data.avatarUrl)`.
  - **Immediate session refresh**: `refresh()` from `AuthContext` updates navbar avatar immediately.
  - Remove file: `DELETE /api/user/avatar`, clears `avatarUrl`, calls `refresh()`.
  - **Save Profile**: `PUT /api/user/profile` sends the current local `avatarUrl`. Because local state was updated upon upload, the newly uploaded avatar URL is never overwritten with stale data.
  - On save success: calls `refresh()`, redirects to `/dashboard`.

---

## 4. Polling & Concurrency Architecture (Chat)

To ensure smooth and dependable chat functionality:
1. **In-Flight Guard**: An `inFlightRef` boolean flag prevents overlapping requests. If a poll tick fires while the previous fetch is still running, the tick is dropped.
2. **Tab Visibility Pause/Resume**:
   - Listens to `visibilitychange` on `document`.
   - When `document.visibilityState === 'hidden'`, the polling timer is cleared.
   - When `document.visibilityState === 'visible'`, an immediate message fetch runs and the 3s interval is restarted.
3. **Active Match Switch Guard**:
   - `activeMatchIdRef` keeps track of the currently selected match.
   - When an asynchronous `loadMessages(matchId)` response resolves, if `matchId !== activeMatchIdRef.current`, the response is discarded.
4. **Scroll Preservation**:
   - Computes `isNearBottom = scrollHeight - scrollTop - clientHeight < 80`.
   - Automatically scrolls to bottom on user send or when switching conversations.
   - During background polling ticks, only scrolls if `isNearBottom` is true, avoiding yanking the scroll view away while reading older messages.
5. **Auth & Error Handling**:
   - If `GET /api/messages` returns 401, stops polling (auth context handles redirect).
   - If 403 or 404, stops polling for that match and displays an inline error alert.

---

## 5. Test Plan

### Unit & Component Tests (`client/src/test/`)
1. **`AddressSearch.test.jsx`**:
   - Input renders; search button disabled when < 3 characters.
   - Triggers search on Enter key and button click.
   - Ignores stale responses if another search was triggered.
   - Renders search results and triggers `onSelect` with 6-decimal rounded coordinates.
   - Renders OpenStreetMap attribution link.
   - Shows clear button when `selectedLabel` is provided.
2. **`ChatPage.test.jsx`**:
   - Renders conversation list; search input filters conversations by name/skill.
   - Selects conversation from URL query `?matchId=...`.
   - Loads and displays messages for active match.
   - Polling: fetches messages on interval (fake timers).
   - In-flight guard: does not fire duplicate requests when previous is pending.
   - Pauses polling when document is hidden and resumes on visible.
   - Discards messages from stale conversation when user switches quickly.
   - Sending: trims text, disables button while submitting, clears on success, preserves on error (e.g. 429).
3. **`ReviewsPage.test.jsx`**:
   - Reads `toUserId` and `name` from query params; shows empty card if missing.
   - Loads peer profile and review list.
   - Renders star rating selector (1-5 stars) with interactive hover and click states.
   - Submits review via `POST /api/reviews`; updates review list on success.
   - Displays "You have already reviewed this person" if `viewer.hasReviewed === true` or upon 409 Conflict.
   - Handles 403, 400, and 429 error responses.
   - Renders "Load more" button if `pagination.hasNextPage`.
4. **`ProfileSetupPage.test.jsx`**:
   - Loads initial profile and available skills.
   - Adds and removes teach skills with proficiency levels.
   - Adds and removes learn skills.
   - Uploads avatar: sends `FormData`, immediately updates preview and state.
   - Verifies subsequent "Save Profile" submits the newly uploaded `avatarUrl` (race condition test).
   - Removes avatar: sends `DELETE /api/user/avatar`, clears preview.
   - Location search: integrates `AddressSearch`, updates coordinates and location label.
   - Submits profile update via `PUT /api/user/profile`, refreshes auth, and redirects.

### Real Server Verification (`client/scripts/m4a-check.mjs`)
- Runs against `http://localhost:5173` with Vite proxy forwarding `/api` to Express on port 4000.
- Authenticates as `alex@example.com`.
- Tests:
  - `GET /api/conversations`: 200, returns array.
  - `GET /api/messages?matchId=<owned>`: 200, returns messages array.
  - `GET /api/messages?matchId=<invalid>`: 403 / 404 rejection.
  - `GET /api/user/profile`: 200, returns user without password hash.
  - `GET /api/geocode?q=a`: 400 rejection (too short).
  - `POST /api/user/avatar` with invalid fake file: 400 rejection.
  - `GET /api/avatars/..%2Fescape`: 400 rejection (path traversal guard).
  - `POST /api/reviews` duplicate review for Priya Patel: 409 conflict.
- **Zero database mutations** (asserts row counts remain strictly 81).

---

## 6. Verification Checklist & Quality Gates
- [ ] `npm --prefix client run lint` -> 0 errors, 0 warnings
- [ ] `npm --prefix client test` -> all tests pass (27 existing + new test suites)
- [ ] `npm --prefix client run build` -> exits 0, production bundle created in `client/dist/`
- [ ] Express server (port 4000) and Vite dev server (port 5173) start cleanly
- [ ] `node client/scripts/m4a-check.mjs` -> all assertions pass
- [ ] `node client/scripts/smoke-check.mjs` -> all 21 assertions pass
- [ ] 8 root server check scripts (161 assertions) pass
- [ ] Server gates: `npm --prefix server run lint`, `npm --prefix server test` (163 pass)
- [ ] Legacy Next.js gates: `npm run lint`, `npx vitest run src/lib` (121 pass), `npm run build` (exit 0)
- [ ] Database row count: strictly **81 rows** across all 9 tables
- [ ] `PROJECT_STATUS.md` and `docs/DECISIONS.md` updated

