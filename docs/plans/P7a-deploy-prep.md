# Phase 7a Execution Plan: Deployment Preparation, Accept/Decline UI, Avatars in MongoDB & Data Tools

## 1. Task Overview & Goals
Phase 7a prepares SkillSwap for production hosting on Render and MongoDB Atlas:
1. **Part A: Accept / Decline UI Gap**: Resolve the UI limitation where recipients have no interface to accept or decline pending match requests. Add additive `requestDirection` ("SENT" | "RECEIVED" | null) fields to backend endpoints without breaking existing API contracts, wire Accept/Decline buttons into Dashboard, Profile, and Chat pages with proper status updates and error handling.
2. **Part B: Avatars in MongoDB**: Introduce the `AvatarFile` model into `prisma/schema.prisma` to store avatars as binary documents in MongoDB (`Bytes`), enabling uploads to persist on diskless/ephemeral serverless hosts. Implement `MongoAvatarStorage` with `AVATAR_STORAGE="mongo"` default (and "disk" fallback). Author `migrate-avatars-to-db.mjs`.
3. **Part C: Production Data Tools**: Build `server/scripts/import-backup.mjs` for dry-run and applied restoration of backups (with `--skills-only` option for clean production setups). Hide the "Fill demo credentials" button in production client builds.
4. **Part D: Deployment Preparation**: Specify Node engines in `package.json`, craft `render.yaml` Blueprint for Render web service deployment, document single-instance constraints, prove the build from scratch in a temporary clean directory (`../skillswap-deploy-test`), and author a beginner-friendly click-by-click deployment guide (`docs/DEPLOYMENT.md`).

---

## 2. Part A: Verification Findings (A1)
A thorough audit of `client/src/pages/DashboardPage.jsx`, `client/src/pages/ProfileDetailPage.jsx`, `client/src/pages/ChatPage.jsx`, `server/src/routes/matches.js`, `server/src/routes/conversations.js`, and `server/src/routes/users.js` revealed:
1. **Accept / Decline Controls Missing**:
   - `DashboardPage.jsx`: Renders a disabled `<Button variant="outline" disabled>Pending Request</Button>` whenever `peer.connectionStatus === 'PENDING'`. There is no Accept or Decline control anywhere on the dashboard.
   - `ProfileDetailPage.jsx`: Renders a disabled `<Button size="sm" disabled variant="outline">Request Pending</Button>` whenever `viewer.matchStatus === 'PENDING'`. There is no Accept or Decline control on the profile.
   - `ChatPage.jsx`: Renders no banner, no indication of whether the connection request is pending or who sent it, and no Accept/Decline controls.
2. **Missing Directional Metadata from API Responses**:
   - `GET /api/matches`: Does not return who initiated the match; only returns `connectionStatus: 'PENDING'` and `matchId`.
   - `GET /api/conversations`: Returns `status: 'PENDING'` and `peerId`, but does not specify whether the logged-in user is `userAId` (requester) or `userBId` (recipient).
   - `GET /api/users/:id`: Returns `viewer.matchStatus: 'PENDING'` and `viewer.matchId`, but does not specify whether the viewer was the sender or recipient of the request.

---

## 3. Architecture & Technical Designs

### Part A: Additive Direction Fields & UI Controls
1. **Helper Function `determineRequestDirection({ userAId, userBId, currentUserId, status })`**:
   - If `status !== 'PENDING'`, returns `null`.
   - If `currentUserId === userAId`, returns `'SENT'`.
   - If `currentUserId === userBId`, returns `'RECEIVED'`.
   - Otherwise, returns `null`.
2. **API Additive Fields**:
   - `GET /api/matches`: Each match object includes `requestDirection: "SENT" | "RECEIVED" | null`.
   - `GET /api/conversations`: Each conversation object includes `requestDirection: "SENT" | "RECEIVED" | null`.
   - `GET /api/users/:id`: `viewer.requestDirection: "SENT" | "RECEIVED" | null`.
3. **UI Implementation**:
   - `DashboardPage`:
     - If `peer.connectionStatus === 'PENDING'` and `peer.requestDirection === 'RECEIVED'`:
       - Show badge: `"Wants to swap with you"` (indigo/amber accent).
       - Show two action buttons: **Accept** (calls `PATCH /api/matches/:id` with `{ status: "ACCEPTED" }`) and **Decline** (calls `PATCH /api/matches/:id` with `{ status: "DECLINED" }`).
       - On accept: updates state to connected, shows "Message Chat" button.
       - On decline: updates card to show "Declined" badge.
     - If `peer.requestDirection === 'SENT'`: keep "Pending Request" disabled button.
   - `ProfileDetailPage`:
     - If `viewer.matchStatus === 'PENDING'` and `viewer.requestDirection === 'RECEIVED'`:
       - Show **Accept** and **Decline** buttons.
     - If `viewer.requestDirection === 'SENT'`: show "Request Pending".
   - `ChatPage`:
     - If `activeConversation.status === 'PENDING'` and `activeConversation.requestDirection === 'RECEIVED'`:
       - Show banner: `"<Peer Name> wants to swap skills with you"` with **Accept** and **Decline** buttons.
       - Disable chat input with placeholder: `"Accept the request to reply."`
     - If `activeConversation.status === 'PENDING'` and `activeConversation.requestDirection === 'SENT'`:
       - Show hint banner: `"You can send up to 3 messages until the request is accepted."`
       - Display server 409 error cleanly if quota is reached.
     - If `activeConversation.status === 'DECLINED'`:
       - Show banner: `"This connection request was declined."`
       - Disable input form.

### Part B: Avatars in MongoDB
1. **Prisma Schema Update**:
   - Add model `AvatarFile` with strict UUID/mapped id:
     ```prisma
     model AvatarFile {
       id          String   @id @map("_id")
       userId      String
       contentType String
       size        Int
       data        Bytes
       createdAt   DateTime @default(now())

       @@index([userId])
       @@map("AvatarFile")
     }
     ```
2. **Storage Implementation (`server/src/lib/avatar-storage.js`)**:
   - Interface remains: `save(fileName, buffer, mimeType, userId)`, `read(fileName)`, `delete(fileName)`.
   - Implement `MongoAvatarStorage` querying `prisma.avatarFile`.
   - Retain `LocalDiskAvatarStorage` as fallback.
   - Select strategy based on `config.AVATAR_STORAGE` ("mongo" | "disk", default "mongo").
3. **Migration Script (`server/scripts/migrate-avatars-to-db.mjs`)**:
   - Scans `public/uploads/avatars/`.
   - Verifies file names with strict regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}\.webp$`.
   - Verifies `userId` exists in `User` collection.
   - Computes SHA256 before and after insertion.
   - Refuses overwrite. Default dry-run; `--apply` writes.

### Part C: Production Data Tools
1. **`server/scripts/import-backup.mjs`**:
   - Imports collections in topological order: `Skill`, `User`, `UserSkillsTeach`, `UserSkillsLearn`, `Match`, `Event`, `EventAttendee`, `Review`, `Message`.
   - Refuses if destination database contains any documents.
   - `--skills-only` flag imports only `Skill` collection.
   - Default dry run validates schemas and relations without writing.
   - `--apply` applies writes in batches.
2. **Production Credentials Button**:
   - In `client/src/pages/AuthPage.jsx`: wrap "Demo Credentials" quick-fill button with `!import.meta.env.PROD` check.

### Part D: Deployment Blueprint & Guide
1. **`render.yaml`**:
   - Type: `web`
   - Node 22 environment.
   - Build command: `npm --prefix server install && npm --prefix client install && npx prisma generate --schema=prisma/schema.prisma && npm --prefix client run build`
   - Start command: `node scripts/start.mjs`
   - Health check: `/api/health`
   - Env vars: `NODE_ENV=production`, `MONGODB_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `TRUST_PROXY=true`, `AVATAR_STORAGE=mongo`, `NOMINATIM_USER_AGENT`.
2. **Clean Scratch Build Proof**:
   - Copy workspace to `../skillswap-deploy-test` omitting `.env`, `node_modules`, `dist`, `storage`, and `backups`.
   - Run build and prod smoke check.
   - Remove temporary test folder.
3. **Documentation**:
   - Author `docs/DEPLOYMENT.md` covering Atlas setup, initial data population, Render deployment, troubleshooting, and rollback.

---

## 4. Verification Plan & Quality Gates
- **Server Unit Tests**: Test `determineRequestDirection` and `MongoAvatarStorage`.
- **Client Unit Tests**: Test Accept/Decline button rendering, click handlers, error states, and demo credential visibility in dev/prod.
- **Server Checks (`npm run check`)**: Run all 11 scripts against scratch DB.
- **Integration Test**: Scratch database test verifying A requests B -> B accepts -> both message -> review submitted successfully (201) -> duplicate review rejected (409).
- **Avatar MongoDB Check**: Verify avatar upload, retrieval, and deletion using `AVATAR_STORAGE=mongo`.
- **Import Backup Test**: Verify full import and `--skills-only` import on separate scratch databases.
- **Clean Main DB Verification**: Verify 81 original documents remain intact + empty `AvatarFile` collection.

