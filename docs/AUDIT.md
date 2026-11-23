# SkillSwap — Comprehensive Codebase Audit (Task P0.1)

**Audit Date:** 2026-10-22  
**Auditor:** Antigravity AI Assistant  
**Repository:** `ambulgerushabh45-star/skillswap`  
**Purpose:** Single comprehensive baseline audit comparing `PROJECT_STATUS.md` against the actual implementation in `d:\project`.

---

## 1. Package & Dependency Audit (`package.json`)

### Exact Scripts
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```
*Note: There is currently **no `test` script** defined, and no testing frameworks (Jest, Vitest, Playwright, Cypress) are installed.*

### Exact Production Dependencies (`dependencies`)
| Package | Version in `package.json` | Purpose |
| :--- | :--- | :--- |
| `@prisma/client` | `6.4.0` | Prisma ORM database client |
| `@radix-ui/react-avatar` | `^1.2.6` | Radix UI Avatar primitive |
| `@radix-ui/react-dialog` | `^1.1.23` | Radix UI Modal dialog primitive |
| `@radix-ui/react-scroll-area` | `^1.2.18` | Radix UI Custom scrollbar container |
| `@radix-ui/react-select` | `^2.3.7` | Radix UI Dropdown select primitive |
| `@radix-ui/react-slot` | `^1.3.3` | Polymorphic component primitive (`asChild`) |
| `@radix-ui/react-tabs` | `^1.1.21` | Radix UI Tabbed interface primitive |
| `@types/leaflet` | `^1.9.22` | TypeScript definitions for Leaflet |
| `bcryptjs` | `^3.0.3` | Password hashing (cost factor 10) |
| `class-variance-authority` | `^0.7.1` | Component variant management (shadcn) |
| `clsx` | `^2.1.1` | Conditional classNames utility |
| `leaflet` | `^1.9.4` | OpenStreetMap client rendering |
| `lucide-react` | `^1.31.0` | UI vector iconography |
| `next` | `16.3.0` | Full-stack Next.js App Router framework |
| `next-auth` | `^4.24.15` | Authentication (Credentials + OAuth) |
| `react` | `19.2.8` | React UI library |
| `react-dom` | `19.2.8` | React DOM renderer |
| `react-hook-form` | `^7.85.0` | Form state management |
| `socket.io` | `^4.8.3` | WebSockets engine (**installed but unused**) |
| `socket.io-client` | `^4.8.3` | Client WebSocket connection (**installed but unused**) |
| `tailwind-merge` | `^3.6.0` | Tailwind class conflict resolution |
| `zod` | `^4.4.3` | Schema validation (**installed but unused in code**) |

### Exact Dev Dependencies (`devDependencies`)
| Package | Version in `package.json` | Purpose |
| :--- | :--- | :--- |
| `@tailwindcss/postcss` | `^4` | PostCSS plugin for Tailwind v4 |
| `@types/bcryptjs` | `^2.4.6` | TypeScript definitions for bcryptjs |
| `@types/node` | `^20` | Node.js runtime type definitions |
| `@types/react` | `^19` | React 19 type definitions |
| `@types/react-dom` | `^19` | React DOM 19 type definitions |
| `eslint` | `^9` | ESLint static analyzer |
| `eslint-config-next` | `16.3.0` | Next.js core web vitals lint configs |
| `prisma` | `6.4.0` | Prisma CLI compiler & migration tool |
| `tailwindcss` | `^4` | Tailwind CSS v4 styling engine |
| `typescript` | `^5` | TypeScript compiler |

---

## 2. Database Schema Audit (`prisma/schema.prisma`)

* **Datasource Provider:** `sqlite`
* **URL:** `env("DATABASE_URL")` (defaults to `file:./dev.db`)
* **Total Models:** **9 models** *(PROJECT_STATUS.md previously reported 8)*
* **Enums:** **0 enums**. All categorical and status states are stored as unconstrained `String` primitives with application-level defaults.

### Model-by-Model Breakdown

#### 1. `User`
* **Fields:**
  * `id`: `String` `@id @default(uuid())`
  * `name`: `String`
  * `email`: `String @unique`
  * `passwordHash`: `String?` (nullable for OAuth users)
  * `bio`: `String?`
  * `location`: `String?`
  * `avatarUrl`: `String?`
  * `createdAt`: `DateTime @default(now())`
  * `updatedAt`: `DateTime @updatedAt`
* **Relations:**
  * `skillsTeach`: `UserSkillsTeach[]`
  * `skillsLearn`: `UserSkillsLearn[]`
  * `matchesAsUserA`: `Match[]` (`@relation("UserAMatches")`)
  * `matchesAsUserB`: `Match[]` (`@relation("UserBMatches")`)
  * `hostedEvents`: `Event[]` (`@relation("HostedEvents")`)
  * `attendances`: `EventAttendee[]`
  * `reviewsGiven`: `Review[]` (`@relation("ReviewsGiven")`)
  * `reviewsReceived`: `Review[]` (`@relation("ReviewsReceived")`)
  * `messages`: `Message[]`

#### 2. `Skill`
* **Fields:**
  * `id`: `String @id @default(uuid())`
  * `name`: `String @unique`
  * `category`: `String` (e.g. Programming, Music, Languages, Design)
* **Relations:**
  * `teachers`: `UserSkillsTeach[]`
  * `learners`: `UserSkillsLearn[]`
  * `matches`: `Match[]`

#### 3. `UserSkillsTeach`
* **Fields:**
  * `id`: `String @id @default(uuid())`
  * `userId`: `String`
  * `skillId`: `String`
  * `proficiency`: `String` (e.g., "Beginner", "Intermediate", "Advanced", "Expert")
* **Foreign Keys & onDelete:**
  * `user`: `User` (`fields: [userId], references: [id], onDelete: Cascade`)
  * `skill`: `Skill` (`fields: [skillId], references: [id], onDelete: Cascade`)
* **Constraints:** `@@unique([userId, skillId])`

#### 4. `UserSkillsLearn`
* **Fields:**
  * `id`: `String @id @default(uuid())`
  * `userId`: `String`
  * `skillId`: `String`
* **Foreign Keys & onDelete:**
  * `user`: `User` (`fields: [userId], references: [id], onDelete: Cascade`)
  * `skill`: `Skill` (`fields: [skillId], references: [id], onDelete: Cascade`)
* **Constraints:** `@@unique([userId, skillId])`

#### 5. `Match`
* **Fields:**
  * `id`: `String @id @default(uuid())`
  * `userAId`: `String`
  * `userBId`: `String`
  * `matchedSkillId`: `String`
  * `status`: `String @default("PENDING")` (Expected: PENDING, ACCEPTED, DECLINED)
  * `createdAt`: `DateTime @default(now())`
* **Foreign Keys & onDelete:**
  * `userA`: `User` (`@relation("UserAMatches", fields: [userAId], references: [id], onDelete: Cascade)`)
  * `userB`: `User` (`@relation("UserBMatches", fields: [userBId], references: [id], onDelete: Cascade)`)
  * `matchedSkill`: `Skill` (`fields: [matchedSkillId], references: [id], onDelete: Cascade`)
  * `messages`: `Message[]`

#### 6. `Event`
* **Fields:**
  * `id`: `String @id @default(uuid())`
  * `hostId`: `String`
  * `title`: `String`
  * `description`: `String`
  * `location`: `String`
  * `lat`: `Float?`
  * `lng`: `Float?`
  * `dateTime`: `DateTime`
  * `createdAt`: `DateTime @default(now())`
* **Foreign Keys & onDelete:**
  * `host`: `User` (`@relation("HostedEvents", fields: [hostId], references: [id], onDelete: Cascade)`)
  * `attendees`: `EventAttendee[]`

#### 7. `EventAttendee`
* **Fields:**
  * `id`: `String @id @default(uuid())`
  * `eventId`: `String`
  * `userId`: `String`
  * `status`: `String @default("GOING")` (Expected: GOING, MAYBE, CANCELLED)
* **Foreign Keys & onDelete:**
  * `event`: `Event` (`fields: [eventId], references: [id], onDelete: Cascade`)
  * `user`: `User` (`fields: [userId], references: [id], onDelete: Cascade`)
* **Constraints:** `@@unique([eventId, userId])`

#### 8. `Review`
* **Fields:**
  * `id`: `String @id @default(uuid())`
  * `fromUserId`: `String`
  * `toUserId`: `String`
  * `rating`: `Int` (1 to 5)
  * `comment`: `String`
  * `createdAt`: `DateTime @default(now())`
* **Foreign Keys & onDelete:**
  * `fromUser`: `User` (`@relation("ReviewsGiven", fields: [fromUserId], references: [id], onDelete: Cascade)`)
  * `toUser`: `User` (`@relation("ReviewsReceived", fields: [toUserId], references: [id], onDelete: Cascade)`)

#### 9. `Message`
* **Fields:**
  * `id`: `String @id @default(uuid())`
  * `matchId`: `String`
  * `senderId`: `String`
  * `content`: `String`
  * `createdAt`: `DateTime @default(now())`
* **Foreign Keys & onDelete:**
  * `match`: `Match` (`fields: [matchId], references: [id], onDelete: Cascade`)
  * `sender`: `User` (`fields: [senderId], references: [id], onDelete: Cascade`)

---

## 3. Environment Variables Audit (`.env` vs `.env.example`)

*(Security Notice: Secret values are omitted in compliance with AGENT_RULES)*

| Variable Name | Present in `.env` | Present in `.env.example` | Purpose & Usage in Codebase |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | Yes | Yes | Prisma connection string (`file:./dev.db`) |
| `NEXTAUTH_SECRET` | Yes | Yes | Used by `src/lib/auth.ts` for JWT signing/encryption |
| `NEXTAUTH_URL` | Yes | Yes | Base URL for NextAuth callbacks |
| `GOOGLE_CLIENT_ID` | Yes | Yes | Google OAuth provider in `src/lib/auth.ts` |
| `GOOGLE_CLIENT_SECRET` | Yes | Yes | Google OAuth provider in `src/lib/auth.ts` |
| `NEXT_PUBLIC_MAP_PROVIDER` | Yes | Yes | Map provider switch ("leaflet") |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **No** | **Yes** | Scaffolding in `.env.example`; not active in current Leaflet setup |
| `PORT` | Yes | Yes | Target dev server port (set to 3000) |
| `NEXT_PUBLIC_APP_URL` | Yes | Yes | Base client application URL |

---

## 4. API Routes Security & Validation Audit

The table below catalogs every API route in `src/app/api`, detailing authentication checks, schema validation status, and resource ownership enforcement.

| Path | Methods | Checks Session? | Validates Input with Zod? | Checks Resource Ownership? | Audit Notes & Hardening Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `/api/auth/[...nextauth]` | `GET`, `POST` | Managed by NextAuth | **No** | N/A | NextAuth dynamic handler. Credentials checked with bcrypt in `auth.ts`. |
| `/api/auth/register` | `POST` | **No** (Public) | **No** (Manual `if` checks) | N/A | Validates email, name, password (len >= 6). Hashes with bcryptjs cost 10. |
| `/api/conversations` | `GET` | **Yes** (`requireSession()`) | **No** (No body/params) | **Yes** | Filters matches where `userAId == user.id OR userBId == user.id`. |
| `/api/events` | `GET` | Optional (Public read) | **No** | N/A | Allows public reading of events; annotates `isGoing` and `isHost` if logged in. |
| `/api/events` | `POST` | **Yes** (`requireSession()`) | **No** (Manual `if` checks) | **Yes** | Host strictly set to `auth.user.id`. Creates initial `EventAttendee` with `GOING`. |
| `/api/events/[id]/rsvp` | `POST` | **Yes** (`requireSession()`) | **No** | **Yes** | Verifies event exists (404), toggles RSVP strictly for authenticated `user.id`. |
| `/api/matches` | `GET` | **Yes** (`requireSession()`) | **No** | **Yes** | Returns computed match recommendations relative to authenticated user. |
| `/api/matches` | `POST` | **Yes** (`requireSession()`) | **No** (Manual check) | **Yes** | Requester strictly set to `auth.user.id`. Blocks self-connect (400), checks target exists (404), handles duplicates. |
| `/api/matches/[id]` | `PATCH` | **Yes** (`requireSession()`) | **No** (Manual array check) | **Yes** (P2.1) | Verified via `getMatchForParticipant` (403 for non-participants). Only recipient (`userBId`) can set `ACCEPTED` or `DECLINED` (403 for requester). |
| `/api/messages` | `GET` | **Yes** (`requireSession()`) | **No** | **Yes** (P2.1) | Verified via `getMatchForParticipant`: caller must be `userAId` or `userBId` (403 for non-participants). |
| `/api/messages` | `POST` | **Yes** (`requireSession()`) | **No** (Manual check) | **Yes** (P2.1) | Verified via `getMatchForParticipant` (403 for non-participants). Sender strictly derived from session (`auth.user.id`). |
| `/api/reviews` | `GET` | **No** (Public query) | **No** | N/A | Public query of reviews received by `toUserId`. |
| `/api/reviews` | `POST` | **Yes** (`requireSession()`) | **No** (Manual `if` checks) | **Yes** (P2.1) | Reviewer strictly derived from session (`auth.user.id`). Blocks self-review (400). Requires prior `ACCEPTED` match between reviewer and reviewee (403 otherwise). |
| `/api/skills` | `GET` | **No** (Public) | **No** | N/A | Public listing of existing skills in DB; auto-seeds if empty. |
| `/api/skills` | `POST` | **Yes** (`requireSession()`, P2.1) | **No** (Manual check) | N/A | Protected with session authentication guard (401 for unauthenticated visitors). |
| `/api/user/profile` | `GET` | **Yes** (`requireSession()`) | **No** | **Yes** (P2.1) | Returns own user profile. Sanitized field selection eliminates `passwordHash` leak. |
| `/api/user/profile` | `PUT` | **Yes** (`requireSession()`) | **No** (No schema check) | **Yes** (P2.1) | Updates own user bio, location, avatar, and skills. Sanitized field selection eliminates `passwordHash` leak. |

---

## 5. Frontend & UI Component Architecture

### Application Pages (`src/app/`)
* **`/` (`src/app/page.tsx`):** Landing page (Server Component) with hero section, feature cards, and navigation.
* **`/auth` (`src/app/auth/page.tsx`):** Client Component with login/signup tabs, wrapped in `<Suspense>` for search parameter safety.
* **`/dashboard` (`src/app/dashboard/page.tsx`):** Client Component. Match cards, filtering (all/mutual/connected), connect requests, links to `/chat`.
* **`/events` (`src/app/events/page.tsx`):** Client Component. Leaflet map integration, event list, RSVP toggle, event creation dialog.
* **`/chat` (`src/app/chat/page.tsx`):** Client Component. Two-panel responsive layout, active chat selection, 3-second HTTP REST polling.
* **`/reviews` (`src/app/reviews/page.tsx`):** Client Component. Star rating picker, written review submission, review history list.
* **`/profile/setup` (`src/app/profile/setup/page.tsx`):** Client Component. User onboarding and skill tag management.
* *Note: Route `/profile` or `/profile/[id]` (public peer view) does not exist yet.*

### Shared Components (`src/components/`)
* **`Navbar.tsx`:** Sticky navigation bar. Links to `/dashboard` and `/events`. **Missing link to `/chat` and `/reviews`**.
* **`MapView.tsx`:** Client-rendered dynamic Leaflet map with OpenStreetMap tiles and popups.
* **`CreateEventDialog.tsx`:** Radix Dialog modal for hosting new events with manual latitude/longitude coordinates.
* **`providers/AuthProvider.tsx`:** NextAuth `SessionProvider` wrapper.
* **`ui/` (11 shadcn components):** `avatar`, `badge`, `button`, `card`, `dialog`, `input`, `scroll-area`, `select`, `table`, `tabs`, `textarea`.

---

## 6. Discrepancies Found Against `PROJECT_STATUS.md`

1. **Model Count:** Section 3 in `PROJECT_STATUS.md` stated "8 models". The actual schema has **9 models** (`User`, `Skill`, `UserSkillsTeach`, `UserSkillsLearn`, `Match`, `Event`, `EventAttendee`, `Review`, `Message`).
2. **Zod Usage:** Section 2 listed "Validation: Zod 4, React Hook Form". While `zod` is installed in `package.json`, it is **not imported or used anywhere** in the codebase. All endpoints use manual `if (!field)` checks.
3. **Database Enums:** Section 3 did not explicitly document that the schema has 0 enums and relies entirely on unvalidated string fields for statuses (`PENDING`, `ACCEPTED`, `GOING`, `CANCELLED`).
4. **Dev Port Drift:** `.env` specifies `PORT=3000` and `NEXTAUTH_URL="http://localhost:3000"`, but the dev server is active on `http://localhost:3001` due to port 3000 being occupied.

---

## 7. Security & Code Quality Action Items

1. **Authorization Guards (Phase 2):** Fix ownership checks on `PATCH /api/matches/[id]`, `GET /api/messages`, `POST /api/messages`, and add auth check to `POST /api/skills`.
2. **Review Integrity (Phase 2):** Restrict reviews so they can only be submitted between users who have an `ACCEPTED` match.
3. **Zod Validation (Phase 2):** Introduce centralized request body and query param schemas using the installed `zod` package.
4. **ESLint Hygiene (Phase 1):** Resolve 16 errors (unescaped quotes in JSX and `any` types in Leaflet).
