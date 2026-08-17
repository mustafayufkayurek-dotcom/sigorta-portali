const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const evidenceDir = '/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/kapi2-kanit-revizyon-20260520/evidence';
const outJson = '/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/kapi2-kanit-revizyon-20260520/tmp/results.json';
const baseUrl = 'https://app.meridyen-tr.com';
const apiBase = 'https://app.meridyen-tr.com/api/v1';
const adminEmail = 'admin@meridyenassistance.com';
const adminPassword = 'admin123';
fs.mkdirSync(evidenceDir, { recursive: true });
const results = [];
function push(item){ results.push(item); fs.writeFileSync(outJson, JSON.stringify(results, null, 2)); }
async function shot(page, name){ const p = path.join(evidenceDir, name); await page.screenshot({ path: p, fullPage: true }); return p; }
async function jfetch(url, options={}){ const res = await fetch(url, options); const text = await res.text(); try { return { status: res.status, json: JSON.parse(text), text }; } catch { return { status: res.status, json: null, text }; } }
async function createCtx(browser){ const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1200 } }); const page = await ctx.newPage(); return { ctx, page }; }
async function loginUi(page){ await page.goto(baseUrl + '/giris', { waitUntil: 'networkidle' }); await page.fill('input[type="email"]', adminEmail); await page.fill('input[type="password"]', adminPassword); await page.click('button[type="submit"]'); await page.waitForTimeout(2500); }
(async()=>{
 const browser = await chromium.launch({ headless: true });
 const loginRes = await jfetch(`${apiBase}/auth/login`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
 const loginJson = loginRes.json || {};
 const accessToken = loginJson?.data?.tokens?.accessToken || loginJson?.data?.accessToken || loginJson?.accessToken;
 const authHeaders = { Authorization: `Bearer ${accessToken}` };
 const roles = (await jfetch(`${apiBase}/roles`, { headers: authHeaders })).json?.data || [];
 const role = roles.find(r => r.code !== 'admin') || roles[0] || null;
 const users = (await jfetch(`${apiBase}/users?limit=50`, { headers: authHeaders })).json?.data || [];
 const targetUser = users.find(u => u.email !== adminEmail) || users[0] || null;
 const claims = (await jfetch(`${apiBase}/claim-files?limit=20`, { headers: authHeaders })).json?.data || [];
 const targetClaim = claims[0] || null;
 const insurances = (await jfetch(`${apiBase}/insurance-companies?limit=50`, { headers: authHeaders })).json?.data || [];
 const docTypes = await jfetch(`${apiBase}/system-settings/document-types`, { headers: authHeaders });
 const settingsSubjects = await jfetch(`${apiBase}/system-settings/ihbar-konulari`, { headers: authHeaders });
 const activeSubjects = await jfetch(`${apiBase}/claim-subjects/active?category=hasar`, { headers: authHeaders });
 const claimSubjects = activeSubjects.json?.data || settingsSubjects.json?.data || [];

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  let pass = false; let apiSummary='';
  if (!targetUser) {
    const shotFile = await shot(page,'P0-1-no-user.png');
    push({ madde:'P0-1', pass:false, shotFile, apiSummary:'Kullanıcı bulunamadı', files:[], risk:'Test kullanıcısı yok' });
  } else {
    await page.goto(`${baseUrl}/panel/kullanicilar/${targetUser.id}`, { waitUntil: 'networkidle' });
    const routeOk = !page.url().includes('404') && await page.locator('text=404').count() === 0;
    try {
      await page.getByRole('button', { name: /Ekran İzinleri/i }).click();
      await page.waitForTimeout(1200);
      const firstCheckbox = page.locator('table tbody input[type="checkbox"]').first();
      const before = await firstCheckbox.isChecked();
      await firstCheckbox.click();
      await page.getByRole('button', { name: /İzinleri Kaydet/i }).click();
      await page.waitForTimeout(1600);
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Ekran İzinleri/i }).click();
      await page.waitForTimeout(1000);
      const after = await page.locator('table tbody input[type="checkbox"]').first().isChecked();
      const perms = await jfetch(`${apiBase}/users/${targetUser.id}/screen-permissions?roleCode=${targetUser.role?.code || ''}`, { headers: authHeaders });
      pass = routeOk && before !== after;
      apiSummary = `Route ok=${routeOk}; first permission ${before}->${after}; API screen rows=${(perms.json?.data?.screens||[]).length}`;
    } catch(e) { apiSummary = `UI/API hata: ${String(e.message||e)}`; }
    const shotFile = await shot(page, 'P0-1-user-permission-persisted.png');
    push({ madde:'P0-1', pass, shotFile, apiSummary, files:['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts'], risk: pass ? '' : 'Ekran izinleri akışı başarısız veya görünmüyor' });
  }
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  await page.goto(`${baseUrl}/panel/kullanicilar`, { waitUntil: 'networkidle' });
  let pass = false; let apiSummary='';
  await page.getByRole('button', { name: /Yeni Kullanıcı/i }).click();
  await page.waitForTimeout(700);
  const btns = page.locator('button');
  const saveButton = btns.filter({ hasText: /^Kaydet$/ }).last();
  await saveButton.click().catch(()=>{});
  await page.waitForTimeout(1000);
  const hasError = await page.locator('text=/zorunlu|gerekli|Geçerli/i').count();
  const uniq = `kapi2.user.${Date.now()}@example.com`;
  if (role) {
    const inputs = page.locator('div[role="dialog"] input, .fixed.inset-0 input');
    const count = await inputs.count();
    if (count >= 4) {
      await inputs.nth(0).fill('Kapi2');
      await inputs.nth(1).fill('Test');
      await inputs.nth(2).fill(uniq);
      await inputs.nth(3).fill('Test1234!');
    }
    const modalSelects = page.locator('div[role="dialog"] select, .fixed.inset-0 select');
    if (await modalSelects.count() > 0) await modalSelects.last().selectOption(role.id).catch(()=>{});
    await saveButton.click().catch(()=>{});
    await page.waitForTimeout(2500);
    pass = hasError > 0 && await page.locator(`text=${uniq}`).count() > 0;
    const userList = await jfetch(`${apiBase}/users?limit=100`, { headers: authHeaders });
    apiSummary = `Validation visible=${hasError>0}; created listed=${pass}; API users=${(userList.json?.data||[]).length}`;
  } else apiSummary = 'Role bulunamadı';
  const shotFile = await shot(page, 'P0-2-user-create-result.png');
  push({ madde:'P0-2', pass, shotFile, apiSummary, files:[], risk: pass ? '' : 'Form validation veya create akışı eksik' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  await page.goto(`${baseUrl}/panel/hasar-dosyalari/yeni`, { waitUntil: 'networkidle' });
  let pass = false; let apiSummary='';
  const manualNo = `KAPI2-${Date.now()}`;
  try {
    const selects = page.locator('select');
    if (insurances[0]) await selects.nth(0).selectOption(insurances[0].id).catch(()=>{});
    if (await selects.count() >= 2) await selects.nth(1).selectOption({ index: 1 }).catch(()=>{});
    await page.fill('input[placeholder="Örn. Su sızıntısı"]', 'Su sızıntısı');
    await page.fill('input[placeholder="Opsiyonel"]', 'POL-KAPI2');
    await page.fill('input[placeholder="Dosya numarasını manuel girin"]', manualNo);
    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill('2026-05-20');
    await dates.nth(1).fill('2026-05-20');
    await page.fill('input[placeholder="İsim, telefon veya TC ile ara..."]', 'pilot');
    await page.waitForTimeout(1500);
    const dropdown = page.locator('.absolute.z-20');
    if (await dropdown.count()) await dropdown.locator('div').nth(1).click().catch(()=>{});
    const save = page.locator('button').filter({ hasText: /Kaydet|Oluştur/ }).last();
    await save.click().catch(()=>{});
    await page.waitForTimeout(2500);
    pass = page.url().includes('/panel/hasar-dosyalari/') && !page.url().includes('/yeni');
    apiSummary = `Manual no=${manualNo}; insurance selected=${!!insurances[0]}; detail opened=${pass}`;
  } catch(e){ apiSummary = `Hata: ${String(e.message||e)}`; }
  const shotFile = await shot(page, 'P0-3-claim-create-screen.png');
  push({ madde:'P0-3', pass, shotFile, apiSummary, files:['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/hasar-dosyalari/yeni/page.tsx'], risk: pass ? '' : 'Yeni dosya formu eksik alan veya submit hatası' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  if (!targetClaim) {
    const shotFile = await shot(page,'P0-4-no-claim.png');
    push({ madde:'P0-4', pass:false, shotFile, apiSummary:'Claim bulunamadı', files:[], risk:'Test claim yok' });
  } else {
    await page.goto(`${baseUrl}/panel/hasar-dosyalari/${targetClaim.id}?mode=edit`, { waitUntil:'networkidle' });
    const pass = !page.url().includes('404') && await page.locator('text=404').count() === 0;
    const shotFile = await shot(page, 'P0-4-claim-edit-open.png');
    push({ madde:'P0-4', pass, shotFile, apiSummary:`Claim detail/edit route opened=${pass}; claimId=${targetClaim.id}`, files:[], risk: pass ? '' : 'Liste->düzenleme akışı bozuk/404' });
  }
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  await page.goto(`${baseUrl}/panel/ayarlar/ihbar-konulari`, { waitUntil:'networkidle' });
  const routeOk = !page.url().includes('404') && await page.locator('text=404').count() === 0;
  const pass = routeOk && Array.isArray(claimSubjects) && claimSubjects.length > 0;
  const shotFile = await shot(page, 'P0-5-ihbar-konulari-screen.png');
  push({ madde:'P0-5', pass, shotFile, apiSummary:`Route ok=${routeOk}; active subjects=${Array.isArray(claimSubjects)?claimSubjects.length:0}`, files:[], risk: pass ? '' : 'İhbar ekranı veya veri görünümü eksik' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser);
  await page.goto(`${baseUrl}/panel`, { waitUntil:'networkidle' });
  const redirected = page.url().includes('/giris');
  const shotFile = await shot(page, 'P0-6-anonymous-panel-redirect.png');
  push({ madde:'P0-6', pass: redirected, shotFile, apiSummary:`Anonymous redirected=${redirected}; url=${page.url()}`, files:[], risk: redirected ? '' : 'Anonim kullanıcı panelde kalıyor' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  await page.goto(`${baseUrl}/panel/ayarlar/evrak-turleri`, { waitUntil:'networkidle' });
  const visible = !page.url().includes('404') && await page.locator('text=404').count() === 0;
  const shotFile = await shot(page, 'P1-1-evrak-turleri-screen.png');
  push({ madde:'P1-1', pass: visible, shotFile, apiSummary:`document-types API=${docTypes.status}; route visible=${visible}`, files:[], risk: visible ? '' : 'Evrak türleri ekranı 404 veya boş' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  await page.goto(`${baseUrl}/panel`, { waitUntil:'networkidle' });
  const panelOk = !page.url().includes('/giris');
  await page.goto(`${baseUrl}/panel/ayarlar`, { waitUntil:'networkidle' });
  const settingsOk = !page.url().includes('/giris') && !page.url().includes('404');
  const shotFile = await shot(page, 'P1-2-panel-settings-consistency.png');
  push({ madde:'P1-2', pass: panelOk && settingsOk, shotFile, apiSummary:`panelOk=${panelOk}; settingsOk=${settingsOk}; finalUrl=${page.url()}`, files:[], risk: panelOk && settingsOk ? '' : 'Login loop veya route sorunu' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  await page.goto(`${baseUrl}/panel/kullanicilar`, { waitUntil:'networkidle' });
  await page.getByRole('button', { name: /Yeni Kullanıcı/i }).click();
  await page.waitForTimeout(500);
  const saveButton = page.locator('button').filter({ hasText: /^Kaydet$/ }).last();
  await saveButton.click().catch(()=>{});
  await page.waitForTimeout(700);
  const errorVisible = await page.locator('text=/zorunlu|gerekli|Geçerli|kullanılıyor/i').count();
  const shotFile = await shot(page, 'P1-3-form-feedback-screen.png');
  push({ madde:'P1-3', pass: errorVisible > 0, shotFile, apiSummary:`Error feedback count=${errorVisible}; success feedback covered in P0-2`, files:[], risk: errorVisible > 0 ? '' : 'Form feedback görünmüyor' });
  await ctx.close();
 }
 await browser.close();
})();
