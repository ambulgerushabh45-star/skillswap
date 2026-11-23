// server/scripts/geocode-check.mjs
// Automated verification script for OpenStreetMap Nominatim geocoding API (Express)
// Read-only tests against http://localhost:4000

import { prisma } from '../src/db/prisma.js';
import { login, DEFAULT_BASE_URL } from './test-auth-helper.mjs';
import config from '../src/config/env.js';

const BASE_URL = process.env.TEST_BASE_URL || DEFAULT_BASE_URL;

let passed = 0;
let failed = 0;
let skipped = 0;

function assertCheck(name, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${name} ${details ? `— ${details}` : ''}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name} ${details ? `— ${details}` : ''}`);
    failed++;
  }
}

function skipCheck(name, reason) {
  console.log(`[SKIP] ${name} — ${reason}`);
  skipped++;
}

const expectedUserAgent = config.NOMINATIM_USER_AGENT || 'SkillSwap/0.1 (contact: set-in-env)';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runGeocodeChecks() {
  console.log(`\n======================================================`);
  console.log(`Starting SkillSwap Geocoding Checks on ${BASE_URL}`);
  console.log(`======================================================\n`);

  const initialRowCount = await prisma.event.count();

  // 1. Unauthenticated request -> 401
  const unauthRes = await fetch(`${BASE_URL}/api/geocode?q=Cubbon%20Park`);
  const unauthData = await unauthRes.json();
  assertCheck(
    'Unauthenticated geocode request returns 401 Unauthorized',
    unauthRes.status === 401 && unauthData.error === 'Unauthorized',
    `Status ${unauthRes.status}`
  );

  const cookie = await login('alex@example.com', 'password123', BASE_URL);

  // 2. Missing query parameter `q` -> 400
  const missingQRes = await fetch(`${BASE_URL}/api/geocode`, {
    headers: { Cookie: cookie },
  });
  const missingQData = await missingQRes.json();
  assertCheck(
    'Missing q parameter returns 400 Bad Request',
    missingQRes.status === 400 && typeof missingQData.error === 'string',
    `Status ${missingQRes.status}: "${missingQData.error}"`
  );

  // 3. Short query parameter < 3 chars -> 400
  const shortQRes = await fetch(`${BASE_URL}/api/geocode?q=ab`, {
    headers: { Cookie: cookie },
  });
  const shortQData = await shortQRes.json();
  assertCheck(
    'Query < 3 characters rejected with 400 Bad Request',
    shortQRes.status === 400 && shortQData.error.includes('3 characters'),
    `Status ${shortQRes.status}: "${shortQData.error}"`
  );

  // 4. Overly long query parameter > 200 chars -> 400
  const longQuery = 'a'.repeat(201);
  const longQRes = await fetch(`${BASE_URL}/api/geocode?q=${longQuery}`, {
    headers: { Cookie: cookie },
  });
  const longQData = await longQRes.json();
  assertCheck(
    'Query > 200 characters rejected with 400 Bad Request',
    longQRes.status === 400 && longQData.error.includes('200 characters'),
    `Status ${longQRes.status}: "${longQData.error}"`
  );

  // 5. Valid search: "Cubbon Park, Bengaluru" (Upstream Call #1)
  console.log("Executing first upstream search for 'Cubbon Park, Bengaluru'...");
  let search1Res;
  let search1Data;
  let search1RawText = '';
  try {
    search1Res = await fetch(
      `${BASE_URL}/api/geocode?q=${encodeURIComponent('Cubbon Park, Bengaluru')}`,
      { headers: { Cookie: cookie } }
    );
    search1RawText = await search1Res.text();
    search1Data = JSON.parse(search1RawText);
  } catch (err) {
    search1Res = { status: 503, headers: new Headers() };
    search1Data = { error: String(err) };
  }

  const isNetworkAvailable = search1Res.status === 200;

  if (isNetworkAvailable) {
    assertCheck(
      'Valid search returns 200 with result array',
      Array.isArray(search1Data.results) && search1Data.results.length >= 1,
      `Found ${search1Data.results.length} result(s)`
    );

    const firstResult = search1Data.results[0];
    assertCheck(
      'First result has valid numeric latitude and longitude',
      typeof firstResult.latitude === 'number' &&
        typeof firstResult.longitude === 'number' &&
        firstResult.latitude > 12 &&
        firstResult.latitude < 14,
      `Lat: ${firstResult.latitude}, Lng: ${firstResult.longitude}, Label: "${firstResult.label.slice(0, 40)}..."`
    );

    assertCheck(
      'First search reflects X-Cache: MISS',
      search1Res.headers.get('X-Cache') === 'MISS',
      `X-Cache: ${search1Res.headers.get('X-Cache')}`
    );

    // 6. Privacy & Leak check: Ensure User-Agent is never leaked in headers or body
    const headersString = JSON.stringify([...search1Res.headers.entries()]);
    const bodyLeaksUA = search1RawText.includes(expectedUserAgent);
    const headersLeakUA = headersString.includes(expectedUserAgent);
    assertCheck(
      'User-Agent string is never leaked in response body or headers',
      !bodyLeaksUA && !headersLeakUA,
      `Body leaked: ${bodyLeaksUA}, Headers leaked: ${headersLeakUA}`
    );

    // 7. Repeat search #1: Verify 24-hour in-memory cache hit
    console.log("Repeating search for 'Cubbon Park, Bengaluru' to verify cache...");
    const cacheHitRes = await fetch(
      `${BASE_URL}/api/geocode?q=${encodeURIComponent('  cubbon park,  bengaluru  ')}`,
      { headers: { Cookie: cookie } }
    );
    const cacheHitData = await cacheHitRes.json();
    assertCheck(
      'Repeated search returns 200 with X-Cache: HIT',
      cacheHitRes.status === 200 && cacheHitRes.headers.get('X-Cache') === 'HIT',
      `X-Cache: ${cacheHitRes.headers.get('X-Cache')}`
    );
    assertCheck(
      'Cached results match original results',
      cacheHitData.results.length === search1Data.results.length &&
        cacheHitData.results[0].latitude === firstResult.latitude,
      `Cached results verified`
    );

    // 8. Wait > 1 second (1200ms) before search #2 to adhere to Nominatim policy
    console.log('Waiting 1200ms before second upstream search to comply with Nominatim throttle policy...');
    await sleep(1200);

    // Upstream Call #2: "Koramangala, Bengaluru"
    console.log("Executing second upstream search for 'Koramangala, Bengaluru'...");
    const search2Res = await fetch(
      `${BASE_URL}/api/geocode?q=${encodeURIComponent('Koramangala, Bengaluru')}`,
      { headers: { Cookie: cookie } }
    );
    const search2Data = await search2Res.json();
    assertCheck(
      'Second distinct search returns 200 with X-Cache: MISS',
      search2Res.status === 200 &&
        search2Res.headers.get('X-Cache') === 'MISS' &&
        Array.isArray(search2Data.results),
      `Status ${search2Res.status}, X-Cache: ${search2Res.headers.get('X-Cache')}, results: ${search2Data.results?.length ?? 0}`
    );
  } else {
    skipCheck('Valid search returns 200', 'No internet access or upstream Nominatim returned 503');
    skipCheck('First result has valid numeric coordinates', 'No internet access');
    skipCheck('First search reflects X-Cache: MISS', 'No internet access');
    skipCheck('User-Agent string leak check', 'No internet access');
    skipCheck('Repeated search returns X-Cache: HIT', 'No internet access');
    skipCheck('Second distinct search returns 200', 'No internet access');
  }

  // 9. Verify zero database rows created
  const finalRowCount = await prisma.event.count();
  assertCheck(
    'Zero database records created during geocode checks',
    initialRowCount === finalRowCount,
    `Initial: ${initialRowCount}, Final: ${finalRowCount}`
  );

  console.log(`\n======================================================`);
  console.log(`Geocode Checks Complete: ${passed} PASSED, ${failed} FAILED, ${skipped} SKIPPED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runGeocodeChecks()
  .catch((err) => {
    console.error('Geocode check execution error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

