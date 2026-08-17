const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://app.meridyen-tr.com';
const ADMIN_EMAIL = 'admin@meridyenassistance.com';
const ADMIN_PASSWORD = 'admin123';
const OUT_DIR = path.resolve(__dirname, '..', 'evidence', 'api');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(fileName, data) {
  fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(data, null, 2));
}

function writeText(fileName, data) {
  fs.writeFileSync(path.join(OUT_DIR, fileName), data);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  };
}

async function main() {
  ensureDir(OUT_DIR);

  const login = await fetchJson(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  writeJson('login-response.json', login);

  const token = login?.body?.data?.tokens?.accessToken;
  if (!token) {
    throw new Error('Login token alınamadı');
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };

  const authMe = await fetchJson(`${BASE_URL}/api/v1/auth/me`, { headers: authHeaders });
  writeJson('auth-me.json', authMe);

  const users = await fetchJson(`${BASE_URL}/api/v1/users?limit=20`, { headers: authHeaders });
  writeJson('users-list.json', users);

  const userList = Array.isArray(users?.body?.data)
    ? users.body.data
    : Array.isArray(users?.body?.data?.data)
      ? users.body.data.data
      : [];
  const firstUser = userList[0];

  if (firstUser?.id) {
    const screenPermissions = await fetchJson(
      `${BASE_URL}/api/v1/users/${firstUser.id}/screen-permissions?roleCode=${encodeURIComponent(firstUser?.role?.code || 'admin')}`,
      { headers: authHeaders },
    );
    writeJson('user-screen-permissions.json', screenPermissions);
  }

  const insuranceCompanies = await fetchJson(`${BASE_URL}/api/v1/insurance-companies?limit=20`, { headers: authHeaders });
  writeJson('insurance-companies.json', insuranceCompanies);

  const claimStatuses = await fetchJson(`${BASE_URL}/api/v1/claim-files/statuses`, { headers: authHeaders });
  writeJson('claim-statuses.json', claimStatuses);

  const ihbarKonulari = await fetchJson(`${BASE_URL}/api/v1/system-settings/ihbar-konulari`, { headers: authHeaders });
  writeJson('ihbar-konulari.json', ihbarKonulari);

  const documentTypes = await fetchJson(`${BASE_URL}/api/v1/document-types`, { headers: authHeaders }).catch((error) => ({
    status: 0,
    body: { error: error.message },
  }));
  writeJson('document-types.json', documentTypes);

  const anonymousPanel = await fetch(`${BASE_URL}/panel/kullanicilar`);
  const anonymousPanelHtml = await anonymousPanel.text();
  writeText('anonymous-panel-kullanicilar.html', anonymousPanelHtml);
  writeJson('anonymous-panel-kullanicilar-meta.json', {
    status: anonymousPanel.status,
    hasLoginPrompt: /giriş|sisteme giriş|login/i.test(anonymousPanelHtml),
    hasPanelShell: /Dashboard|Panel|Kullanıcı Yönetimi/i.test(anonymousPanelHtml),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});