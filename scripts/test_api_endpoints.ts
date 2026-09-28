const BASE_URL = 'http://127.0.0.1:3000';

interface ApiResult {
  endpoint: string;
  method: string;
  status: number;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: ApiResult[] = [];

async function testEndpoint(
  method: string, 
  path: string, 
  body?: any, 
  headers?: Record<string, string>,
  expectedStatus: number = 200,
  validator?: (data: any) => boolean
) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const json = await res.json().catch(() => null);

    let passed = res.status === expectedStatus;
    let error: string | undefined;

    if (passed && validator && json) {
      if (!validator(json)) {
        passed = false;
        error = `Validator failed on payload: ${JSON.stringify(json).slice(0, 100)}`;
      }
    }

    if (!passed && !error) {
      error = `Expected HTTP ${expectedStatus}, got ${res.status}: ${JSON.stringify(json).slice(0, 100)}`;
    }

    results.push({
      endpoint: path,
      method,
      status: res.status,
      passed,
      error,
      durationMs,
    });

    if (passed) {
      console.log(`  ✓ [HTTP ${res.status}] ${method} ${path} (${durationMs}ms)`);
    } else {
      console.error(`  ✗ [HTTP ${res.status}] ${method} ${path} (${durationMs}ms): ${error}`);
    }
    return json;
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({
      endpoint: path,
      method,
      status: 0,
      passed: false,
      error: err.message,
      durationMs,
    });
    console.error(`  ✗ [ERR] ${method} ${path} (${durationMs}ms): ${err.message}`);
    return null;
  }
}

async function run() {
  console.log('\n=============================================================');
  console.log('       LIVE BACKEND API ENDPOINT VERIFICATION');
  console.log('=============================================================\n');

  // 1. Health
  await testEndpoint('GET', '/api/health', undefined, undefined, 200, (d) => d.status === 'ok');

  // 2. Status & Counts
  await testEndpoint('GET', '/api/status', undefined, undefined, 200, (d) => {
    return d.status === 'online' && d.counts && d.counts.products >= 12 && d.counts.sales >= 15;
  });

  // 3. Incremental Polling
  await testEndpoint('GET', '/api/poll?version=0', undefined, undefined, 200, (d) => d.hasUpdates === true);

  // 4. Receipt Settings GET
  await testEndpoint('GET', '/api/receipt-settings', undefined, undefined, 200, (d) => {
    return d.success === true && d.settings && d.settings.business_name.length > 0;
  });

  // 5. Auth Login - Valid Cashier PIN
  const loginRes = await testEndpoint(
    'POST', 
    '/api/auth/login', 
    { username: 'kola', pin: '1111' }, 
    undefined, 
    200, 
    (d) => d.success === true && d.token && d.staff?.role === 'Cashier'
  );

  const cashierToken = loginRes?.token;

  // 6. Auth Login - Invalid PIN Rejected
  await testEndpoint(
    'POST', 
    '/api/auth/login', 
    { username: 'kola', pin: '9999' }, 
    undefined, 
    401, 
    (d) => d.success === false
  );

  // 7. Receipt Settings POST (Save new config with auth header)
  await testEndpoint(
    'POST',
    '/api/receipt-settings',
    {
      settings: {
        id: 'DEFAULT_RECEIPT_CONFIG',
        business_name: 'KIID FROM DREAM LTD',
        tagline: 'Premium Cold Room & Seafood Terminal (Audit Verified)',
        address_line1: 'Shop 14, Lekki Fish Market Phase 1',
        address_line2: 'Lekki-Epe Expressway, Lagos, Nigeria',
        phone_numbers: '+234 803 123 4567 / 0800-FISH-POS',
        email: 'sales@kiidfromdream.com',
        tax_or_cac_number: 'RC: 1984201 | TIN: 248109-0001',
        footer_thank_you: 'Thank you for choosing KIID FROM DREAM!',
        footer_policy_notice: 'Fresh fish guaranteed. Inspect fish before cold-chain handover. No returns on thawed frozen goods.',
        custom_notes: 'Tested and verified by Enterprise Audit Suite.',
        logo_base64: null,
        show_logo: true,
        show_barcode: true,
        show_cashier_name: true,
        show_tax_details: true,
        paper_width: '80mm',
        updated_at: new Date().toISOString(),
        updated_by_staff_name: 'Alex Abiri (Admin)',
      }
    },
    { Authorization: `Bearer ${cashierToken}` },
    200,
    (d) => d.success === true && d.settings?.tagline.includes('Audit Verified')
  );

  // 8. Admin Backup Export
  await testEndpoint(
    'GET',
    '/api/admin/backup',
    undefined,
    { Authorization: `Bearer ${cashierToken}` },
    200,
    (d) => d.success === true && d.backup?.products?.length >= 12
  );

  // 9. Record a Live Sale Transaction via POST /api/sales
  const liveSale = {
    transaction_id: `TXN-AUDIT-${Date.now()}`,
    date_time: new Date().toISOString(),
    items: [
      {
        item_sn: 'FISH-00001',
        item_name: 'Fresh Live Catfish (Point & Kill)',
        quantity_sold: 2.0,
        unit: 'KG',
        unit_price: 3600,
        total_amount: 7200,
        cost_price: 2600,
      }
    ],
    total_amount: 7200,
    discount_applied: 0,
    final_amount: 7200,
    payment_method: 'Cash',
    amount_paid: 10000,
    change_due: 2800,
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00103',
    status: 'COMPLETED',
  };

  await testEndpoint(
    'POST',
    '/api/sales',
    { transaction: liveSale },
    { Authorization: `Bearer ${cashierToken}` },
    200,
    (d) => d.success === true && d.transaction?.transaction_id === liveSale.transaction_id
  );

  console.log('\n=============================================================');
  console.log('            API ENDPOINT AUDIT SUMMARY');
  console.log('=============================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total API Endpoints Tested : ${total}`);
  console.log(`Passed                     : ${passed}`);
  console.log(`Failed                     : ${failed}`);
  console.log(`Success Rate               : ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('[API AUDIT ERROR]:', err);
  process.exit(1);
});
