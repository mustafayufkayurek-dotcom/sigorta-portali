const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch {}
        resolve({ status: res.statusCode, body: json, raw: data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assertStatus(result, allowed, label) {
  if (!allowed.includes(result.status)) {
    throw new Error(`${label} expected ${allowed.join('/')} got ${result.status} body=${JSON.stringify(result.body || result.raw)}`);
  }
}

(async () => {
  const report = { scenarios: [], evidence: {} };
  let createdUserId = null;
  let originalFirstName = null;
  let originalScreenPermissions = null;
  try {
    const login = await request('POST', '/api/v1/auth/login', { email: 'admin@meridyenassistance.com', password: 'admin123' });
    assertStatus(login, [200, 201], 'login');
    const token = login.body?.data?.tokens?.accessToken || login.body?.tokens?.accessToken;
    const admin = login.body?.data?.user || login.body?.user;
    if (!token || !admin?.id) throw new Error('login token/admin missing');
    const adminId = admin.id;
    originalFirstName = admin.firstName;
    report.evidence.loginStatus = login.status;
    report.evidence.adminId = adminId;

    const s1 = await request('GET', '/api/v1/health');
    assertStatus(s1, [200], 'scenario1');
    report.scenarios.push({ id: 1, status: 'PASS', httpStatus: s1.status });

    const s2 = await request('GET', '/api/v1/auth/me', null, token);
    assertStatus(s2, [200], 'scenario2');
    report.scenarios.push({ id: 2, status: 'PASS', httpStatus: s2.status });

    const s3 = await request('GET', `/api/v1/users/${adminId}/screen-permissions`, null, token);
    assertStatus(s3, [200], 'scenario3');
    originalScreenPermissions = s3.body?.data?.screens || s3.body?.screens || [];
    const sanitizedScreens = originalScreenPermissions.map(({ code, canView, canEdit }) => ({ code, canView, canEdit }));
    report.evidence.scenario4SanitizedPayload = sanitizedScreens;
    report.evidence.scenario4OriginalFields = originalScreenPermissions[0] ? Object.keys(originalScreenPermissions[0]) : [];
    report.scenarios.push({ id: 3, status: 'PASS', httpStatus: s3.status, screens: sanitizedScreens.length });

    const s4 = await request('PUT', `/api/v1/users/${adminId}/screen-permissions`, { screens: sanitizedScreens }, token);
    assertStatus(s4, [200, 204], 'scenario4-update');
    const s4restore = await request('PUT', `/api/v1/users/${adminId}/screen-permissions`, { screens: sanitizedScreens }, token);
    assertStatus(s4restore, [200, 204], 'scenario4-restore');
    report.scenarios.push({ id: 4, status: 'PASS', httpStatus: s4.status, restoreStatus: s4restore.status });

    const meUser = s2.body?.data || s2.body;
    const insuranceCompanyIds = (meUser?.insuranceCompanyScopes || meUser?.insuranceCompanies || []).map((item) => item.id).filter(Boolean);
    const s5 = await request('PUT', `/api/v1/users/${adminId}/insurance-company-scopes`, { insuranceCompanyIds }, token);
    assertStatus(s5, [200, 204], 'scenario5');
    report.evidence.scenario5Payload = { insuranceCompanyIds };
    report.scenarios.push({ id: 5, status: 'PASS', httpStatus: s5.status, count: insuranceCompanyIds.length });

    const s6 = await request('GET', `/api/v1/users/${adminId}`, null, token);
    assertStatus(s6, [200], 'scenario6');
    report.scenarios.push({ id: 6, status: 'PASS', httpStatus: s6.status });

    const roles = await request('GET', '/api/v1/roles', null, token);
    assertStatus(roles, [200], 'roles');
    const roleId = roles.body?.data?.[0]?.id || roles.body?.data?.roles?.[0]?.id || roles.body?.roles?.[0]?.id;
    if (!roleId) throw new Error('roleId missing');
    const createPayload = {
      email: 'smoke-test-son-20260520@test.com',
      firstName: 'Smoke',
      lastName: 'Test',
      password: 'SmokeTest123!',
      roleId,
    };
    report.evidence.scenario7Payload = createPayload;
    const s7 = await request('POST', '/api/v1/users', createPayload, token);
    assertStatus(s7, [201], 'scenario7');
    createdUserId = s7.body?.data?.id || s7.body?.id;
    if (!createdUserId) throw new Error('created user id missing');
    const s7delete = await request('DELETE', `/api/v1/users/${createdUserId}`, null, token);
    assertStatus(s7delete, [200, 204], 'scenario7-delete');
    report.scenarios.push({ id: 7, status: 'PASS', httpStatus: s7.status, deleteStatus: s7delete.status, createdUserId });

    const s8 = await request('PATCH', `/api/v1/users/${adminId}`, { firstName: 'Test' }, token);
    assertStatus(s8, [200], 'scenario8-update');
    const s8restore = await request('PATCH', `/api/v1/users/${adminId}`, { firstName: originalFirstName }, token);
    assertStatus(s8restore, [200], 'scenario8-restore');
    report.evidence.scenario8Restore = { from: 'Test', to: originalFirstName };
    report.scenarios.push({ id: 8, status: 'PASS', httpStatus: s8.status, restoreStatus: s8restore.status });

    report.result = '8/8 PASS';
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.result = 'FAIL';
    report.error = error.message;
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }
})();
