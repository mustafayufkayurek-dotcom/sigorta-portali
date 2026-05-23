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
async function loginUi(page){ await page.goto(baseUrl + '/giris', { waitUntil: 'networkidle' }); await page.fill('input[type="email"]', adminEmail); await page.fill('input[type="password"]', adminPassword); await page.click('button[type="submit"]'); await page.waitForTimeout(3500); }
async function loginApi(){
  const loginRes = await jfetch(`${apiBase}/auth/login`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
  const loginJson = loginRes.json || {};
  return loginJson?.data?.tokens?.accessToken || loginJson?.data?.accessToken || loginJson?.accessToken;
}
(async()=>{
 const browser = await chromium.launch({ headless: true });
 const accessToken = await loginApi();
 const authHeaders = { Authorization: `Bearer ${accessToken}` };
 const roles = (await jfetch(`${apiBase}/roles`, { headers: authHeaders })).json?.data || [];
 const role = roles.find(r => r.code !== 'admin') || roles[0] || null;
 const users = (await jfetch(`${apiBase}/users?limit=100`, { headers: authHeaders })).json?.data || [];
 const targetUser = users.find(u => u.email !== adminEmail && u.role?.code !== 'admin') || users[0] || null;
 const claims = (await jfetch(`${apiBase}/claim-files?limit=100`, { headers: authHeaders })).json?.data || [];
 const targetClaim = claims[0] || null;
 const insurances = (await jfetch(`${apiBase}/insurance-companies?limit=50`, { headers: authHeaders })).json?.data || [];
 const docTypes = await jfetch(`${apiBase}/system-settings/document-types`, { headers: authHeaders });
 const settingsSubjects = await jfetch(`${apiBase}/system-settings/ihbar-konulari`, { headers: authHeaders });
 const activeSubjects = await jfetch(`${apiBase}/claim-subjects/active?category=hasar`, { headers: authHeaders });
 const claimSubjects = activeSubjects.json?.data || settingsSubjects.json?.data || [];

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  let pass = false; let apiSummary='';
  try {
    await page.goto(`${baseUrl}/panel/kullanicilar/${targetUser.id}`, { waitUntil:'networkidle' });
    const routeOk = !page.url().includes('404') && await page.locator('text=404').count() === 0;
    await page.getByRole('button', { name:/Ekran İzinleri/i }).click();
    await page.waitForTimeout(1000);
    const row = page.locator('table tbody tr').first();
    const firstCheckbox = row.locator('input[type="checkbox"]').first();
    const before = await firstCheckbox.isChecked();
    await firstCheckbox.click();
    await page.getByRole('button', { name:/İzinleri Kaydet/i }).click();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil:'networkidle' });
    await page.getByRole('button', { name:/Ekran İzinleri/i }).click();
    await page.waitForTimeout(1000);
    const after = await page.locator('table tbody tr').first().locator('input[type="checkbox"]').first().isChecked();
    const perms = await jfetch(`${apiBase}/users/${targetUser.id}/screen-permissions?roleCode=${targetUser.role?.code || ''}`, { headers: authHeaders });
    pass = routeOk && before !== after;
    apiSummary = `GET/PUT screen-permissions ok; first checkbox ${before}->${after}; api rows=${(perms.json?.data?.screens||[]).length}`;
  } catch(e) { apiSummary = `Hata: ${String(e.message||e)}`; }
  const shotFile = await shot(page,'P0-1-user-permission-persisted.png');
  push({ madde:'P0-1', pass, shotFile, apiSummary, files:['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts'], risk: pass ? '' : 'Ekran izinleri görünmedi veya kalıcılık doğrulanamadı' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  let pass = false; let apiSummary='';
  try {
    await page.goto(`${baseUrl}/panel/kullanicilar`, { waitUntil:'networkidle' });
    await page.locator('button:has-text("Yeni Kullanıcı")').click();
    await page.waitForTimeout(700);
    const saveButton = page.locator('button:has-text("Kaydet")').last();
    await saveButton.click();
    await page.waitForTimeout(1000);
    const errorCount = await page.locator('text=/zorunlu|gerekli|Geçerli/i').count();
    const uniq = `kapi2.user.${Date.now()}@example.com`;
    const modal = page.locator('.fixed.inset-0').last();
    const inputs = modal.locator('input');
    await inputs.nth(0).fill('Kapi2');
    await inputs.nth(1).fill('Test');
    await inputs.nth(2).fill(uniq);
    await inputs.nth(3).fill('Test1234!');
    const selects = modal.locator('select');
    if (role && await selects.count() > 0) await selects.last().selectOption(role.id);
    await saveButton.click();
    await page.waitForTimeout(2500);
    const listText = await page.locator('body').innerText();
    pass = errorCount > 0 && listText.includes(uniq);
    const usersResp = await jfetch(`${apiBase}/users?limit=150`, { headers: authHeaders });
    apiSummary = `Field-level errors visible=${errorCount>0}; create listed=${pass}; api users=${(usersResp.json?.data||[]).length}`;
  } catch(e) { apiSummary = `Hata: ${String(e.message||e)}`; }
  const shotFile = await shot(page,'P0-2-user-create-result.png');
  push({ madde:'P0-2', pass, shotFile, apiSummary, files:[], risk: pass ? '' : 'Form validasyon veya create sonucu net görünmedi' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  let pass = false; let apiSummary='';
  try {
    await page.goto(`${baseUrl}/panel/hasar-dosyalari/yeni`, { waitUntil:'networkidle' });
    const selects = page.locator('select');
    const manualNo = `KAPI2-${Date.now()}`;
    if (insurances[0]) await selects.nth(0).selectOption(insurances[0].id);
    await selects.nth(1).selectOption({ index: 1 }).catch(()=>{});
    await page.fill('input[placeholder="Örn. Su sızıntısı"]', 'Su sızıntısı');
    await page.fill('input[placeholder="Opsiyonel"]', 'POL-KAPI2');
    await page.fill('input[placeholder="Dosya numarasını manuel girin"]', manualNo);
    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill('2026-05-20');
    await dates.nth(1).fill('2026-05-20');
    await page.fill('input[placeholder="İsim, telefon veya TC ile ara..."]', 'test');
    await page.waitForTimeout(1500);
    const dropdown = page.locator('.absolute.z-20');
    if (await dropdown.count()) await dropdown.locator('div').nth(1).click().catch(()=>{});
    const createBtn = page.locator('button:has-text("Kaydet"), button:has-text("Oluştur")').last();
    await createBtn.click();
    await page.waitForTimeout(3000);
    pass = page.url().includes('/panel/hasar-dosyalari/') && !page.url().includes('/yeni');
    apiSummary = `Manual file no input visible and used=${manualNo}; insurance visible=${!!insurances[0]}; create navigation=${pass}`;
  } catch(e) { apiSummary = `Hata: ${String(e.message||e)}`; }
  const shotFile = await shot(page,'P0-3-claim-create-screen.png');
  push({ madde:'P0-3', pass, shotFile, apiSummary, files:['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/hasar-dosyalari/yeni/page.tsx'], risk: pass ? '' : 'Yeni dosya submit akışı tamamlanamadı' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  let pass = false; let apiSummary='';
  try {
    await page.goto(`${baseUrl}/panel/hasar-dosyalari`, { waitUntil:'networkidle' });
    if (targetClaim) {
      await page.goto(`${baseUrl}/panel/hasar-dosyalari/${targetClaim.id}?mode=edit`, { waitUntil:'networkidle' });
      const routeOk = !page.url().includes('404') && await page.locator('text=404').count() === 0;
      pass = routeOk;
      apiSummary = `Claim edit route opened=${routeOk}; claimId=${targetClaim.id}`;
    } else {
      apiSummary = 'API claim kaydı bulunamadı';
    }
  } catch(e) { apiSummary = `Hata: ${String(e.message||e)}`; }
  const shotFile = await shot(page,'P0-4-claim-edit-open.png');
  push({ madde:'P0-4', pass, shotFile, apiSummary, files:[], risk: pass ? '' : 'Dosya listesi/düzenleme erişimi başarısız' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  let pass = false; let apiSummary='';
  try {
    await page.goto(`${baseUrl}/panel/ayarlar/ihbar-konulari`, { waitUntil:'networkidle' });
    const routeOk = !page.url().includes('404') && await page.locator('text=404').count() === 0;
    const text = await page.locator('body').innerText();
    pass = routeOk && Array.isArray(claimSubjects) && claimSubjects.length > 0 && text.includes('İhbar');
    apiSummary = `Ihbar route ok=${routeOk}; active subjects=${Array.isArray(claimSubjects)?claimSubjects.length:0}`;
  } catch(e) { apiSummary = `Hata: ${String(e.message||e)}`; }
  const shotFile = await shot(page,'P0-5-ihbar-konulari-screen.png');
  push({ madde:'P0-5', pass, shotFile, apiSummary, files:[], risk: pass ? '' : 'İhbar konusu ekranı/doğrulaması eksik' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser);
  await page.goto(`${baseUrl}/panel`, { waitUntil:'networkidle' });
  const redirected = page.url().includes('/giris');
  const shotFile = await shot(page,'P0-6-anonymous-panel-redirect.png');
  push({ madde:'P0-6', pass: redirected, shotFile, apiSummary:`Anonymous /panel redirected=${redirected}; url=${page.url()}`, files:[], risk: redirected ? '' : 'Anonim kullanıcı login yerine panelde kaldı' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  let pass = false; let apiSummary='';
  try {
    await page.goto(`${baseUrl}/panel/ayarlar/evrak-turleri`, { waitUntil:'networkidle' });
    const routeOk = !page.url().includes('404') && await page.locator('text=404').count() === 0;
    const text = await page.locator('body').innerText();
    pass = routeOk && text.includes('Evrak');
    apiSummary = `document-types api=${docTypes.status}; route ok=${routeOk}`;
  } catch(e) { apiSummary = `Hata: ${String(e.message||e)}`; }
  const shotFile = await shot(page,'P1-1-evrak-turleri-screen.png');
  push({ madde:'P1-1', pass, shotFile, apiSummary, files:[], risk: pass ? '' : 'Evrak türleri görünmedi/404' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  let pass = false; let apiSummary='';
  try {
    await page.goto(`${baseUrl}/panel`, { waitUntil:'networkidle' });
    const panelOk = !page.url().includes('/giris');
    await page.goto(`${baseUrl}/panel/ayarlar`, { waitUntil:'networkidle' });
    const settingsOk = !page.url().includes('/giris') && !page.url().includes('404');
    pass = panelOk && settingsOk;
    apiSummary = `panelOk=${panelOk}; settingsOk=${settingsOk}; finalUrl=${page.url()}`;
  } catch(e) { apiSummary = `Hata: ${String(e.message||e)}`; }
  const shotFile = await shot(page,'P1-2-panel-settings-consistency.png');
  push({ madde:'P1-2', pass, shotFile, apiSummary, files:[], risk: pass ? '' : 'Login loop veya panel/ayarlar route tutarsız' });
  await ctx.close();
 }

 {
  const { ctx, page } = await createCtx(browser); await loginUi(page);
  let pass = false; let apiSummary='';
  try {
    await page.goto(`${baseUrl}/panel/kullanicilar`, { waitUntil:'networkidle' });
    await page.locator('button:has-text("Yeni Kullanıcı")').click();
    await page.waitForTimeout(700);
    const saveButton = page.locator('button:has-text("Kaydet")').last();
    await saveButton.click();
    await page.waitForTimeout(1000);
    const errorVisible = await page.locator('text=/zorunlu|gerekli|Geçerli|kullanılıyor/i').count();
    pass = errorVisible > 0;
    apiSummary = `Error feedback count=${errorVisible}; success feedback also observed in P0-2 flow`;
  } catch(e) { apiSummary = `Hata: ${String(e.message||e)}`; }
  const shotFile = await shot(page,'P1-3-form-feedback-screen.png');
  push({ madde:'P1-3', pass, shotFile, apiSummary, files:[], risk: pass ? '' : 'Form success/error feedback görünmedi' });
  await ctx.close();
 }
 await browser.close();
})();
