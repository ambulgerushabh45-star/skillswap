# M5 — Decommission Next.js, Clean Structure, & Production Serving

## 1. Goal & Scope
Complete the migration from the legacy Next.js 16 monolith (`src/`) to the decoupled **React (Vite)** client (`client/`) + **Express** backend (`server/`):
- Back up the pre-M5 workspace (`../skillswap-before-m5`) and database (`../dev.db.backup18`).
- Verify import independence across `server/` and `client/` before removing legacy files.
- Remove legacy Next.js source code, root Next-only configs, build artifacts, starter SVGs, and obsolete port-3001 scripts/snapshots.
- Port root DB helper scripts (`db-counts.mjs`, `db-inspect.mjs`, `set-demo-locations.mjs`) into `server/scripts/`.
- Rewrite root `package.json` as a thin orchestrator (`skillswap`) with plain-Node `scripts/dev.mjs` process manager (no new dependencies) and regenerate `package-lock.json`.
- Implement production SPA serving in Express (`server/src/app.js`) when `NODE_ENV=production` with immutable asset caching, no-cache `index.html`, SPA HTML fallback, JSON `/api/*` 404 preservation, path traversal guards, and strict Helmet CSP.
- Document `ALLOWED_ORIGINS` for production in `server/.env.example`.
- Add Vitest tests (`server/test/static-serving.test.js`) covering production static serving, SPA fallback, CSP/cache headers, path traversal rejection, and `/api/*` 404 behavior.
- Verify dev mode (`npm run dev`), production mode (`NODE_ENV=production` smoke test), all lint/test/build/check suites, and update `README.md`, `PROJECT_STATUS.md`, `AGENT_RULES.md`, `.agent/rules/`, and `docs/DECISIONS.md`.

---

## 2. File Inventory

### Files & Directories to Remove
| Path | Reason for Removal |
|---|---|
| `src/` | Legacy Next.js App Router pages, API routes, components, and libs (fully replaced by `client/` and `server/`) |
| `.next/` | Next.js build output cache |
| `next.config.mjs` | Next.js framework configuration |
| `jsconfig.json` | Root `@/* -> ./src/*` path alias used only by Next.js (`client/` and `server/` have their own setup) |
| `eslint.config.mjs` | Uses `eslint-config-next` for Next.js (`server/` and `client/` keep independent ESLint configs) |
| `vitest.config.js` | Root `@/* -> ./src` Vitest config (`server/` and `client/` keep independent Vitest configs) |
| `postcss.config.mjs` | Next.js `@tailwindcss/postcss` config (`client/` uses `@tailwindcss/vite`) |
| `components.json` | Legacy shadcn config pointing to `src/app/globals.css` |
| `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` | Default Next.js template SVGs unused by `client/` or `server/` (`client/` uses `client/public/favicon.svg`) |
| `scripts/security-check.mjs`, `validation-check.mjs`, `pagination-check.mjs`, `review-check.mjs`, `profile-check.mjs`, `geocode-check.mjs`, `distance-check.mjs`, `avatar-check.mjs` | Port 3001 Next.js check scripts; superseded by exact copies in `server/scripts/` totaling identical 161 assertions |
| `scripts/rate-limit-check.mjs` | Legacy NextAuth `/api/auth/callback/credentials` port 3001 check; covered by `server/test/rate-limit.test.js` and `server/scripts/foundation-check.mjs` |
| `scripts/take-snapshots.mjs`, `scripts/compare-snapshots.mjs`, `scripts/snapshots/` | Legacy C1 conversion JSON snapshot harness for port 3001 |
| `server/scripts/parity-check.mjs` | Legacy Next.js (3001) vs Express (4000) parity script importing `next-auth/jwt` |
| Root `package.json` runtime/dev dependencies (`next`, `next-auth`, `react`, `react-dom`, `socket.io`, `tailwindcss`, etc.) | Removed when rewriting root `package.json` as a thin orchestrator |

### Scripts Ported & Adapted
| Old Location | New Location | Change Needed |
|---|---|---|
| `scripts/db-counts.mjs` | `server/scripts/db-counts.mjs` | Import `{ prisma } from '../src/db/prisma.js'` so it uses `server/`'s Prisma client & resolved `DATABASE_URL` |
| `scripts/db-inspect.mjs` | `server/scripts/db-inspect.mjs` | Import `{ prisma } from '../src/db/prisma.js'` |
| `scripts/set-demo-locations.mjs` | `server/scripts/set-demo-locations.mjs` | Import `{ prisma } from '../src/db/prisma.js'` (keeps K27 tooling working) |

### Files & Directories That Stay
- `prisma/` (`schema.prisma`, `dev.db`, `seed.js`) — database and schema strictly untouched (**81 rows**).
- `server/` — Express ESM backend, Vitest suite, ESLint, and server check scripts.
- `client/` — React 19 + Vite SPA, `client/public/favicon.svg`, `client/dist/` build output, Vitest suite, ESLint.
- `public/uploads/avatars/` — actively referenced by `server/.env` & `server/.env.example` (`AVATAR_STORAGE_DIR="../public/uploads/avatars"`) and stores Alex Kumar's avatar (`35a575ce-0109-4591-9f5e-97bb9b100442-5f44df7100cc418f.webp`); `storage/` gitignored path also retained.
- `docs/` — architecture decisions, audit, historical plan files (M1–M4b preserved untouched), and `M5-decommission-next.md`.

---

## 3. Import-Independence Verification Proof

Before removing legacy `src/` and root packages, an AST/regex import scan across all JS/JSX/MJS files in `server/` and `client/` (excluding `node_modules/` and `dist/`) was executed using a Node script scanning `import`/`require` specifiers:
- **Root-only packages checked**: `next`, `next-auth`, `react-hook-form`, `socket.io`, `socket.io-client`, `@tailwindcss/postcss`, `eslint-config-next`.
- **Result for `server/`**:
  - `server/src/` and `server/test/`: **0 imports** from root `src/` or root-only packages.
  - `server/scripts/`: **0 imports** from root `src/`; only `server/scripts/parity-check.mjs` imported `next-auth/jwt`, and that script is scheduled for deletion in this task.
- **Result for `client/`**:
  - `client/src/`: **0 imports** from root `src/` or root-only packages.
  - `client/scripts/m4a-check.mjs` & `client/scripts/m4b-check.mjs`: currently import `@prisma/client` directly (which resolved via root `node_modules`). As part of Step 3, both scripts will be updated to import `{ prisma } from '../../server/src/db/prisma.js'` so `client/` is 100% independent of root `node_modules`.

---

## 4. Root `package.json` & Orchestration Design

Root `package.json` will be rewritten as a pure orchestrator (zero runtime or dev dependencies):
```json
{
  "name": "skillswap",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node scripts/dev.mjs",
    "dev:server": "npm --prefix server run dev",
    "dev:client": "npm --prefix client run dev",
    "build": "npm --prefix client run build",
    "start": "node scripts/start.mjs",
    "test": "npm --prefix server test && npm --prefix client test",
    "lint": "npm --prefix server run lint && npm --prefix client run lint",
    "check": "node server/scripts/run-checks.mjs"
  }
}
```
- `scripts/dev.mjs`: Plain Node (`node:child_process`) script spawning `npm --prefix server run dev` and `npm --prefix client run dev`, prefixing stdout/stderr lines with `[server]` and `[client]`, and forwarding `SIGINT`/`SIGTERM` cleanly to terminate both child processes on `Ctrl+C` or child exit.
- `scripts/start.mjs`: Cross-platform Node launcher setting `NODE_ENV=production` in `env` and spawning Express (`src/index.js` in `server/`) so `npm start` works reliably on both Windows and POSIX shells without `cross-env`.
- Lockfile regeneration: Execute `npm install` at root after rewriting root `package.json`. Do NOT delete `server/node_modules` or `client/node_modules`.

---

## 5. Production Serving Design (`server/src/app.js` & `server/src/lib/avatar-storage.js`)

1. **`createApp(options = {})`** accepts optional `{ isProduction = config.IS_PRODUCTION, clientDistDir = defaultClientDistDir }` so production behavior works automatically under `NODE_ENV=production` and is deterministically unit-testable in Vitest.
2. **Path Traversal Protection**: Early middleware inspects raw pathname (`req.originalUrl.split('?')[0]`) and decoded pathname; if `'..'` is present or URI decoding fails, immediately returns `400 Bad Request` (`{ "error": "Invalid path" }`).
3. **Helmet CSP (Production)**: When `isProduction` is true, enable Helmet CSP with `useDefaults: false` (preventing `upgrade-insecure-requests` from breaking local HTTP `http://localhost:4000` testing) and exact directives:
   - `default-src 'self'`
   - `script-src 'self'`
   - `style-src 'self' 'unsafe-inline'`
   - `img-src 'self' data: blob: https://*.tile.openstreetmap.org`
   - `connect-src 'self'`
   - `frame-ancestors 'none'`
   - `object-src 'none'`
   - `base-uri 'self'`
   Set `crossOriginResourcePolicy` to `{ policy: isProduction ? 'same-origin' : 'cross-origin' }`.
4. **Static Assets & SPA Fallback** (registered AFTER all `/api/*` routes and `/api` JSON 404 handler):
   - Mount `/assets` with `express.static(path.join(clientDistDir, 'assets'), { maxAge: '365d', immutable: true })`.
   - Mount `express.static(clientDistDir, { index: 'index.html', setHeaders })` setting `Cache-Control: no-cache` for `index.html`.
   - Fallback `app.get('*', ...)`: ignores `/api` and `/assets/*`, checks `req.accepts('html')`, and sends `index.html` with `Cache-Control: no-cache`. Missing non-HTML requests or missing `/assets/*` reach the JSON `notFoundHandler` (`404`).
5. **Avatar Storage CWD Resilience**: Update `server/src/lib/avatar-storage.js` so relative `process.env.AVATAR_STORAGE_DIR` paths resolve against `server/` (`serverRootDir`) rather than arbitrary `process.cwd()`.
6. **Documentation in `server/.env.example`**: Document setting `ALLOWED_ORIGINS` to the real site origin (e.g. `https://skillswap.example.com` or `http://localhost:4000` for local prod testing) when `NODE_ENV=production`.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `npm install` at root removes `@prisma/client` used by `client/scripts/m4a-check.mjs` & `m4b-check.mjs` | Update both scripts to import `{ prisma } from '../../server/src/db/prisma.js'` and verify cleanly after `npm install` |
| Deleting `public/` would erase Alex Kumar's avatar in `public/uploads/avatars/` | Keep `public/uploads/avatars/` intact; delete only the 5 unused Next.js starter SVGs (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) |
| Helmet default CSP injects `upgrade-insecure-requests`, breaking HTTP `localhost:4000` in browsers | Configure `useDefaults: false` with the exact 8 directives specified in Step 4 |
| Seeded Unsplash URLs blocked under strict `img-src` CSP | Verified React `<Avatar>` renders clean `<AvatarFallback>` initials automatically when remote images are blocked; core local avatars (`/api/avatars/...`), Leaflet data-URI marker icons (`data:`), and OSM map tiles (`https://*.tile.openstreetmap.org`) all comply cleanly with CSP |
| Rate limiter exhaustion during full check script run (`validation-check` + `foundation-check`) | `foundation-check.mjs` tests register/login rate limits cleanly on a fresh server instance; document ordering clearly |

---

## 7. Verification Checklist
- [ ] Pre-task backups created (`../skillswap-before-m5` and `../dev.db.backup18`)
- [ ] Baseline confirmed (`103` client, `163` server, `21` smoke, `31` m4a, `31` m4b, `161` server checks, `57` foundation, `19` p35, `81` DB rows)
- [ ] Legacy files, root configs, old scripts, and snapshots removed per inventory; `public/uploads/avatars/` preserved
- [ ] `db-counts.mjs`, `db-inspect.mjs`, `set-demo-locations.mjs` ported & adapted in `server/scripts/`
- [ ] Root `package.json`, `scripts/dev.mjs`, `scripts/start.mjs` created and root `package-lock.json` regenerated via `npm install`
- [ ] Express production static serving, SPA fallback, traversal guard, and CSP implemented in `server/src/app.js`
- [ ] `server/.env.example` updated with production `ALLOWED_ORIGINS` guidance
- [ ] `server/test/static-serving.test.js` written and passing
- [ ] Server lint (0 errors) & tests (163 + new) passing
- [ ] Client lint (0 errors), tests (103), & build (exit 0) passing
- [ ] Dev mode (`npm run dev`): all checks pass with baseline counts (`161`, `57`, `19`, `21`, `31`, `31`)
- [ ] Production smoke test on port 4000 (`NODE_ENV=production`) passes all checks (HTML shell, deep link `/dashboard`, immutable asset caching, `/api/health`, login/session with `Origin`, 403 foreign Origin, security & CSP headers, JSON 404 on unknown `/api/*`, traversal rejection)
- [ ] Database row count strictly **81 rows** across all 9 tables
- [ ] `README.md`, `PROJECT_STATUS.md`, `AGENT_RULES.md`, `.agent/rules/agent-rules.md`, `.agents/rules/agent-rules.md`, and `docs/DECISIONS.md` updated

