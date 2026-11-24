// client/scripts/smoke-check.mjs
// Automated smoke check verifying client dev server, Vite proxy, and Express backend
// Zero database mutations (read-only and session checks).

const CLIENT_BASE = process.env.CLIENT_URL || 'http://localhost:5173';
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runSmokeCheck() {
  console.log(`======================================================`);
  console.log(`Starting SkillSwap Client Smoke Check on ${CLIENT_BASE}`);
  console.log(`======================================================\n`);

  let sessionCookie = '';

  // 1. GET / -> HTML shell
  try {
    const res = await fetch(`${CLIENT_BASE}/`);
    assert(res.status === 200, `GET / returns status 200 (got ${res.status})`);
    const text = await res.text();
    assert(text.includes('id="root"'), 'GET / HTML contains <div id="root">');
    assert(
      text.includes('/src/main.jsx') || text.includes('/assets/'),
      'GET / HTML includes client script'
    );
  } catch (err) {
    assert(false, `GET / connection failed: ${err.message}`);
  }

  // 2. GET /dashboard -> SPA fallback shell
  try {
    const res = await fetch(`${CLIENT_BASE}/dashboard`);
    assert(res.status === 200, `GET /dashboard returns status 200 (got ${res.status})`);
    const text = await res.text();
    assert(text.includes('id="root"'), 'GET /dashboard SPA fallback contains <div id="root">');
  } catch (err) {
    assert(false, `GET /dashboard fallback failed: ${err.message}`);
  }

  // 3. GET /api/health through Vite proxy
  try {
    const res = await fetch(`${CLIENT_BASE}/api/health`);
    assert(res.status === 200, `GET /api/health proxy returns 200 (got ${res.status})`);
    const json = await res.json();
    assert(json.status === 'ok', `GET /api/health returned status: 'ok'`);
  } catch (err) {
    assert(false, `GET /api/health proxy failed: ${err.message}`);
  }

  // 4. GET /api/auth/session without cookie -> user is null
  try {
    const res = await fetch(`${CLIENT_BASE}/api/auth/session`);
    assert(res.status === 200, `GET /api/auth/session without cookie returns 200`);
    const json = await res.json();
    assert(json.user === null, 'Unauthenticated session returns { user: null }');
  } catch (err) {
    assert(false, `GET /api/auth/session failed: ${err.message}`);
  }

  // 5. POST /api/auth/login with valid credentials and client Origin
  try {
    const res = await fetch(`${CLIENT_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: CLIENT_BASE,
      },
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123',
      }),
    });

    assert(res.status === 200, `POST /api/auth/login returns 200 (got ${res.status})`);
    const cookieHeader = res.headers.get('set-cookie');
    assert(
      Boolean(cookieHeader && cookieHeader.includes('skillswap_session')),
      'POST /api/auth/login sets skillswap_session cookie'
    );
    if (cookieHeader) {
      sessionCookie = cookieHeader.split(';')[0];
    }
    const json = await res.json();
    assert(json.user?.email === 'alex@example.com', 'Login returned Alex Johnson user payload');
  } catch (err) {
    assert(false, `POST /api/auth/login failed: ${err.message}`);
  }

  // 6. GET /api/auth/session WITH session cookie
  try {
    const res = await fetch(`${CLIENT_BASE}/api/auth/session`, {
      headers: {
        Cookie: sessionCookie,
      },
    });
    assert(res.status === 200, `GET /api/auth/session with cookie returns 200`);
    const json = await res.json();
    assert(json.user?.email === 'alex@example.com', 'Authenticated session returns Alex Johnson');
  } catch (err) {
    assert(false, `GET /api/auth/session with cookie failed: ${err.message}`);
  }

  // 7. GET /api/matches WITH session cookie
  try {
    const res = await fetch(`${CLIENT_BASE}/api/matches`, {
      headers: {
        Cookie: sessionCookie,
      },
    });
    assert(res.status === 200, `GET /api/matches with cookie returns 200 (got ${res.status})`);
    const json = await res.json();
    assert(Array.isArray(json.matches), 'GET /api/matches returns array of matches');
    assert(Boolean(json.currentUser), 'GET /api/matches returns currentUser');
    assert(Boolean(json.pagination), 'GET /api/matches returns pagination metadata');
  } catch (err) {
    assert(false, `GET /api/matches failed: ${err.message}`);
  }

  // 8. POST /api/auth/logout -> clears cookie
  try {
    const res = await fetch(`${CLIENT_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
        Origin: CLIENT_BASE,
      },
    });
    assert(res.status === 200, `POST /api/auth/logout returns 200`);
    const cookieHeader = res.headers.get('set-cookie') || '';
    assert(
      cookieHeader.includes('Max-Age=0') || cookieHeader.includes('Expires='),
      'POST /api/auth/logout expires session cookie'
    );
  } catch (err) {
    assert(false, `POST /api/auth/logout failed: ${err.message}`);
  }

  // 9. POST /api/auth/login with unauthorized Origin -> 403 Forbidden
  try {
    const res = await fetch(`${CLIENT_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://evil.example.com',
      },
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123',
      }),
    });
    assert(res.status === 403, `Untrusted Origin returns 403 Forbidden (got ${res.status})`);
  } catch (err) {
    assert(false, `CSRF origin check test failed: ${err.message}`);
  }

  console.log(`\n======================================================`);
  console.log(`Smoke Check Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeCheck();

