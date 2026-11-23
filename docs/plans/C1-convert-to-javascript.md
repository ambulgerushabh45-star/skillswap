# C1 — Convert Project from TypeScript to Plain JavaScript (JSX)

> Task ID: C1  
> Date: 2026-11-06  
> Single Source of Truth: `PROJECT_STATUS.md`  
> Baseline Snapshot Prefix: `baseline-c1`  
> Backup Paths:  
> - Project: `D:\skillswap-ts-backup` (complete copy excluding `node_modules` and `.next`)  
> - Database: `D:\dev.db.backup12` (167,936 bytes copy of `prisma/dev.db`)

---

## 1. Goal & Architectural Principle

Convert the entire SkillSwap project from TypeScript to plain JavaScript (JSX) while preserving Next.js 16, React 19, Prisma 6.4, and all functionality exactly as they are.
- **NO BEHAVIOR CHANGE**: Every page, route, JSON response shape, validation rule, rate limit, error format, and UI component behavior remains 100% identical.
- **Runtime Validation Preserved**: All Zod 4 schemas and runtime checks in `src/lib/validators/` and `src/lib/api-error.js` are preserved as active runtime validators.
- **TypeScript Removal**: Eliminate all compile-time types, interfaces, type aliases, generic type parameters, `as` type casts, `satisfies`, non-null assertions (`!`), `import type`, `*.d.ts` declaration files, and TS-only tooling.
- **Path Alias `@/*`**: Configured in `jsconfig.json` pointing to `./src/*`.
- **Database Safety**: Never reset or delete the database. `prisma/dev.db` is backed up to `D:\dev.db.backup12` before any modifications.

---

## 2. File Inventory Grouped by Area

Total TypeScript files to convert or remove: **76 files** (51 `.ts` + 25 `.tsx`).

### Area 1: Root Config & Seed (5 files)
- `tsconfig.json` -> replace with `jsconfig.json`, remove `tsconfig.json` & `tsconfig.tsbuildinfo`
- `next-env.d.ts` -> remove
- `next.config.ts` -> `next.config.mjs`
- `vitest.config.ts` -> `vitest.config.js`
- `prisma/seed.ts` -> `prisma/seed.js`
- `eslint.config.mjs` -> remove TS rules/parser, keep Next.js core web vitals and React hooks
- `package.json` -> update `"prisma": { "seed": "node prisma/seed.js" }`, remove tsc references

### Area 2: Type Definition Files (1 file)
- `src/types/next-auth.d.ts` -> remove (declarations not needed in JavaScript)

### Area 3: `src/lib` Pure Logic & Validators (23 files)
- `src/lib/utils.ts` -> `src/lib/utils.js`
- `src/lib/prisma.ts` -> `src/lib/prisma.js`
- `src/lib/api-error.ts` -> `src/lib/api-error.js`
- `src/lib/api-auth.ts` -> `src/lib/api-auth.js`
- `src/lib/auth.ts` -> `src/lib/auth.js`
- `src/lib/avatar-storage.ts` -> `src/lib/avatar-storage.js`
- `src/lib/avatar.ts` -> `src/lib/avatar.js`
- `src/lib/geo.ts` -> `src/lib/geo.js`
- `src/lib/geocode.ts` -> `src/lib/geocode.js`
- `src/lib/matching.ts` -> `src/lib/matching.js`
- `src/lib/pagination.ts` -> `src/lib/pagination.js`
- `src/lib/profile-view.ts` -> `src/lib/profile-view.js`
- `src/lib/rate-limit.ts` -> `src/lib/rate-limit.js`
- `src/lib/validators/auth.ts` -> `src/lib/validators/auth.js`
- `src/lib/validators/events.ts` -> `src/lib/validators/events.js`
- `src/lib/validators/geocode.ts` -> `src/lib/validators/geocode.js`
- `src/lib/validators/index.ts` -> `src/lib/validators/index.js`
- `src/lib/validators/matches.ts` -> `src/lib/validators/matches.js`
- `src/lib/validators/messages.ts` -> `src/lib/validators/messages.js`
- `src/lib/validators/pagination.ts` -> `src/lib/validators/pagination.js`
- `src/lib/validators/profile.ts` -> `src/lib/validators/profile.js`
- `src/lib/validators/reviews.ts` -> `src/lib/validators/reviews.js`
- `src/lib/validators/skills.ts` -> `src/lib/validators/skills.js`

### Area 4: `src/lib` Unit Tests (8 files)
- `src/lib/api-auth.test.ts` -> `src/lib/api-auth.test.js`
- `src/lib/avatar.test.ts` -> `src/lib/avatar.test.js`
- `src/lib/geo.test.ts` -> `src/lib/geo.test.js`
- `src/lib/geocode.test.ts` -> `src/lib/geocode.test.js`
- `src/lib/matching.test.ts` -> `src/lib/matching.test.js`
- `src/lib/pagination.test.ts` -> `src/lib/pagination.test.js`
- `src/lib/profile-view.test.ts` -> `src/lib/profile-view.test.js`
- `src/lib/rate-limit.test.ts` -> `src/lib/rate-limit.test.js`

### Area 5: API Routes in `src/app/api` (15 files)
- `src/app/api/auth/[...nextauth]/route.ts` -> `route.js`
- `src/app/api/auth/register/route.ts` -> `route.js`
- `src/app/api/avatars/[file]/route.ts` -> `route.js`
- `src/app/api/conversations/route.ts` -> `route.js`
- `src/app/api/events/route.ts` -> `route.js`
- `src/app/api/events/[id]/rsvp/route.ts` -> `route.js`
- `src/app/api/geocode/route.ts` -> `route.js`
- `src/app/api/matches/route.ts` -> `route.js`
- `src/app/api/matches/[id]/route.ts` -> `route.js`
- `src/app/api/messages/route.ts` -> `route.js`
- `src/app/api/reviews/route.ts` -> `route.js`
- `src/app/api/skills/route.ts` -> `route.js`
- `src/app/api/user/avatar/route.ts` -> `route.js`
- `src/app/api/user/profile/route.ts` -> `route.js`
- `src/app/api/users/[id]/route.ts` -> `route.js`

### Area 6: App Pages, Layouts, & Components (25 files)
#### Pages & Layouts (9 files):
- `src/app/layout.tsx` -> `src/app/layout.jsx`
- `src/app/page.tsx` -> `src/app/page.jsx`
- `src/app/auth/page.tsx` -> `src/app/auth/page.jsx`
- `src/app/chat/page.tsx` -> `src/app/chat/page.jsx`
- `src/app/dashboard/page.tsx` -> `src/app/dashboard/page.jsx`
- `src/app/events/page.tsx` -> `src/app/events/page.jsx`
- `src/app/profile/setup/page.tsx` -> `src/app/profile/setup/page.jsx`
- `src/app/profile/[id]/page.tsx` -> `src/app/profile/[id]/page.jsx`
- `src/app/reviews/page.tsx` -> `src/app/reviews/page.jsx`

#### Components & Providers (5 files):
- `src/components/providers/AuthProvider.tsx` -> `src/components/providers/AuthProvider.jsx`
- `src/components/AddressSearch.tsx` -> `src/components/AddressSearch.jsx`
- `src/components/CreateEventDialog.tsx` -> `src/components/CreateEventDialog.jsx`
- `src/components/MapView.tsx` -> `src/components/MapView.jsx`
- `src/components/Navbar.tsx` -> `src/components/Navbar.jsx`

#### UI Components in `src/components/ui` (11 files):
- `src/components/ui/avatar.tsx` -> `avatar.jsx`
- `src/components/ui/badge.tsx` -> `badge.jsx`
- `src/components/ui/button.tsx` -> `button.jsx`
- `src/components/ui/card.tsx` -> `card.jsx`
- `src/components/ui/dialog.tsx` -> `dialog.jsx`
- `src/components/ui/input.tsx` -> `input.jsx`
- `src/components/ui/scroll-area.tsx` -> `scroll-area.jsx`
- `src/components/ui/select.tsx` -> `select.jsx`
- `src/components/ui/table.tsx` -> `table.jsx`
- `src/components/ui/tabs.tsx` -> `tabs.jsx`
- `src/components/ui/textarea.tsx` -> `textarea.jsx`

---

## 3. Staged Conversion Plan & Order

### STAGE 0: BASELINE (Completed)
- Backed up project to `D:\skillswap-ts-backup` and database to `D:\dev.db.backup12`.
- Verified row counts: 81 rows total across 9 models.
- Took baseline API snapshots with `node scripts/take-snapshots.mjs baseline-c1`.
- Ran 8 check suites: security (20), validation (28), pagination (47), review (5), profile (13), geocode (12), distance (22), avatar (14). All passed.
- Recorded baseline tests: 121 tests passing across 8 test suites.
- Recorded build route list: 20 routes.

### STAGE 1: PLAN (This file)
- Documented file inventories, conversion sequence, config changes, risks, and stage quality gates.

### STAGE 2: CONFIGURATION
1. Create `jsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["./src/*"]
       },
       "jsx": "preserve"
     },
     "exclude": ["node_modules", ".next"]
   }
   ```
2. Convert `next.config.ts` to `next.config.mjs` (removing `import type { NextConfig }`).
3. Convert `vitest.config.ts` to `vitest.config.js`.
4. Update `eslint.config.mjs`: remove `eslint-config-next/typescript` import and spreading, keeping Next.js core web vitals and React hooks rules.
5. Update `package.json`:
   - Add `"prisma": { "seed": "node prisma/seed.js" }`.
6. Verify: `npm run lint` runs without errors on JS config.

### STAGE 3: `src/lib` AND UNIT TESTS
1. Convert all 10 validator files in `src/lib/validators/` to `.js`. Remove `z.infer<...>`, type imports/exports. Keep all schema definitions intact.
2. Convert all 13 logic files in `src/lib/` to `.js` (`utils.js`, `prisma.js`, `api-error.js`, `api-auth.js`, `auth.js`, `avatar-storage.js`, `avatar.js`, `geo.js`, `geocode.js`, `matching.js`, `pagination.js`, `profile-view.js`, `rate-limit.js`).
   - Remove TypeScript-specific syntax: type annotations, interfaces, generics, type casts (`as ...`), non-null assertions (`!`).
   - Remove `src/types/next-auth.d.ts`.
3. Convert all 8 test files in `src/lib/*.test.ts` to `*.test.js`.
4. Delete old `.ts` files in `src/lib`.
5. Run `npm test`: exact 121 tests must pass across all 8 test suites.

### STAGE 4: API ROUTES (`src/app/api`)
1. Convert all 15 `src/app/api/**/route.ts` files to `route.js`.
   - Strip NextRequest/NextResponse type parameters (e.g., `NextRequest`, `{ params }` type annotations).
   - Keep exported HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
   - Ensure imports reference the new `.js` modules or extension-free `@/...` paths.
2. Delete old `route.ts` files.
3. Start `npm run dev` on port 3001 and run all check scripts (security 20, validation 28, pagination 47, review 5, profile 13, geocode 12, distance 22, avatar 14). Stop server.

### STAGE 5: COMPONENTS, PAGES, AND LAYOUTS
1. Convert `src/components/ui/*.tsx` (11 files) to `.jsx`. Remove interface definitions (`ButtonProps`, `InputProps`, etc.), `React.FC`, `as` casts.
2. Convert `src/components/providers/AuthProvider.tsx` to `AuthProvider.jsx`.
3. Convert `src/components/*.tsx` (4 files: `AddressSearch`, `CreateEventDialog`, `MapView`, `Navbar`) to `.jsx`.
   - In `MapView.jsx`, remove any Leaflet types or `(L as any)` casts while maintaining Leaflet dynamic imports and rendering behavior.
4. Convert `src/app` layouts and pages (9 files) to `.jsx`. Remove prop interfaces, generic hooks (e.g. `useState<...>()`).
5. Delete old `.tsx` files.
6. Verification: `npm run lint`, `npm test`, `npm run build`, start dev server on port 3001, run check scripts, run snapshot comparison (`compare-snapshots.mjs baseline-c1 stage5-c1`).

### STAGE 6: SCRIPTS, SEED, AND CLEAN-UP
1. Convert `prisma/seed.ts` to `prisma/seed.js` using Node CommonJS `require` syntax so it runs natively via `node prisma/seed.js`.
   - Test seed script strictly on a COPY of `dev.db` in a temporary location, NEVER on `prisma/dev.db`.
2. Delete leftover TypeScript files: `tsconfig.json`, `next-env.d.ts`, `tsconfig.tsbuildinfo`.
3. Remove `typescript` and `@types/*` devDependencies from `package.json` (`typescript`, `@types/bcryptjs`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/leaflet`).
4. Run `npm install` to update `package-lock.json`.
5. Confirm no `.ts` or `.tsx` files remain in the project.
6. Verify no dangling imports of removed type files.

### STAGE 7: FINAL VERIFICATION
1. `npm run lint` -> 0 errors, 0 warnings.
2. `npm test` -> 8 test files passed (8), 121 tests passed (121).
3. `npm run build` -> exit code 0, exactly 20 routes compiled.
4. Dev server check scripts on port 3001:
   - `security-check.mjs`: 20 passed
   - `validation-check.mjs`: 28 passed
   - `pagination-check.mjs`: 47 passed
   - `review-check.mjs`: 5 passed
   - `profile-check.mjs`: 13 passed
   - `geocode-check.mjs`: 12 passed
   - `distance-check.mjs`: 22 passed
   - `avatar-check.mjs`: 14 passed
5. Snapshot comparison with `scripts/compare-snapshots.mjs baseline-c1 final-c1`: 100% identical data payloads for Alex and Rimi across all 12 snapshot files.
6. Table row counts via `node scripts/db-counts.mjs`: identical to 81 rows baseline.
7. Manual browser verification checklist.

---

## 4. Risks & Mitigations

1. **Path Alias Resolution (`@/*`)**:
   - *Risk*: Without TypeScript compiler, Next.js or Vitest might fail to resolve `@/...` imports in plain JS.
   - *Mitigation*: Configure `jsconfig.json` with `"paths": { "@/*": ["./src/*"] }` which Next.js Turbopack natively respects. Ensure `vitest.config.js` keeps explicit `resolve.alias` for `@`.
2. **NextAuth Session Typing**:
   - *Risk*: NextAuth session callbacks augment user object (`session.user.id`).
   - *Mitigation*: In plain JS, JavaScript objects are dynamically typed; removing `src/types/next-auth.d.ts` has zero runtime effect as NextAuth passes properties directly.
3. **ESLint Parser Errors**:
   - *Risk*: ESLint config might attempt to invoke TypeScript parser on JS files or fail when TS plugin is removed.
   - *Mitigation*: Cleanly configure `eslint.config.mjs` using `eslint-config-next/core-web-vitals` only, with proper global ignores.
4. **Accidental Database Modification**:
   - *Risk*: Running seed or migration could wipe existing 81 rows.
   - *Mitigation*: `D:\dev.db.backup12` was created before any work. Seed testing is strictly done on temporary copies. No DB write commands will be run against `prisma/dev.db`.

