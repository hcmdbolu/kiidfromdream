const BASE_URL = 'http://127.0.0.1:3000';

async function testAuthSecurity() {
  console.log('\n=============================================================');
  console.log('       AUTHENTICATION & SECURITY VERIFICATION SUITE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Valid Super Admin credentials (seeded on all clean installs)
  const res1 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Boluwatife', pin: '2030170611' }),
  });
  const data1 = await res1.json();
  assert(res1.status === 200 && data1.success && data1.staff.role === 'Super Admin', '1. Super Admin Boluwatife logs in successfully and receives token');
  const adminToken = data1.token;

  // 2. Quick-PIN-only entry (no username required for touch POS)
  const res2 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '2030170611' }),
  });
  const data2 = await res2.json();
  assert(res2.status === 200 && data2.success && data2.staff.staff_id === 'STAFF-SUPER-001', '2. PIN-only entry auto-identifies Boluwatife (STAFF-SUPER-001)');

  // 3. Invalid credentials rejection
  const res3 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Boluwatife', pin: '0000' }),
  });
  assert(res3.status === 401, '3. Invalid PIN is rejected with HTTP 401');

  // 4. Rate limiting test: Enter wrong password multiple times for a test user
  console.log('\n  Testing brute-force rate limiter (5 failed attempts)...');
  const testUser = `rate_test_${Date.now()}`;
  for (let i = 1; i <= 4; i++) {
    const resFail = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, pin: 'wrongpin' }),
    });
    const dataFail = await resFail.json();
    assert(resFail.status === 401 && dataFail.attemptsRemaining === 5 - i, `Attempt ${i}: Returns HTTP 401 with ${5 - i} attempts remaining`);
  }

  // 5th failed attempt -> Must trigger HTTP 429
  const resLockout = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testUser, pin: 'wrongpin' }),
  });
  const dataLockout = await resLockout.json();
  assert(resLockout.status === 429 && dataLockout.isLocked === true && dataLockout.retryAfterSeconds > 0, '5th Attempt: Triggers HTTP 429 Too Many Requests with lockout countdown');

  // Next attempt while locked -> Must still return HTTP 429
  const resStillLocked = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testUser, pin: 'wrongpin' }),
  });
  const dataStillLocked = await resStillLocked.json();
  assert(resStillLocked.status === 429 && dataStillLocked.isLocked === true, 'Subsequent Attempt: Remains locked with HTTP 429');

  // 5. Admin unlock reset
  const resUnlock = await fetch(`${BASE_URL}/api/auth/unlock`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
  });
  const dataUnlock = await resUnlock.json();
  assert(resUnlock.status === 200 && dataUnlock.success === true, '6. Admin authorization unlocks all rate-limiting lockouts');

  console.log('\n=============================================================');
  console.log(`SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================================\n');

  if (failed > 0) process.exit(1);
}

testAuthSecurity();
