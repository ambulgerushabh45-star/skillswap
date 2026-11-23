# Task M3 Plan: React (Vite) Client Foundation & Core Pages

## 1. Task Goal & Context

Migrate the frontend from Next.js 16 to a decoupled Single Page Application (SPA) in `client/` using:
- **Language**: Plain JavaScript (ES modules, JSX), zero TypeScript.
- **Build tool**: Vite (`vite.config.js` with `@vitejs/plugin-react` and `@tailwindcss/vite`).
- **Routing**: `react-router-dom` (BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useParams, useSearchParams).
- **Styling**: Tailwind CSS v4 with system font stack, shadcn UI components adapted for Vite/plain JSX.
- **State & Auth**: `AuthContext.jsx` providing `user`, `status` (`'loading' | 'authenticated' | 'unauthenticated'`), `login()`, `register()`, `logout()`, `refresh()`, and 401 interceptor.
- **Ported Real Pages**:
  1. Landing (`/`)
  2. Auth (`/auth`)
  3. Dashboard (`/dashboard`)
  4. Public profile (`/profile/:id`)
- **Placeholders for M4**:
  - `/events`
  - `/chat`
  - `/reviews`
  - `/profile/setup`
  Each displays a clean card: *"This page is being migrated (task M4)"* with a button linking back to Find Matches (`/dashboard`).
- **404 Route**:
  - `*` renders `NotFoundPage` with a link back to `/dashboard`.

### Strangler Fig Constraints
- `src/` (legacy Next.js on port 3001) is completely **UNTOUCHED**.
- `server/` (Express on port 4000), `scripts/`, `prisma/`, and root configs remain **100% UNTOUCHED**.
- SQLite database (`prisma/dev.db`) is **NEVER modified, reset, or deleted**. Row count remains strictly **81**.
- Pre-task database backup created: `D:\dev.db.backup15` (167,936 bytes).
- Ports:
  - Vite dev server: `5173` (`strictPort: true` so it fails loudly if occupied).
  - Express backend: `4000`.
  - Legacy Next.js: `3001`.

---

## 2. Directory Layout of `client/`

```
client/
├── package.json
├── package-lock.json
├── index.html
├── vite.config.js
├── jsconfig.json
├── eslint.config.mjs
├── vitest.config.js
├── public/
│   └── favicon.ico
├── scripts/
│   └── smoke-check.mjs
└── src/
    ├── index.css
    ├── main.jsx
    ├── App.jsx
    ├── lib/
    │   ├── utils.js                 # cn() helper
    │   ├── api.js                   # fetch wrapper & ApiError
    │   └── geo.js                   # formatDistance helper
    ├── context/
    │   └── AuthContext.jsx          # AuthProvider & useAuth hook
    ├── components/
    │   ├── Layout.jsx               # Main application shell (Navbar, Outlet, Footer)
    │   ├── Navbar.jsx               # Navigation bar with auth-aware links & mobile drawer
    │   ├── ProtectedRoute.jsx       # Route guard for authenticated views
    │   └── ui/                      # Plain JSX shadcn components
    │       ├── avatar.jsx
    │       ├── badge.jsx
    │       ├── button.jsx
    │       ├── card.jsx
    │       ├── dialog.jsx
    │       ├── input.jsx
    │       ├── scroll-area.jsx
    │       ├── select.jsx
    │       ├── table.jsx
    │       ├── tabs.jsx
    │       └── textarea.jsx
    ├── pages/
    │   ├── HomePage.jsx             # / (Landing)
    │   ├── AuthPage.jsx             # /auth (Login / Register)
    │   ├── DashboardPage.jsx        # /dashboard (Matches & Find Peers)
    │   ├── ProfileDetailPage.jsx    # /profile/:id (Public Profile)
    │   ├── PlaceholderPage.jsx      # Generic placeholder for /events, /chat, /reviews, /profile/setup
    │   └── NotFoundPage.jsx         # 404 Catch-all
    └── test/                        # Vitest setup & component unit tests
        ├── setup.js
        ├── api.test.js
        ├── AuthContext.test.jsx
        ├── ProtectedRoute.test.jsx
        ├── Navbar.test.jsx
        ├── AuthPage.test.jsx
        ├── DashboardPage.test.jsx
        └── ProfileDetailPage.test.jsx
```

---

## 3. Dependencies & Versions (`client/package.json`)

```json
{
  "name": "skillswap-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@radix-ui/react-avatar": "^1.2.6",
    "@radix-ui/react-dialog": "^1.1.23",
    "@radix-ui/react-scroll-area": "^1.2.18",
    "@radix-ui/react-select": "^2.3.7",
    "@radix-ui/react-slot": "^1.3.3",
    "@radix-ui/react-tabs": "^1.1.21",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.31.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-router-dom": "^7.1.5",
    "tailwind-merge": "^3.0.1",
    "tw-animate-css": "^1.2.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "eslint": "^9.20.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.19",
    "globals": "^15.14.0",
    "jsdom": "^26.0.0",
    "tailwindcss": "^4.0.0",
    "vite": "^6.2.0",
    "@vitejs/plugin-react": "^4.3.4",
    "vitest": "^3.2.7"
  }
}
```

---

## 4. Vite Proxy & CSRF Compatibility

In `client/vite.config.js`:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
  preview: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
});
```
- By keeping `changeOrigin: false`, the browser's original `Origin: http://localhost:5173` is preserved in requests forwarded to Express.
- Express CSRF middleware verifies `Origin` against `ALLOWED_ORIGINS` (`http://localhost:5173,http://localhost:4000`), so all state-changing requests pass without issue.

---

## 5. API Helper & Auth Flow Design

### 5.1 `client/src/lib/api.js`
- Custom `ApiError` class extending `Error`:
  - `status`: HTTP status code (number).
  - `details`: validation details or null.
  - `retryAfter`: parsed integer seconds if 429 response, else null.
- Helper function `apiFetch(endpoint, options = {})`:
  - Sets `credentials: 'same-origin'` (ensures `skillswap_session` cookie is sent).
  - Sets `Accept: 'application/json'`.
  - Sets `Content-Type: 'application/json'` if body is present (unless FormData).
  - Throws user-friendly network error if `fetch` fails ("Cannot reach the server").
  - On non-2xx status, parses JSON response for `data.error` or `data.message`; extracts `Retry-After` header.
  - Returns parsed JSON (or null for empty body like 204).

### 5.2 `client/src/context/AuthContext.jsx`
- State:
  - `user`: `{ id, name, email, image }` or `null`.
  - `status`: `'loading' | 'authenticated' | 'unauthenticated'`.
- On mount:
  - Calls `GET /api/auth/session`.
  - If `data.user` is non-null, sets `user` and `status = 'authenticated'`.
  - If `data.user` is null, sets `user = null` and `status = 'unauthenticated'`.
- Actions:
  - `login(email, password)`: POST `/api/auth/login`. On 200, sets `user` and `status = 'authenticated'`.
  - `register(name, email, password)`: POST `/api/auth/register`. On 201, sets `user` and `status = 'authenticated'`.
  - `logout()`: POST `/api/auth/logout`. Sets `user = null` and `status = 'unauthenticated'`.
  - `refresh()`: Calls `GET /api/auth/session` to synchronize user profile.
- 401 Interceptor:
  - If any authenticated API call encounters a 401, resets state to `unauthenticated`.

### 5.3 `client/src/components/ProtectedRoute.jsx`
- If `status === 'loading'`: renders full-screen or centered loading spinner.
- If `status === 'unauthenticated'`: redirects to `/auth` with current location in `state.from`.
- If `status === 'authenticated'`: renders `<Outlet />`.

---

## 6. Route Table & Navigation

| Path | Element | Route Type | Description |
|---|---|---|---|
| `/` | `<HomePage />` | Public | Hero, value props, feature cards |
| `/auth` | `<AuthPage />` | Public (redirects to `/dashboard` if authenticated) | Tabs for Login / Signup, demo credentials, error banners |
| `/dashboard` | `<ProtectedRoute><DashboardPage /></ProtectedRoute>` | Protected | Match suggestions, mutual/connected tabs, search, location notice |
| `/profile/:id` | `<ProtectedRoute><ProfileDetailPage /></ProtectedRoute>` | Protected | Public profile view, viewer action controls, rating & reviews |
| `/events` | `<PlaceholderPage title="Local Events" />` | Public / Placeholder | M4 migration placeholder |
| `/chat` | `<ProtectedRoute><PlaceholderPage title="Messages & Chat" /></ProtectedRoute>` | Protected / Placeholder | M4 migration placeholder |
| `/reviews` | `<ProtectedRoute><PlaceholderPage title="Rate & Review" /></ProtectedRoute>` | Protected / Placeholder | M4 migration placeholder |
| `/profile/setup` | `<ProtectedRoute><PlaceholderPage title="Profile Setup" /></ProtectedRoute>` | Protected / Placeholder | M4 migration placeholder |
| `*` | `<NotFoundPage />` | Public | 404 page with link back to `/dashboard` |

---

## 7. Next.js Feature Substitutions

| Next.js Feature | Vite / React Router Replacement | Notes |
|---|---|---|
| `next/link` | `<Link to="...">` and `<NavLink to="...">` | Replaces `href` with `to` |
| `useRouter()` | `const navigate = useNavigate()` | `router.push('/path')` -> `navigate('/path')` |
| `usePathname()` | `const location = useLocation()` | `location.pathname` |
| `useParams()` | `const params = useParams()` | `params.id` |
| `useSearchParams()` | `const [searchParams, setSearchParams] = useSearchParams()` | Standard Web URLSearchParams |
| `useSession()`, `signIn()`, `signOut()` | `useAuth()` hook from `AuthContext.jsx` | Exposes `{ user, status, login, register, logout }` |
| `next/image` | Plain `<img>` element | Identical CSS classes and responsive attributes |
| `next/font/google` | System font stack in `index.css` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...` |
| `"use client"` directive | Removed | Plain standard React components |

---

## 8. Client Unit Tests Plan (Vitest + jsdom)

We will create test suites under `client/src/test/`:
1. `api.test.js`:
   - Success path returning parsed JSON.
   - Non-JSON error body fallback.
   - Server error status with error message from server.
   - 429 response parsing `Retry-After` header.
   - Network failure throwing descriptive error.
   - 204 empty response handling.
2. `AuthContext.test.jsx`:
   - Initial loading state transitioning to unauthenticated when session is null.
   - Transitions to authenticated when session returns a user.
   - `login()` success updates user and status.
   - `login()` failure propagates error.
   - `logout()` resets user to null and unauthenticated.
   - `register()` auto-authenticates user.
3. `ProtectedRoute.test.jsx`:
   - Shows loading indicator while status is `'loading'`.
   - Redirects to `/auth` when unauthenticated.
   - Renders child outlet when authenticated.
4. `Navbar.test.jsx`:
   - Shows Log In & Get Started buttons when unauthenticated.
   - Shows user avatar, display name, and Logout button when authenticated.
   - Shows Messages link when authenticated.
5. `AuthPage.test.jsx`:
   - Switches between Login and Signup tabs.
   - "Demo credentials" button fills Alex's login credentials.
   - Submits login and displays server error on failure.
   - Displays 429 rate limit error message.
   - Disabled Google OAuth button indicates "coming soon".
6. `DashboardPage.test.jsx`:
   - Renders match cards from `/api/matches`.
   - Filters cards by search query and mutual/connected tabs.
   - Shows "New" badge for users with 0 reviews.
   - Displays formatted distance text.
   - Displays "Set your location to see distances" notice when user has no location.
   - Connect button dispatches POST `/api/matches`.
7. `ProfileDetailPage.test.jsx`:
   - Renders user profile information.
   - Renders viewer-specific action controls (Edit Profile for self, Connect for NONE, Request Pending for PENDING, Message for ACCEPTED).
   - Renders 404 state when API returns 404.

---

## 9. Smoke Check Script (`client/scripts/smoke-check.mjs`)

Create `client/scripts/smoke-check.mjs` running against `http://localhost:5173` (with Express on 4000):
1. `GET /` -> Returns HTML containing `<div id="root"></div>`.
2. `GET /dashboard` -> Returns HTML shell (SPA fallback).
3. `GET /api/health` -> Returns `{ status: "ok" }` through Vite proxy.
4. `GET /api/auth/session` without cookie -> `{ user: null }`.
5. `POST /api/auth/login` with `alex@example.com` / `password123` and `Origin: http://localhost:5173` -> Returns 200 and sets `skillswap_session` cookie.
6. `GET /api/auth/session` with session cookie -> Returns Alex's session object.
7. `GET /api/matches` with session cookie -> Returns 200 with `matches`, `currentUser`, and `pagination`.
8. `POST /api/auth/logout` -> Clears cookie.
9. `POST /api/auth/login` with `Origin: http://evil.example.com` -> Returns 403 Forbidden.
10. Confirm zero records created in database (pure read/session checks).

---

## 10. Step-by-Step Implementation Checklist

- [x] Step 1: Pre-task database backup (`D:\dev.db.backup15`) & baseline verification.
- [x] Step 2: Write this plan file (`docs/plans/M3-react-client.md`).
- [ ] Step 3: Scaffold `client/` (`package.json`, install dependencies, `vite.config.js`, `index.html`, `jsconfig.json`, `eslint.config.mjs`, `index.css`, UI components, update root `.gitignore`).
- [ ] Step 4: Implement API helper (`api.js`) and AuthContext (`AuthContext.jsx`, `ProtectedRoute.jsx`).
- [ ] Step 5: Implement Layout, Navbar, PlaceholderPage, NotFoundPage, and App routing.
- [ ] Step 6: Port the 4 real pages (`HomePage.jsx`, `AuthPage.jsx`, `DashboardPage.jsx`, `ProfileDetailPage.jsx`).
- [ ] Step 7: Write and run client unit tests (Vitest + jsdom + Testing Library).
- [ ] Step 8: Create and run smoke check script (`client/scripts/smoke-check.mjs`).
- [ ] Step 9: Run all quality gates (client lint/test/build, server lint/test, root lint/test/build, 8 server check scripts, row count verification = 81).
- [ ] Step 10: Update documentation (`PROJECT_STATUS.md`, `docs/DECISIONS.md`).

