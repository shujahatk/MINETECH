import 'dotenv/config';

async function verifyApp() {
  console.log('🧪 [VERIFICATION] Testing Admin Login & Route Integrity...\n');

  // 1. Test Admin Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@8020aquisition.com', password: 'AdminPassword2026!' })
  });
  const loginData = await loginRes.json();
  console.log(`🔐 Admin Login Response: HTTP ${loginRes.status} | success: ${loginData.success} | user: ${loginData.user?.email} (${loginData.user?.role})`);

  const token = loginData.token;
  const cookie = loginRes.headers.get('set-cookie');
  const authHeaders = {
    'Authorization': 'Bearer ' + token,
    ...(cookie ? { 'Cookie': cookie } : {})
  };

  // 2. Test UI pages and APIs
  const routes = [
    { path: '/dashboard', type: 'page' },
    { path: '/leads', type: 'page' },
    { path: '/workstation', type: 'page' },
    { path: '/email/blasts', type: 'page' },
    { path: '/email/inbox', type: 'page' },
    { path: '/api/dashboard/stats', type: 'api' },
    { path: '/api/leads', type: 'api' },
    { path: '/api/leads/queue', type: 'api' },
    { path: '/api/email/inbox', type: 'api' },
    { path: '/api/email/campaigns', type: 'api' },
    { path: '/api/email/templates', type: 'api' },
    { path: '/api/email/sequences', type: 'api' }
  ];

  console.log('\n🌐 [PAGE & API ROUTE VERIFICATION]');
  for (const r of routes) {
    try {
      const res = await fetch('http://localhost:3000' + r.path, { headers: authHeaders });
      let extra = '';
      if (r.type === 'api') {
        const json = await res.json();
        const count = json.count ?? json.data?.length ?? (Array.isArray(json.leads) ? json.leads.length : null) ?? 'OK';
        extra = `| Data Count: ${count}`;
      }
      console.log(`[${r.type.toUpperCase().padEnd(4)}] ${r.path.padEnd(25)} -> HTTP ${res.status} ${extra}`);
    } catch(e) {
      console.error(`[${r.type.toUpperCase()}] ${r.path} -> Error: ${e.message}`);
    }
  }

  console.log('\n✅ [ALL VERIFICATIONS COMPLETE]');
}

verifyApp();
