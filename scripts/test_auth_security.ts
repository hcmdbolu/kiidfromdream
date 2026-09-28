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

  // 1. Valid Cashier credentials
  const res1 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'kola', pin: '1111' }),
  });
  const data1 = await res1.json();
  assert(res1.status === 200 && data1.success && data1.staff.role === 'Cashier', '1. Cashier kola with PIN 1111 logs in successfully');

  // 2. Valid Admin credentials
  const res2 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', pin: '9999' }),
  });
  const data2 = await res2.json();
  assert(res2.status === 200 && data2.success && data2.staff.role === 'Admin', '2. Admin with PIN 9999 logs in successfully and receives token');
  const adminToken = data2.token;

  // 3. Quick-PIN-only entry (no username required for touch POS)
  const res3 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '2222' }), // Tayo's PIN
  });
  const data3 = await res3.json();
  assert(res3.status === 200 && data3.success && data3.staff.staff_id === 'STAFF-002', '3. PIN-only entry (2222) auto-identifies Tayo (STAFF-002)');

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
