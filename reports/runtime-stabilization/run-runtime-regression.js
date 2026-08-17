const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const BASE_URL = 'https://app.meridyen-tr.com';
const API_BASE = `${BASE_URL}/api/v1`;
const ADMIN_EMAIL = 'admin@meridyenassistance.com';
const ADMIN_PASSWORD = 'admin123';
const OUT_DIR = __dirname;
const EVIDENCE_DIR = path.join(OUT_DIR, 'evidence');
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, 'screenshots');

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function writeJson(name, data) {
  const target = path.join(EVIDENCE_DIR, name);
  fs.writeFileSync(target, JSON.stringify(data, null, 2));
  return target;
}

function writeText(name, data) {
  const target = path.join(EVIDENCE_DIR, name);
  fs.writeFileSync(target, data);
  return target;
}

function request(method, route, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const url = new URL(route.startsWith('http') ? route : `${API_BASE}${route}`);
    const req = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': payload.length } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
            text: raw,
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(email, password) {
  const response = await request('POST', '/auth/login', { email, password });
  return {
    response,
    token: response.body?.data?.tokens?.accessToken ?? null,
    refreshToken: response.body?.data?.tokens?.refreshToken ?? null,
    user: response.body?.data?.user ?? null,
  };
}

function decodeJwtWithoutVerify(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function makeExpiredLikeToken(validToken) {
  const decoded = decodeJwtWithoutVerify(validToken);
  if (!decoded) return 'invalid.token.value';
  const expired = {
    ...decoded,
    exp: Math.floor(Date.now() / 1000) - 3600,
  };
  const parts = validToken.split('.');
  parts[1] = Buffer.from(JSON.stringify(expired)).toString('base64url');
  return parts.join('.');
}

function normalizeUserResponse(response) {
  return response?.body?.data ?? response?.body ?? null;
}

async function main() {
  const results = [];
  const createdUserIds = [];
  const loginAdmin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!loginAdmin.token) {
    throw new Error(`Admin login failed: ${loginAdmin.response.status}`);
  }
  writeJson('auth-admin-login.json', loginAdmin.response);

  const adminToken = loginAdmin.token;
  const rolesRes = await request('GET', '/roles', null, adminToken);
  const departmentsRes = await request('GET', '/departments', null, adminToken);
  const insuranceCompaniesRes = await request('GET', '/insurance-companies?page=1&limit=20', null, adminToken);
  const usersRes = await request('GET', '/users?page=1&limit=100', null, adminToken);

  writeJson('roles.json', rolesRes);
  writeJson('departments.json', departmentsRes);
  writeJson('insurance-companies.json', insuranceCompaniesRes);
  writeJson('users-page1.json', usersRes);

  const roles = rolesRes.body?.data ?? [];
  const departments = departmentsRes.body?.data ?? [];
  const insuranceCompanies = insuranceCompaniesRes.body?.data ?? [];
  const users = usersRes.body?.data ?? [];

  const roleByCode = Object.fromEntries(roles.map((role) => [role.code, role]));
  const fieldStaffRole = roleByCode.field_staff;
  const officeStaffRole = roleByCode.office_staff;
  const insuranceCompanyRole = roleByCode.insurance_company_user;
  const expertRole = roleByCode.expert;
  const adminRole = roleByCode.admin;

  const departmentA = departments[0];
  const departmentB = departments[1] ?? departments[0];

  async function createUser(payload, label) {
    const response = await request('POST', '/users', payload, adminToken);
    writeJson(`${label}-create-response.json`, response);
    const id = response.body?.data?.id;
    if (id) createdUserIds.push(id);
    return response;
  }

  async function updateUser(id, payload, label) {
    const response = await request('PATCH', `/users/${id}`, payload, adminToken);
    writeJson(`${label}-update-response.json`, response);
    return response;
  }

  async function getUser(id, label) {
    const response = await request('GET', `/users/${id}`, null, adminToken);
    writeJson(`${label}-get-response.json`, response);
    return response;
  }

  const hydrationUser = users[0];
  const hydrationRes = hydrationUser ? await getUser(hydrationUser.id, 'test1-hydration') : null;
  let playwrightOutcome = null;
  if (hydrationUser) {
    const pwScript = path.join(OUT_DIR, 'ui-hydration-check.js');
    const pwRun = spawnSync(process.execPath, [pwScript, hydrationUser.id, SCREENSHOT_DIR], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BASE_URL,
        API_BASE,
        ADMIN_EMAIL,
        ADMIN_PASSWORD,
      },
      encoding: 'utf8',
      timeout: 180000,
    });
    writeText('test1-playwright-stdout.txt', pwRun.stdout || '');
    writeText('test1-playwright-stderr.txt', pwRun.stderr || '');
    try {
      playwrightOutcome = JSON.parse((pwRun.stdout || '').trim().split('\n').filter(Boolean).pop() || 'null');
    } catch {
      playwrightOutcome = null;
    }
  }
  const hydrationData = normalizeUserResponse(hydrationRes);
  const test1Pass = Boolean(
    hydrationData &&
      hydrationData.firstName &&
      hydrationData.lastName &&
      hydrationData.email &&
      hydrationData.role &&
      Array.isArray(hydrationData.departmentMemberships) &&
      Array.isArray(hydrationData.responsibilityAssignments) &&
      playwrightOutcome?.hydrated === true,
  );
  results.push({
    index: 1,
    name: 'GET /users/:id hydration doğrulaması',
    status: test1Pass ? 'PASS' : 'FAIL',
    evidence: [
      path.join(EVIDENCE_DIR, 'test1-hydration-get-response.json'),
      path.join(EVIDENCE_DIR, 'test1-playwright-stdout.txt'),
      ...(playwrightOutcome?.screenshot ? [playwrightOutcome.screenshot] : []),
    ],
    notes: {
      userId: hydrationUser?.id ?? null,
      apiFields: hydrationData
        ? {
            firstName: hydrationData.firstName,
            lastName: hydrationData.lastName,
            email: hydrationData.email,
            roleCode: hydrationData.role?.code ?? null,
            departmentMembershipCount: hydrationData.departmentMemberships?.length ?? null,
            responsibilityAssignmentCount: hydrationData.responsibilityAssignments?.length ?? null,
          }
        : null,
      ui: playwrightOutcome,
    },
  });

  let insuranceTestStatus = 'FAIL';
  const insuranceUserPayload = {
    firstName: 'Rt Insurance',
    lastName: 'Scope',
    email: `rt.insurance.scope.${Date.now()}@meridyenassistance.com`,
    password: 'Test1234!',
    roleId: insuranceCompanyRole?.id,
    status: 'active',
    isWebUser: true,
    isMobileUser: false,
  };
  const insuranceCreate = insuranceCompanyRole ? await createUser(insuranceUserPayload, 'test2-insurance-user') : null;
  const insuranceUserId = insuranceCreate?.body?.data?.id;
  let insuranceScopePut = null;
  let insuranceGet = null;
  let scopedClaimFiles = null;
  if (insuranceUserId && insuranceCompanies.length >= 2) {
    const allowedCompany = insuranceCompanies[0];
    const blockedCompany = insuranceCompanies[1];
    insuranceScopePut = await request('PUT', `/users/${insuranceUserId}/insurance-company-scopes`, { insuranceCompanyIds: [allowedCompany.id] }, adminToken);
    writeJson('test2-insurance-scope-put.json', insuranceScopePut);
    insuranceGet = await getUser(insuranceUserId, 'test2-insurance-user');
    const insuranceLogin = await login(insuranceUserPayload.email, insuranceUserPayload.password);
    writeJson('test2-insurance-login.json', insuranceLogin.response);
    if (insuranceLogin.token) {
      const ownFiles = await request('GET', `/claim-files?page=1&limit=50&insuranceCompanyIds=${allowedCompany.id}`, null, insuranceLogin.token);
      const otherFiles = await request('GET', `/claim-files?page=1&limit=50&insuranceCompanyIds=${blockedCompany.id}`, null, insuranceLogin.token);
      scopedClaimFiles = { ownFiles, otherFiles, allowedCompany, blockedCompany };
      writeJson('test2-claim-files-own.json', ownFiles);
      writeJson('test2-claim-files-other.json', otherFiles);
      const ownOk = (ownFiles.body?.data ?? []).every((item) => item.insuranceCompanyId === allowedCompany.id);
      const otherBlocked = (otherFiles.body?.data ?? []).every((item) => item.insuranceCompanyId === allowedCompany.id);
      insuranceTestStatus = ownOk && otherBlocked ? 'PASS' : 'FAIL';
    }
  }
  results.push({
    index: 2,
    name: 'insurance_company_user izolasyonu',
    status: insuranceTestStatus,
    evidence: [
      path.join(EVIDENCE_DIR, 'test2-insurance-user-create-response.json'),
      path.join(EVIDENCE_DIR, 'test2-insurance-scope-put.json'),
      path.join(EVIDENCE_DIR, 'test2-insurance-user-get-response.json'),
      path.join(EVIDENCE_DIR, 'test2-claim-files-own.json'),
      path.join(EVIDENCE_DIR, 'test2-claim-files-other.json'),
    ],
    notes: scopedClaimFiles
      ? {
          allowedCompanyId: scopedClaimFiles.allowedCompany.id,
          blockedCompanyId: scopedClaimFiles.blockedCompany.id,
          ownCount: scopedClaimFiles.ownFiles.body?.data?.length ?? null,
          otherCount: scopedClaimFiles.otherFiles.body?.data?.length ?? null,
        }
      : { reason: 'Role or scope endpoint unavailable' },
  });

  const nestedPayload = {
    firstName: 'Rt Nested',
    lastName: 'Create',
    email: `rt.nested.${Date.now()}@meridyenassistance.com`,
    password: 'Test1234!',
    roleId: officeStaffRole?.id ?? adminRole?.id,
    status: 'active',
    departmentMemberships: [
      { departmentId: departmentA?.id, isPrimary: true },
      { departmentId: departmentB?.id, isPrimary: false },
    ],
    responsibilityAssignments: [
      { departmentId: departmentA?.id, countrywide: true, coverageType: 'office' },
      { departmentId: departmentB?.id, countrywide: false, coverageType: 'district' },
    ],
  };
  const nestedCreate = await createUser(nestedPayload, 'test3-nested');
  const nestedId = nestedCreate.body?.data?.id;
  const nestedGet1 = nestedId ? await getUser(nestedId, 'test3-nested-after-create') : null;
  const nestedUpdatePayload = {
    firstName: 'Rt Nested Updated',
    departmentMemberships: [{ departmentId: departmentB?.id, isPrimary: true }],
    responsibilityAssignments: [{ departmentId: departmentB?.id, countrywide: true, coverageType: 'updated' }],
  };
  const nestedUpdate = nestedId ? await updateUser(nestedId, nestedUpdatePayload, 'test3-nested') : null;
  const nestedGet2 = nestedId ? await getUser(nestedId, 'test3-nested-after-update') : null;
  const nestedCreateUser = normalizeUserResponse(nestedGet1);
  const nestedUpdatedUser = normalizeUserResponse(nestedGet2);
  const test3Pass = Boolean(
    nestedId &&
      nestedCreate.status === 201 &&
      nestedCreateUser?.departmentMemberships?.length === 2 &&
      nestedCreateUser?.responsibilityAssignments?.length === 2 &&
      nestedUpdate?.status === 200 &&
      nestedUpdatedUser?.departmentMemberships?.length === 1 &&
      nestedUpdatedUser?.departmentMemberships?.[0]?.departmentId === departmentB?.id &&
      nestedUpdatedUser?.responsibilityAssignments?.length === 1 &&
      nestedUpdatedUser?.responsibilityAssignments?.[0]?.departmentId === departmentB?.id,
  );
  results.push({
    index: 3,
    name: 'Nested create/update payload korunumu',
    status: test3Pass ? 'PASS' : 'FAIL',
    evidence: [
      path.join(EVIDENCE_DIR, 'test3-nested-create-response.json'),
      path.join(EVIDENCE_DIR, 'test3-nested-after-create-get-response.json'),
      path.join(EVIDENCE_DIR, 'test3-nested-update-response.json'),
      path.join(EVIDENCE_DIR, 'test3-nested-after-update-get-response.json'),
    ],
    notes: { userId: nestedId ?? null },
  });

  const roleSwitchPayload = {
    firstName: 'Rt Switch',
    lastName: 'Screen',
    email: `rt.roleswitch.${Date.now()}@meridyenassistance.com`,
    password: 'Test1234!',
    roleId: fieldStaffRole?.id ?? adminRole?.id,
    status: 'active',
    departmentMemberships: [{ departmentId: departmentA?.id, isPrimary: true }],
    responsibilityAssignments: [{ departmentId: departmentA?.id, countrywide: true, coverageType: 'field' }],
  };
  const roleSwitchCreate = await createUser(roleSwitchPayload, 'test4-role-switch');
  const roleSwitchId = roleSwitchCreate.body?.data?.id;
  let screenPut = null;
  let roleSwitchUpdate = null;
  let screenAfterRoleSwitch = null;
  let staleRoleUser = null;
  if (roleSwitchId) {
    screenPut = await request(
      'PUT',
      `/users/${roleSwitchId}/screen-permissions`,
      { screens: [{ code: 'kullanicilar', canView: true }, { code: 'raporlar', canView: true }] },
      adminToken,
    );
    writeJson('test4-screen-put.json', screenPut);
    roleSwitchUpdate = await updateUser(roleSwitchId, { roleId: officeStaffRole?.id }, 'test4-role-switch-office');
    screenAfterRoleSwitch = await request('GET', `/users/${roleSwitchId}/screen-permissions?roleCode=office_staff`, null, adminToken);
    writeJson('test4-screen-after-role-switch.json', screenAfterRoleSwitch);
    staleRoleUser = await getUser(roleSwitchId, 'test4-role-switch-user');
  }
  const staleScreens = screenAfterRoleSwitch?.body?.data?.screens?.filter((screen) => screen.canView).map((screen) => screen.code) ?? [];
  const test4Pass = staleScreens.length === 0;
  results.push({
    index: 4,
    name: 'Hidden payload temizliği (role switch regression)',
    status: test4Pass ? 'PASS' : 'FAIL',
    evidence: [
      path.join(EVIDENCE_DIR, 'test4-role-switch-create-response.json'),
      path.join(EVIDENCE_DIR, 'test4-screen-put.json'),
      path.join(EVIDENCE_DIR, 'test4-role-switch-office-update-response.json'),
      path.join(EVIDENCE_DIR, 'test4-screen-after-role-switch.json'),
      path.join(EVIDENCE_DIR, 'test4-role-switch-user-get-response.json'),
    ],
    notes: { userId: roleSwitchId ?? null, staleScreens },
  });

  const primaryPayload = {
    firstName: 'Rt Primary',
    lastName: 'Validation',
    email: `rt.primary.${Date.now()}@meridyenassistance.com`,
    password: 'Test1234!',
    roleId: officeStaffRole?.id ?? adminRole?.id,
    status: 'active',
    departmentMemberships: [
      { departmentId: departmentA?.id, isPrimary: true },
      { departmentId: departmentB?.id, isPrimary: false },
    ],
  };
  const primaryCreate = await createUser(primaryPayload, 'test5-primary');
  const primaryId = primaryCreate.body?.data?.id;
  const primaryGet = primaryId ? await getUser(primaryId, 'test5-primary') : null;
  const missingPrimaryUpdate = primaryId
    ? await updateUser(
        primaryId,
        {
          departmentMemberships: [
            { departmentId: departmentA?.id, isPrimary: false },
            { departmentId: departmentB?.id, isPrimary: false },
          ],
        },
        'test5-primary-missing',
      )
    : null;
  const sql = primaryId
    ? `SELECT user_id, department_id, is_primary FROM user_department_memberships WHERE user_id = '${primaryId}' ORDER BY is_primary DESC, created_at ASC;`
    : '';
  const dbQuery = primaryId
    ? spawnSync(
        'ssh',
        ['root@94.138.216.18', `docker exec sigorta-backend npx prisma db execute --stdin <<'SQL'\n${sql}\nSQL`],
        { encoding: 'utf8', timeout: 180000 },
      )
    : null;
  if (dbQuery) {
    writeText('test5-db-query-stdout.txt', dbQuery.stdout || '');
    writeText('test5-db-query-stderr.txt', dbQuery.stderr || '');
  }
  const primaryGetData = normalizeUserResponse(primaryGet);
  const currentPrimary = primaryGetData?.departmentMemberships?.find((item) => item.isPrimary);
  const test5Pass = Boolean(currentPrimary?.departmentId === departmentA?.id) && missingPrimaryUpdate?.status >= 400;
  results.push({
    index: 5,
    name: 'isPrimary validasyon regresyonu',
    status: test5Pass ? 'PASS' : 'FAIL',
    evidence: [
      path.join(EVIDENCE_DIR, 'test5-primary-create-response.json'),
      path.join(EVIDENCE_DIR, 'test5-primary-get-response.json'),
      path.join(EVIDENCE_DIR, 'test5-primary-missing-update-response.json'),
      path.join(EVIDENCE_DIR, 'test5-db-query-stdout.txt'),
    ],
    notes: {
      userId: primaryId ?? null,
      currentPrimaryDepartmentId: currentPrimary?.departmentId ?? null,
      missingPrimaryStatus: missingPrimaryUpdate?.status ?? null,
      dbQueryExitCode: dbQuery?.status ?? null,
    },
  });

  const invalidToken = 'totally.invalid.token';
  const expiredLikeToken = makeExpiredLikeToken(adminToken);
  const jwtAdmin = await request('GET', '/users?page=1&limit=1', null, adminToken);
  const jwtInvalid = await request('GET', '/users?page=1&limit=1', null, invalidToken);
  const jwtExpired = await request('GET', '/users?page=1&limit=1', null, expiredLikeToken);
  const jwtMissing = await request('GET', '/users?page=1&limit=1', null, null);
  writeJson('test6-jwt-admin.json', jwtAdmin);
  writeJson('test6-jwt-invalid.json', jwtInvalid);
  writeJson('test6-jwt-expired.json', jwtExpired);
  writeJson('test6-jwt-missing.json', jwtMissing);
  const test6Pass = jwtAdmin.status === 200 && jwtInvalid.status === 401 && jwtExpired.status === 401 && jwtMissing.status === 401;
  results.push({
    index: 6,
    name: 'JWT / permission regresyon testi',
    status: test6Pass ? 'PASS' : 'FAIL',
    evidence: [
      path.join(EVIDENCE_DIR, 'test6-jwt-admin.json'),
      path.join(EVIDENCE_DIR, 'test6-jwt-invalid.json'),
      path.join(EVIDENCE_DIR, 'test6-jwt-expired.json'),
      path.join(EVIDENCE_DIR, 'test6-jwt-missing.json'),
    ],
    notes: {
      admin: jwtAdmin.status,
      invalid: jwtInvalid.status,
      expired: jwtExpired.status,
      missing: jwtMissing.status,
    },
  });

  let expertUser = users.find((user) => user.role?.code === 'expert');
  let expertCredentials = null;
  if (!expertUser && expertRole) {
    const createdExpert = await createUser(
      {
        firstName: 'Rt Expert',
        lastName: 'Portal',
        email: `rt.expert.${Date.now()}@meridyenassistance.com`,
        password: 'Test1234!',
        roleId: expertRole.id,
        status: 'active',
        isWebUser: true,
      },
      'test7-expert',
    );
    expertUser = createdExpert.body?.data ?? null;
    expertCredentials = { email: `rt.expert.${Date.now()}@meridyenassistance.com`, password: 'Test1234!' };
  }
  const expertEmail = expertUser?.email;
  const expertPassword = expertCredentials?.password ?? 'admin123';
  const expertLogin = expertEmail ? await login(expertEmail, expertPassword) : null;
  if (expertLogin) writeJson('test7-expert-login.json', expertLogin.response);
  const expert403 = expertLogin?.token
    ? await request(
        'POST',
        '/users',
        {
          firstName: 'Forbidden',
          lastName: 'User',
          email: `forbidden.${Date.now()}@meridyenassistance.com`,
          password: 'Test1234!',
          roleId: adminRole?.id,
        },
        expertLogin.token,
      )
    : null;
  if (expert403) writeJson('test7-expert-admin-endpoint.json', expert403);
  const allClaimFiles = await request('GET', '/claim-files?page=1&limit=20', null, adminToken);
  writeJson('test7-claim-files-admin-sample.json', allClaimFiles);
  let expertOwn = null;
  let expertOther = null;
  if (expertLogin?.token) {
    const ownAdjusterId = expertLogin.user?.adjusterId ?? expertLogin.response.body?.data?.user?.adjusterId ?? null;
    const adminFiles = allClaimFiles.body?.data ?? [];
    const ownFile = adminFiles.find((file) => ownAdjusterId && file.assignedAdjusterId === ownAdjusterId);
    const otherFile = adminFiles.find((file) => !ownAdjusterId || file.assignedAdjusterId !== ownAdjusterId);
    if (ownFile) {
      expertOwn = await request('GET', `/claim-files/${ownFile.id}`, null, expertLogin.token);
      writeJson('test7-expert-own-file.json', expertOwn);
    }
    if (otherFile) {
      expertOther = await request('GET', `/claim-files/${otherFile.id}`, null, expertLogin.token);
      writeJson('test7-expert-other-file.json', expertOther);
    }
  }
  const test7Pass = expert403?.status === 403 && (expertOther?.status === 403 || expertOther?.status === 404);
  results.push({
    index: 7,
    name: 'Expert 403 davranışı',
    status: test7Pass ? 'PASS' : 'FAIL',
    evidence: [
      path.join(EVIDENCE_DIR, 'test7-expert-login.json'),
      path.join(EVIDENCE_DIR, 'test7-expert-admin-endpoint.json'),
      path.join(EVIDENCE_DIR, 'test7-expert-own-file.json'),
      path.join(EVIDENCE_DIR, 'test7-expert-other-file.json'),
    ],
    notes: {
      expertEmail: expertEmail ?? null,
      adminEndpointStatus: expert403?.status ?? null,
      ownFileStatus: expertOwn?.status ?? null,
      otherFileStatus: expertOther?.status ?? null,
    },
  });

  const assignmentPayload = {
    firstName: 'Rt Assignment',
    lastName: 'Keep',
    email: `rt.assignment.${Date.now()}@meridyenassistance.com`,
    password: 'Test1234!',
    roleId: officeStaffRole?.id ?? adminRole?.id,
    status: 'active',
    departmentMemberships: [{ departmentId: departmentA?.id, isPrimary: true }],
    responsibilityAssignments: [{ departmentId: departmentA?.id, countrywide: true, coverageType: 'claim-owner' }],
  };
  const assignmentCreate = await createUser(assignmentPayload, 'test8-assignment');
  const assignmentId = assignmentCreate.body?.data?.id;
  const assignmentGet1 = assignmentId ? await getUser(assignmentId, 'test8-assignment-initial') : null;
  const assignmentUpdate = assignmentId ? await updateUser(assignmentId, { firstName: 'Rt Assignment Updated' }, 'test8-assignment-name') : null;
  const assignmentGet2 = assignmentId ? await getUser(assignmentId, 'test8-assignment-after-name') : null;
  const assignmentSql = assignmentId
    ? `SELECT user_id, department_id, coverage_type, priority, is_active FROM claim_responsibility_assignments WHERE user_id = '${assignmentId}' ORDER BY created_at ASC;`
    : '';
  const assignmentDb = assignmentId
    ? spawnSync(
        'ssh',
        ['root@94.138.216.18', `docker exec sigorta-backend npx prisma db execute --stdin <<'SQL'\n${assignmentSql}\nSQL`],
        { encoding: 'utf8', timeout: 180000 },
      )
    : null;
  if (assignmentDb) {
    writeText('test8-db-query-stdout.txt', assignmentDb.stdout || '');
    writeText('test8-db-query-stderr.txt', assignmentDb.stderr || '');
  }
  const assignmentUser1 = normalizeUserResponse(assignmentGet1);
  const assignmentUser2 = normalizeUserResponse(assignmentGet2);
  const test8Pass = Boolean(
    assignmentUser1?.responsibilityAssignments?.length === 1 &&
      assignmentUser2?.responsibilityAssignments?.length === 1 &&
      assignmentUser2?.responsibilityAssignments?.[0]?.departmentId === departmentA?.id,
  );
  results.push({
    index: 8,
    name: 'claim_responsibility_assignments veri korunumu',
    status: test8Pass ? 'PASS' : 'FAIL',
    evidence: [
      path.join(EVIDENCE_DIR, 'test8-assignment-create-response.json'),
      path.join(EVIDENCE_DIR, 'test8-assignment-initial-get-response.json'),
      path.join(EVIDENCE_DIR, 'test8-assignment-name-update-response.json'),
      path.join(EVIDENCE_DIR, 'test8-assignment-after-name-get-response.json'),
      path.join(EVIDENCE_DIR, 'test8-db-query-stdout.txt'),
    ],
    notes: { userId: assignmentId ?? null, dbExitCode: assignmentDb?.status ?? null },
  });

  const stalePayload = {
    firstName: 'Rt Stale',
    lastName: 'State',
    email: `rt.stale.${Date.now()}@meridyenassistance.com`,
    password: 'Test1234!',
    roleId: fieldStaffRole?.id ?? adminRole?.id,
    status: 'active',
    departmentMemberships: [{ departmentId: departmentA?.id, isPrimary: true }],
    responsibilityAssignments: [{ departmentId: departmentA?.id, countrywide: false, coverageType: 'field' }],
  };
  const staleCreate = await createUser(stalePayload, 'test9-stale');
  const staleId = staleCreate.body?.data?.id;
  let staleServiceAreas = null;
  let staleScreenPerms = null;
  let staleSwitch = null;
  let staleGet = null;
  if (staleId) {
    staleServiceAreas = await request(
      'PATCH',
      `/users/${staleId}/service-areas`,
      { serviceAreas: [{ provinceId: '34', districtId: null }] },
      adminToken,
    );
    staleScreenPerms = await request(
      'PUT',
      `/users/${staleId}/screen-permissions`,
      { screens: [{ code: 'kullanicilar', canView: true }] },
      adminToken,
    );
    staleSwitch = await updateUser(staleId, { roleId: officeStaffRole?.id }, 'test9-stale-switch');
    staleGet = await getUser(staleId, 'test9-stale-after-switch');
    writeJson('test9-stale-service-areas.json', staleServiceAreas);
    writeJson('test9-stale-screen-permissions.json', staleScreenPerms);
  }
  const staleData = normalizeUserResponse(staleGet);
  const staleScreenCheck = await request('GET', `/users/${staleId}/screen-permissions?roleCode=office_staff`, null, adminToken);
  writeJson('test9-stale-screen-after-switch.json', staleScreenCheck);
  const visibleStaleScreens = staleScreenCheck.body?.data?.screens?.filter((screen) => screen.canView).map((screen) => screen.code) ?? [];
  const staleServiceAreaCount = staleData?.serviceAreas?.length ?? null;
  const test9Pass = visibleStaleScreens.length === 0 && staleServiceAreaCount === 0;
  results.push({
    index: 9,
    name: 'Role switch sonrası stale state temizliği',
    status: test9Pass ? 'PASS' : 'FAIL',
    evidence: [
      path.join(EVIDENCE_DIR, 'test9-stale-create-response.json'),
      path.join(EVIDENCE_DIR, 'test9-stale-service-areas.json'),
      path.join(EVIDENCE_DIR, 'test9-stale-screen-permissions.json'),
      path.join(EVIDENCE_DIR, 'test9-stale-switch-update-response.json'),
      path.join(EVIDENCE_DIR, 'test9-stale-after-switch-get-response.json'),
      path.join(EVIDENCE_DIR, 'test9-stale-screen-after-switch.json'),
    ],
    notes: { userId: staleId ?? null, visibleStaleScreens, staleServiceAreaCount },
  });

  let parityOutcome = null;
  const parityScript = path.join(OUT_DIR, 'ui-create-edit-parity.js');
  const parityRun = spawnSync(process.execPath, [parityScript, SCREENSHOT_DIR], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BASE_URL,
      API_BASE,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
    },
    encoding: 'utf8',
    timeout: 240000,
  });
  writeText('test10-playwright-stdout.txt', parityRun.stdout || '');
  writeText('test10-playwright-stderr.txt', parityRun.stderr || '');
  try {
    parityOutcome = JSON.parse((parityRun.stdout || '').trim().split('\n').filter(Boolean).pop() || 'null');
  } catch {
    parityOutcome = null;
  }
  if (parityOutcome?.createdUserId) createdUserIds.push(parityOutcome.createdUserId);
  results.push({
    index: 10,
    name: 'Create/Edit parity doğrulaması',
    status: parityOutcome?.parity === true ? 'PASS' : 'FAIL',
    evidence: [
      path.join(EVIDENCE_DIR, 'test10-playwright-stdout.txt'),
      ...(parityOutcome?.screenshot ? [parityOutcome.screenshot] : []),
    ],
    notes: parityOutcome ?? null,
  });

  for (const userId of [...new Set(createdUserIds)]) {
    const deleted = await request('DELETE', `/users/${userId}`, null, adminToken);
    writeJson(`cleanup-${userId}.json`, deleted);
  }

  const markdown = results
    .map((item) => {
      const evidenceText = item.evidence.filter(Boolean).join(' | ');
      return [
        `## Test ${item.index}: ${item.name}`,
        `Status: ${item.status}`,
        `Evidence: ${evidenceText || 'N/A'}`,
        `Notes: ${JSON.stringify(item.notes)}`,
        '',
      ].join('\n');
    })
    .join('\n');

  const reportPath = path.join(OUT_DIR, 'runtime-regression-report.md');
  fs.writeFileSync(reportPath, markdown);
  fs.writeFileSync(path.join(OUT_DIR, 'runtime-regression-results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  console.log(JSON.stringify({ reportPath, resultsPath: path.join(OUT_DIR, 'runtime-regression-results.json'), results }, null, 2));
}

main().catch((error) => {
  const errorPath = path.join(EVIDENCE_DIR, 'fatal-error.txt');
  fs.writeFileSync(errorPath, `${error.stack || error.message}\n`);
  console.error(error);
  process.exit(1);
});