const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'https://app.meridyen-tr.com';
const ADMIN_EMAIL = 'admin@meridyenassistance.com';
const ADMIN_PASSWORD = 'admin123';
const OUT_DIR = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(OUT_DIR, 'evidence');
const RESULTS_PATH = path.join(OUT_DIR, 'results.json');

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function saveJson(name, data) {
  const filePath = path.join(EVIDENCE_DIR, name);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

async function saveText(name, data) {
  const filePath = path.join(EVIDENCE_DIR, name);
  fs.writeFileSync(filePath, data || '');
  return filePath;
}

async function screenshot(page, name) {
  const filePath = path.join(EVIDENCE_DIR, name);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function login(page, result) {
  await page.goto(`${BASE_URL}/giris`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  result.evidence.push(await screenshot(page, 'login-after-submit.png'));
  result.evidence.push(await saveText('login-url.txt', page.url()));
  return page.url();
}

async function collectApi(page, name, urlPart) {
  const response = await page.waitForResponse(
    (resp) => resp.url().includes(urlPart),
    { timeout: 20000 }
  ).catch(() => null);
  if (!response) return null;
  let body = null;
  try {
    body = await response.text();
  } catch {
    body = null;
  }
  return saveText(name, `URL: ${response.url()}\nSTATUS: ${response.status()}\nBODY:\n${body || ''}`);
}

async function runCase(browser, testCase) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  const result = {
    area: testCase.area,
    screen: testCase.screen,
    flow: testCase.flow,
    expected: testCase.expected,
    actual: '',
    status: 'FAIL',
    priority: testCase.priority,
    evidence: [],
    notes: '',
  };

  try {
    await login(page, result);
    await testCase.run(page, result, browser);
  } catch (error) {
    result.actual = result.actual || `Hata: ${error.message}`;
    result.notes = error.stack || '';
    result.evidence.push(await saveText(`${slugify(testCase.area)}-${slugify(testCase.flow)}-error.txt`, `${error.stack || error.message}`));
    result.evidence.push(await screenshot(page, `${slugify(testCase.area)}-${slugify(testCase.flow)}-error.png`).catch(() => null));
  } finally {
    await context.close();
  }

  result.evidence = result.evidence.filter(Boolean);
  return result;
}

const testCases = [
  {
    area: 'Kullanıcı Yönetimi',
    screen: 'Rol yönetimi',
    flow: 'Rol listesi görüntüleme/oluşturma',
    expected: 'Admin rol listesine erişir ve yeni rol aksiyonunu görebilir/başlatabilir.',
    priority: 'P0',
    run: async (page, result) => {
      const apiPromise = collectApi(page, 'roles-api.txt', '/roles');
      await page.goto(`${BASE_URL}/panel/ayarlar/roller`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'roles-page.png'));
      const apiEvidence = await apiPromise;
      if (apiEvidence) result.evidence.push(apiEvidence);
      const hasList = /Rol|roller|yetki/i.test(body || '');
      const hasCreate = /Yeni Rol|Rol Oluştur|Ekle/i.test(body || '');
      result.actual = hasList ? 'Rol ekranı içerik gösteriyor.' : `Ekran beklenen rol içeriğini göstermiyor. URL=${page.url()}`;
      result.status = hasList && hasCreate ? 'PASS' : 'FAIL';
      if (!hasCreate) result.actual += ' Yeni rol aksiyonu görünmedi.';
    },
  },
  {
    area: 'Kullanıcı Yönetimi',
    screen: 'Departman yönetimi',
    flow: 'Departman listesi görüntüleme/oluşturma',
    expected: 'Admin departman listesine erişir ve yeni departman aksiyonunu görür.',
    priority: 'P0',
    run: async (page, result) => {
      const apiPromise = collectApi(page, 'departments-api.txt', '/departments');
      await page.goto(`${BASE_URL}/panel/ayarlar/departmanlar`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'departments-page.png'));
      const apiEvidence = await apiPromise;
      if (apiEvidence) result.evidence.push(apiEvidence);
      const hasList = /Departman/i.test(body || '');
      const hasCreate = /Yeni Departman|Ekle/i.test(body || '');
      result.actual = hasList ? 'Departman ekranı içerik gösteriyor.' : `Ekran beklenen departman içeriğini göstermiyor. URL=${page.url()}`;
      result.status = hasList && hasCreate ? 'PASS' : 'FAIL';
    },
  },
  {
    area: 'Kullanıcı Yönetimi',
    screen: 'Kullanıcı düzenleme',
    flow: 'Screen-permission ve insurance-company scope görüntüleme',
    expected: 'Kullanıcı düzenleme formunda yetki ve sigorta kapsamı alanları görünür.',
    priority: 'P0',
    run: async (page, result) => {
      await page.goto(`${BASE_URL}/panel/ayarlar/kullanicilar`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      const editButton = page.getByRole('button', { name: /düzenle/i }).first();
      if (await editButton.count()) {
        await editButton.click();
        await page.waitForTimeout(2000);
      }
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'user-edit-page.png'));
      const hasPermissions = /Yetki|Permission|Ekran/i.test(body || '');
      const hasScope = /Sigorta|Kapsam|Insurance/i.test(body || '');
      result.actual = `Yetki alanı: ${hasPermissions ? 'var' : 'yok'}, sigorta scope alanı: ${hasScope ? 'var' : 'yok'}, URL=${page.url()}`;
      result.status = hasPermissions && hasScope ? 'PASS' : 'FAIL';
    },
  },
  {
    area: 'Kullanıcı Yönetimi',
    screen: 'Kullanıcı oluşturma',
    flow: 'Kullanıcı oluşturma tam akışı ve validasyon',
    expected: 'Yeni kullanıcı formu açılır, zorunlu alan validasyonu görünür.',
    priority: 'P0',
    run: async (page, result) => {
      await page.goto(`${BASE_URL}/panel/ayarlar/kullanicilar`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      const createButton = page.getByRole('button', { name: /yeni kullanıcı|kullanıcı ekle|oluştur/i }).first();
      if (await createButton.count()) {
        await createButton.click();
        await page.waitForTimeout(1500);
      }
      const submitButton = page.getByRole('button', { name: /kaydet|oluştur/i }).last();
      if (await submitButton.count()) {
        await submitButton.click();
        await page.waitForTimeout(1500);
      }
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'user-create-validation.png'));
      const hasForm = /Ad|Soyad|E-posta|Şifre/i.test(body || '');
      const hasValidation = /zorunlu|gerekli|geçerli/i.test(body || '');
      result.actual = `Form görünürlüğü: ${hasForm ? 'var' : 'yok'}, validasyon: ${hasValidation ? 'var' : 'yok'}`;
      result.status = hasForm && hasValidation ? 'PASS' : 'FAIL';
    },
  },
  {
    area: 'Dosya/İhbar Akışı',
    screen: 'Dosya oluşturma',
    flow: 'Manuel dosya numarası ve sigorta seçimi ile oluşturma ekranı',
    expected: 'Dosya oluşturma formu açılır, manuel dosya no ve sigorta alanları bulunur.',
    priority: 'P0',
    run: async (page, result) => {
      await page.goto(`${BASE_URL}/panel/dosyalar/yeni`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'claim-create-page.png'));
      const hasFileNo = /Dosya No|File No/i.test(body || '');
      const hasInsurance = /Sigorta Şirketi|Insurance/i.test(body || '');
      result.actual = `Dosya no alanı: ${hasFileNo ? 'var' : 'yok'}, sigorta seçimi: ${hasInsurance ? 'var' : 'yok'}, URL=${page.url()}`;
      result.status = hasFileNo && hasInsurance ? 'PASS' : 'FAIL';
    },
  },
  {
    area: 'Dosya/İhbar Akışı',
    screen: 'Dosya listesi/düzenleme',
    flow: 'Dosya düzenleme erişimi',
    expected: 'Mevcut dosyadan düzenleme ekranına geçilir.',
    priority: 'P0',
    run: async (page, result) => {
      await page.goto(`${BASE_URL}/panel/dosyalar`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(4000);
      const bodyList = await page.textContent('body');
      const listVisible = /Dosya|İhbar|Hasar/i.test(bodyList || '');
      const editButton = page.getByRole('button', { name: /düzenle/i }).first();
      if (await editButton.count()) {
        await editButton.click().catch(() => {});
        await page.waitForTimeout(2500);
      }
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'claim-edit-page.png'));
      const editVisible = /Kaydet|Güncelle|Dosya No|Sigorta Şirketi/i.test(body || '');
      result.actual = `Liste görünürlüğü: ${listVisible ? 'var' : 'yok'}, düzenleme formu: ${editVisible ? 'var' : 'yok'}, URL=${page.url()}`;
      result.status = listVisible && editVisible ? 'PASS' : 'FAIL';
    },
  },
  {
    area: 'Dosya/İhbar Akışı',
    screen: 'İhbar oluşturma/düzenleme',
    flow: 'İhbar akışı erişimi ve form alanları',
    expected: 'İhbar ekranında oluşturma/düzenleme yapılabilir.',
    priority: 'P0',
    run: async (page, result) => {
      await page.goto(`${BASE_URL}/panel/ihbarlar`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(async () => {
        await page.goto(`${BASE_URL}/panel/notifications`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      });
      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'notification-page.png'));
      const hasNotificationFlow = /İhbar|Notification|Konu|Tarih/i.test(body || '');
      result.actual = hasNotificationFlow ? `İhbar ekranı açıldı. URL=${page.url()}` : `İhbar akışı tespit edilemedi. URL=${page.url()}`;
      result.status = hasNotificationFlow ? 'PASS' : 'FAIL';
    },
  },
  {
    area: 'Referans Veriler',
    screen: 'Evrak türleri ve ihbar konuları',
    flow: 'Referans liste verileri görüntüleme',
    expected: 'Evrak türleri ve ihbar konuları listeleri boş/kayıp olmadan görünür.',
    priority: 'P1',
    run: async (page, result) => {
      await page.goto(`${BASE_URL}/panel/ayarlar`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'settings-reference-page.png'));
      const hasDocTypes = /Evrak Tür/i.test(body || '');
      const hasSubjects = /İhbar Konu|Konu/i.test(body || '');
      result.actual = `Evrak türleri: ${hasDocTypes ? 'görüldü' : 'görülmedi'}, ihbar konuları: ${hasSubjects ? 'görüldü' : 'görülmedi'}`;
      result.status = hasDocTypes && hasSubjects ? 'PASS' : 'FAIL';
    },
  },
  {
    area: 'Yetki ve Erişim',
    screen: 'Admin erişimi',
    flow: 'Admin ekranlarına tam erişim',
    expected: 'Admin ana ayar ekranlarına yetki engeli olmadan erişir.',
    priority: 'P1',
    run: async (page, result) => {
      const urls = [
        `${BASE_URL}/panel`,
        `${BASE_URL}/panel/ayarlar`,
        `${BASE_URL}/panel/ayarlar/kullanicilar`,
        `${BASE_URL}/panel/dosyalar`,
      ];
      const visited = [];
      for (const url of urls) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(1500);
        visited.push({ url, final: page.url(), title: await page.title() });
      }
      result.evidence.push(await saveJson('admin-access-visited.json', visited));
      result.evidence.push(await screenshot(page, 'admin-access-last-page.png'));
      const blocked = visited.some((item) => /giris|login|403|yetki/i.test(`${item.final} ${item.title}`));
      result.actual = blocked ? `Bazı admin sayfaları engellendi: ${JSON.stringify(visited)}` : `Admin erişimi başarılı: ${JSON.stringify(visited)}`;
      result.status = blocked ? 'FAIL' : 'PASS';
    },
  },
  {
    area: 'Yetki ve Erişim',
    screen: 'Yetki dışı erişim denemesi',
    flow: 'Anonim kullanıcı admin sayfasına yönlendirilir',
    expected: 'Girişsiz erişimde login/yetki ekranına yönlendirme olur.',
    priority: 'P1',
    run: async (_page, result, browser) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/panel/ayarlar/kullanicilar`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);
        result.evidence.push(await screenshot(page, 'unauthorized-access.png'));
        const finalUrl = page.url();
        const body = await page.textContent('body');
        const redirected = /giris|login/i.test(finalUrl) || /giriş yap/i.test(body || '');
        result.actual = `Final URL=${finalUrl}`;
        result.status = redirected ? 'PASS' : 'FAIL';
      } finally {
        await context.close();
      }
    },
  },
  {
    area: 'Form Kullanımı',
    screen: 'Genel form validasyonu',
    flow: 'Zorunlu alan ve submit feedback',
    expected: 'Boş submitte validasyon/feedback mesajı görünür.',
    priority: 'P1',
    run: async (page, result) => {
      await page.goto(`${BASE_URL}/panel/dosyalar/yeni`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      const submitButton = page.getByRole('button', { name: /kaydet|oluştur/i }).last();
      if (await submitButton.count()) {
        await submitButton.click();
        await page.waitForTimeout(1500);
      }
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'form-validation-claim.png'));
      const hasValidation = /zorunlu|gerekli|seçiniz|giriniz/i.test(body || '');
      const hasFeedback = /başar|hata|uyarı|invalid/i.test(body || '');
      result.actual = `Validasyon=${hasValidation}, feedback=${hasFeedback}`;
      result.status = hasValidation ? 'PASS' : 'FAIL';
    },
  },
  {
    area: 'Bildirim/Operasyon',
    screen: 'In-app bildirimler',
    flow: 'Bildirim ekranı/öğesi görünürlüğü',
    expected: 'Uygulama içi bildirim alanı erişilebilir.',
    priority: 'P2',
    run: async (page, result) => {
      await page.goto(`${BASE_URL}/panel`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'dashboard-notifications.png'));
      const hasNotifications = /Bildirim|Notification/i.test(body || '');
      result.actual = hasNotifications ? 'Bildirim öğesi görüldü.' : 'Bildirim öğesi görünmedi.';
      result.status = hasNotifications ? 'PASS' : 'FAIL';
    },
  },
  {
    area: 'Genel UX',
    screen: 'Boş durumlar / kaydetmeme / yanlış yönlendirme',
    flow: 'Ana panoda çıkmaza sokan akış kontrolü',
    expected: 'Ana ekran temel gezinmede boş hata/çıkmaz yaratmaz.',
    priority: 'P2',
    run: async (page, result) => {
      await page.goto(`${BASE_URL}/panel`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      result.evidence.push(await screenshot(page, 'dashboard-ux.png'));
      const hasError = /unexpected|undefined|hata oluştu|error/i.test(body || '');
      result.actual = hasError ? 'Dashboard üzerinde hata metni bulundu.' : 'Dashboard temel görünümde kritik hata metni bulunmadı.';
      result.status = hasError ? 'FAIL' : 'PASS';
    },
  },
];

(async () => {
  ensureDir(EVIDENCE_DIR);
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const testCase of testCases) {
      const result = await runCase(browser, testCase);
      results.push(result);
      console.log(`${result.status} | ${result.area} | ${result.flow} | ${result.actual}`);
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  console.log(`RESULTS_PATH=${RESULTS_PATH}`);
})();
