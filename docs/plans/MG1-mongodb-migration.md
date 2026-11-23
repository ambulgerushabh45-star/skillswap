# MG1: MongoDB Migration & Schema Push

## 1. Task Goal & Context
The user requested connecting SkillSwap to MongoDB and pushing the Prisma schema via the terminal.
Currently, MongoDB 6.0 is running locally via Docker on `127.0.0.1:27017`.
SkillSwap currently uses Prisma with SQLite (`prisma/dev.db`).
This task migrates the Prisma datasource to MongoDB, maps all model IDs and foreign keys to `@db.ObjectId`, updates connection strings, pushes the schema to MongoDB (`npx prisma db push`), and regenerates the Prisma client.

## 2. Files to Touch
- `docs/plans/MG1-mongodb-migration.md` (this plan)
- `prisma/schema.prisma.sqlite.backup` (backup of SQLite schema)
- `prisma/schema.prisma` (update provider to `mongodb`, `@db.ObjectId` mappings)
- `.env` (root environment variables for Prisma CLI)
- `server/.env` (Express backend environment variables)
- `PROJECT_STATUS.md` (tracking task status)

## 3. Step-by-Step Implementation Steps
1. **Backup**:
   - Copy `prisma/schema.prisma` to `prisma/schema.prisma.sqlite.backup`.
   - Verify SQLite `prisma/dev.db` remains intact.
2. **Environment Variables**:
   - Update `DATABASE_URL` in `.env` to `mongodb://127.0.0.1:27017/skillswap`.
   - Update `DATABASE_URL` in `server/.env` to `mongodb://127.0.0.1:27017/skillswap`.
3. **Schema Transformation for MongoDB**:
   - Change `datasource db.provider` from `"sqlite"` to `"mongodb"`.
   - Change each model's primary key `id` from `String @id @default(uuid())` to `String @id @default(auto()) @map("_id") @db.ObjectId`.
   - Change every relation foreign key (`userId`, `skillId`, `userAId`, `userBId`, `matchedSkillId`, `hostId`, `eventId`, `fromUserId`, `toUserId`, `matchId`, `senderId`) from `String` to `String @db.ObjectId`.
4. **Push Schema via Terminal**:
   - Run `npx prisma db push`.
   - Run `npx prisma generate`.
5. **Verify Collections in MongoDB**:
   - Inspect MongoDB via `docker exec smart_city_mongodb mongosh skillswap --eval "show collections"`.
   - Verify all 9 collections are created.
6. **Documentation & Reporting**:
   - Report the terminal output and verification results to the user.

## 4. Verification Plan
- `npx prisma db push` exits 0 with message: "Your database is now in sync with your Prisma schema."
- `npx prisma generate` exits 0 with message: "Generated Prisma Client."
- Query MongoDB collections: `User`, `Skill`, `UserSkillsTeach`, `UserSkillsLearn`, `Match`, `Event`, `EventAttendee`, `Review`, `Message`.

