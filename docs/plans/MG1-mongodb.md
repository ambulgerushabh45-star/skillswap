# MG1: MongoDB Migration Plan

## 1. Goal & Context
Migrate SkillSwap's data layer from SQLite (`prisma/dev.db`, 81 rows) to MongoDB using Prisma's MongoDB connector.
The local MongoDB replica set `rs0` is active on port `27018` with `MONGODB_URL="mongodb://127.0.0.1:27018/skillswap?replicaSet=rs0&directConnection=true"`.
All API routes, response shapes, validation rules, rate limits, and check script expectations must remain 100% identical.

## 2. Schema Conversion Table
All models retain UUID string primary keys mapped to MongoDB's `_id` field via `@map("_id")`. All foreign keys remain plain `String` fields (no `@db.ObjectId`), ensuring 100% ID compatibility with the existing SQLite dataset.

| Model | SQLite Schema (`dev.db`) | MongoDB Schema (`schema.prisma`) | Notes |
|---|---|---|---|
| `User` | `id String @id @default(uuid())` | `id String @id @default(uuid()) @map("_id")` | Plain UUID string; unique email |
| `Skill` | `id String @id @default(uuid())` | `id String @id @default(uuid()) @map("_id")` | Unique name, category |
| `UserSkillsTeach` | `id String @id @default(uuid())`, `userId String`, `skillId String` | `id String @id @default(uuid()) @map("_id")`, `userId String`, `skillId String` | `@@unique([userId, skillId])`, `@@index([skillId])` |
| `UserSkillsLearn` | `id String @id @default(uuid())`, `userId String`, `skillId String` | `id String @id @default(uuid()) @map("_id")`, `userId String`, `skillId String` | `@@unique([userId, skillId])`, `@@index([skillId])` |
| `Match` | `id String @id @default(uuid())`, `userAId String`, `userBId String`, `matchedSkillId String` | `id String @id @default(uuid()) @map("_id")`, `userAId String`, `userBId String`, `matchedSkillId String` | **NEW:** `@@unique([userAId, userBId, matchedSkillId])`, indexes preserved |
| `Event` | `id String @id @default(uuid())`, `hostId String` | `id String @id @default(uuid()) @map("_id")`, `hostId String` | Float lat/lng, maxAttendees, cancelledAt, indexes preserved |
| `EventAttendee` | `id String @id @default(uuid())`, `eventId String`, `userId String` | `id String @id @default(uuid()) @map("_id")`, `eventId String`, `userId String` | `@@unique([eventId, userId])`, indexes preserved |
| `Review` | `id String @id @default(uuid())`, `fromUserId String`, `toUserId String` | `id String @id @default(uuid()) @map("_id")`, `fromUserId String`, `toUserId String` | **NEW:** `@@unique([fromUserId, toUserId])`, indexes preserved |
| `Message` | `id String @id @default(uuid())`, `matchId String`, `senderId String` | `id String @id @default(uuid()) @map("_id")`, `matchId String`, `senderId String` | Chronological indexes preserved |

- **Referential Integrity**: Prisma emulates relations and `onDelete: Cascade` rules in the client.
- **Enums**: `MatchStatus`, `AttendanceStatus`, and `ProficiencyLevel` mapped as native string enums.

## 3. Code Modifications Required
1. **Server Environment Configuration (`server/src/config/env.js`)**:
   - Replace `DATABASE_URL` with `MONGODB_URL`.
   - Validate that `MONGODB_URL` starts with `mongodb://` or `mongodb+srv://`.
   - Extract database name for logging without printing credentials or host strings.
   - Remove SQLite file-path resolution logic.
2. **Server Entrypoint (`server/src/index.js`)**:
   - Log `Database: <dbname>` on startup without printing credentials.
3. **Prisma Client (`server/src/db/prisma.js`)**:
   - Initialize `PrismaClient` with `datasources: { db: { url: config.MONGODB_URL } }`.
4. **Seed Script (`server/scripts/seed.mjs` and `prisma/seed.js`)**:
   - Refuse to run if any users exist in the database.
   - Support `MONGODB_URL`.
5. **Backup Export Script (`server/scripts/export-backup.mjs`)**:
   - Export all 9 collections to JSON files in `../skillswap-backups/<timestamp>`.
   - Redact password hashes in logs.

## 4. Transaction Analysis
- SkillSwap uses `$transaction` in two key locations:
  1. `server/src/routes/events.js`: RSVP capacity guard inside `$transaction(async (tx) => { ... })`.
  2. `server/src/routes/reviews.js`: Review duplicate guard inside `$transaction(async (tx) => { ... })`.
- With replica set `rs0` configured and verified, interactive Prisma transactions work out-of-the-box.
- Added compound unique constraints (`Match(userAId, userBId, matchedSkillId)` and `Review(fromUserId, toUserId)`) provide dual database-level and application-level race safety.

## 5. Test Database Harness Strategy
- Helper module `server/scripts/test-db-helper.mjs`:
  - Parses `MONGODB_URL` and generates a dedicated scratch database name: `skillswap_test_<timestamp>`.
  - Enforces safety guard: ONLY databases containing `_test_` can ever be dropped.
  - Pushes schema to the scratch database via `prisma db push`.
  - Optionally seeds data via migration script.
  - Spawns test server instances on specified ports (e.g. 4100).
  - Drops the scratch database on completion.

## 6. Data Migration Script (`server/scripts/migrate-sqlite-to-mongo.mjs`)
- Uses built-in `node:sqlite` in read-only mode to extract records from `prisma/dev.db`.
- Converts date values (ISO strings or timestamps) to JavaScript `Date` objects.
- Retains all UUID string primary keys and foreign key references.
- **Dry-Run by Default**:
  - Prints source row counts per table (expected 81 total).
  - Validates foreign keys (no dangling references).
  - Checks for duplicate entries against the new unique constraints.
  - Validates enums.
- **With `--apply`**:
  - Refuses to write if the target database is not empty.
  - Inserts in topological order: `User`, `Skill`, `UserSkillsTeach`, `UserSkillsLearn`, `Match`, `Event`, `EventAttendee`, `Review`, `Message`.
  - Verifies target counts match source counts (81 total).
  - Tests bcrypt password verification for `alex@example.com` / `password123` against the imported hash without ever printing the hash.

## 7. Risks & Rollback Strategy
- `prisma/dev.db` remains 100% untouched as a read-only archive (backed up to `D:\dev.db.backup19`).
- `docs/legacy/schema.sqlite.prisma` preserved for SQLite reference.
- Main database `skillswap` on port 27018 remains empty until the owner explicitly runs `--apply`.
- All automated test runs execute against ephemeral scratch databases named `_test_`.

## 8. Verification Checklist
- [ ] Server lint: 0 errors, 0 warnings.
- [ ] Client lint: 0 errors, 0 warnings; client build exits 0.
- [ ] Migration dry-run against SQLite passes with 81 rows validated.
- [ ] Scratch database test with `--apply` imports exactly 81 rows and verifies bcrypt hash.
- [ ] Full server check suite passes against scratch database.
- [ ] Concurrency tests pass (RSVP capacity guard + Review deduplication).
- [ ] Main database on 27018 has schema pushed and remains 0 documents.
- [ ] `prisma/dev.db` verified byte-identical.

