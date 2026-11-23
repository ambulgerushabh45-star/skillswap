# Implementation Plan — Task M3: React (Vite) Frontend Scaffold

## 1. Task Goal & Context
Task **M3** establishes the frontend foundation for the decoupled React Single-Page Application (SPA) in `client/`. Following the Strangler Fig architecture defined in `docs/plans/MIGRATION-react-express.md`:
1. The legacy Next.js app under `src/` stays **100% untouched** on port 3001.
2. The standalone Express backend in `server/` stays active on port 4000.
3. A brand-new React 19 application is scaffolded in `client/` using Vite, React Router, Tailwind CSS v4, Lucide icons, and plain JavaScript (ESM, JSX). Zero TypeScript.
4. An `AuthContext` replaces NextAuth client-side hooks (`useSession`, `signIn`, `signOut`).
5. A Vite dev server proxy forwards `/api` to `http://localhost:4000`, allowing transparent communication with zero CORS issues.
6. A responsive `Navbar`, root `Layout`, route definitions, and scaffolding for all 8 application pages are established.

---

## 2. Proposed Architecture for `client/`

### 2.1 Directory Structure
```
client/
├── index.html                    # Root HTML document
├── package.json                  # React 19, Vite, Tailwind v4, React Router, Lucide
├── jsconfig.json                 # Path alias "@/*" -> "./src/*"
├── vite.config.js                # Vite config with React plugin, Tailwind v4, dev proxy (/api -> :4000)
├── eslint.config.mjs             # ESLint flat config (ESM, React rules)
├── src/
│   ├── main.jsx                  # Entry point (ReactDOM.createRoot)
│   ├── App.jsx                   # Route provider (<RouterProvider> or <BrowserRouter>)
│   ├── index.css                 # Tailwind CSS v4 directives & theme variables
│   ├── context/
│   │   └── AuthContext.jsx       # AuthProvider, useAuth hook (session state, login, logout, register)
│   ├── components/
│   │   ├── Navbar.jsx            # Desktop & mobile navigation matching legacy Next.js Navbar
│   │   ├── Layout.jsx            # Shell layout with Navbar, <main> container / <Outlet />, and footer
│   │   ├── ProtectedRoute.jsx    # Guard redirecting unauthenticated users to /auth
│   │   └── ui/                   # Reusable lightweight UI primitives (button, badge, card, avatar)
│   ├── pages/                    # Scaffolded page components (to be fully ported in M4)
│   │   ├── HomePage.jsx          # Public landing page
│   │   ├── AuthPage.jsx          # Sign-in & sign-up forms wired to AuthContext
│   │   ├── DashboardPage.jsx     # Matches feed (protected)
│   │   ├── EventsPage.jsx        # Events feed & map placeholder
│   │   ├── ChatPage.jsx          # Messages & conversations (protected)
│   │   ├── ReviewsPage.jsx       # Peer reviews page
│   │   ├── ProfileSetupPage.jsx  # Edit user profile (protected)
│   │   ├── ProfileDetailPage.jsx # Public peer profile view
│   │   └── NotFoundPage.jsx      # 404 handler
│   └── lib/
│       └── utils.js              # Class merger utility (clsx / tailwind-merge)
└── scripts/
    └── client-scaffold-check.mjs # Verification script for Vite build, dev proxy, and routing
```

---

## 3. Key Components & Implementation Details

### 3.1 Dependencies (`client/package.json`)
Only essential packages:
- `react`, `react-dom` (^19.0.0)
- `react-router-dom` (^7.0.0 or ^6.28.0)
- `lucide-react` (^1.16.0)
- `clsx`, `tailwind-merge` (for class names utility)
- DevDependencies: `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite` (or Tailwind v4 post-css), `eslint`, `@eslint/js`, `globals`, `eslint-plugin-react`, `eslint-plugin-react-hooks`.
- Zero TypeScript packages.

### 3.2 Vite Configuration (`client/vite.config.js`)
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

### 3.3 AuthContext Design (`client/src/context/AuthContext.jsx`)
Mirrors the NextAuth contract to allow seamless page porting in M4:
- State:
  - `user`: `{ id, name, email, image }` or `null`
  - `status`: `'loading' | 'authenticated' | 'unauthenticated'`
- Actions:
  - `login(email, password)`: POST `/api/auth/login`. Sets session cookie (handled automatically by browser), updates `user` and `status: 'authenticated'`.
  - `register(name, email, password)`: POST `/api/auth/register`. Sets session cookie, updates `user` and `status: 'authenticated'`.
  - `logout()`: POST `/api/auth/logout`. Clears cookie, sets `user: null` and `status: 'unauthenticated'`.
  - `refreshSession()`: GET `/api/auth/session`. Runs on initial mount and when requested.

### 3.4 Navbar Component (`client/src/components/Navbar.jsx`)
100% visual and functional parity with [`src/components/Navbar.jsx`](file:///d:/project/src/components/Navbar.jsx):
- Uses `NavLink` from `react-router-dom` with active styling.
- Navigation links:
  - Home (`/`)
  - Events (`/events`)
  - Messages (`/chat`)
  - Reviews (`/reviews`)
  - Dashboard (`/dashboard`)
- Auth Controls:
  - Unauthenticated: "Sign In" button -> `/auth`
  - Authenticated:
    - User avatar & display name
    - Links to `/profile/setup` and `/profile/:id`
    - "Sign Out" button -> `logout()`
- Mobile hamburger menu with smooth toggle.

### 3.5 Protected Route Guard (`client/src/components/ProtectedRoute.jsx`)
- If `status === 'loading'`, renders a subtle loading spinner.
- If `status === 'unauthenticated'`, redirects to `/auth` with current path in state.
- If `status === 'authenticated'`, renders `<Outlet />` or children.

---

## 4. Execution Steps

1. **Safety Pre-Check**:
   - Verify `prisma/dev.db` has exactly 81 rows.
   - Confirm legacy Next.js app in `src/` and Express backend in `server/` are clean and untouched.
2. **Scaffold `client/` Structure**:
   - Create `client/package.json` with ESM `"type": "module"`.
   - Install dependencies in `client/` (`npm --prefix client install`).
   - Create `client/index.html`, `client/vite.config.js`, `client/jsconfig.json`, and `client/eslint.config.mjs`.
3. **Styling & Theme (`client/src/index.css`)**:
   - Configure Tailwind CSS v4 directives and CSS custom properties matching existing design system (colors, borders, radii).
4. **Implement Core Infrastructure**:
   - `client/src/lib/utils.js`: `cn()` helper with `clsx` and `tailwind-merge`.
   - `client/src/context/AuthContext.jsx`: Complete auth provider and `useAuth()` hook.
   - `client/src/components/Navbar.jsx`: Complete navigation bar.
   - `client/src/components/Layout.jsx`: Root layout.
   - `client/src/components/ProtectedRoute.jsx`: Authentication gate.
5. **Implement Page Shells (`client/src/pages/`)**:
   - Create all 8 page components with functional navigation and `AuthContext` connectivity.
   - Wire all routes into `client/src/App.jsx`.
   - Wire `main.jsx` with `BrowserRouter` and `AuthProvider`.
6. **Automated Verification Script (`client/scripts/client-scaffold-check.mjs`)**:
   - Tests that `client/` builds cleanly (`npm run build`).
   - Verifies route configuration and dev proxy connectivity.
7. **Quality Gates & Verification**:
   - `npm --prefix client run lint` -> 0 errors, 0 warnings.
   - `npm --prefix client run build` -> exit 0 (dist generated).
   - Root gates verified (`npm run lint`, `npx vitest run src/lib`, `npm run build`).
   - Express server tests verified (`npm --prefix server test`).
   - `prisma/dev.db` row count confirmed at 81.

---

## 5. Risks & Mitigation
- **Tailwind CSS v4 Configuration**: Ensure `@tailwindcss/vite` works smoothly with React 19 and `@/*` imports.
- **Cookie Handling over Proxy**: Vite dev server proxy must pass through `Set-Cookie` and `Cookie` headers without stripping `SameSite` or `HttpOnly`. (Vite `changeOrigin: true` natively preserves cookies).
- **Strangler Integrity**: Zero modification to `src/` or `prisma/dev.db`.

