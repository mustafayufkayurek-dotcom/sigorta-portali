#!/usr/bin/env node
/**
 * Route Gate kalıcı smoke — Node (tsx gerekmez).
 * Kurallar: apps/web/src/utils/panel-route-access.rules.json (panel-access ile aynı kaynak)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(__dirname, '../../apps/web/src/utils/panel-route-access.rules.json');
const RULES = JSON.parse(readFileSync(RULES_PATH, 'utf8'));

const FINANCE = new Set(['finance', 'finans', 'accountant']);

function normalize(code) {
  return String(code ?? '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}

function roleAllowed(roleCode, allowedRoles) {
  const n = normalize(roleCode);
  return allowedRoles.some((allowed) => {
    const entry = normalize(allowed);
    if (entry === n) return true;
    if (FINANCE.has(entry) && FINANCE.has(n)) return true;
    return false;
  });
}

function isPortalRole(roleCode) {
  const r = normalize(roleCode);
  return r === 'expert' || r === 'insurance_company_user' || r === 'assistance_company_user';
}

function portalAllows(roleCode, pathname) {
  if (pathname === '/panel/profil' || pathname.startsWith('/panel/profil/')) return true;
  if (pathname === '/panel') return true;
  const r = normalize(roleCode);
  if (r === 'expert') {
    return pathname === '/panel/eksper-portal' || pathname.startsWith('/panel/eksper-portal/');
  }
  if (r === 'insurance_company_user') {
    return pathname === '/panel/sigorta-portal' || pathname.startsWith('/panel/sigorta-portal/');
  }
  if (r === 'assistance_company_user') {
    return pathname === '/panel/asistans-portal' || pathname.startsWith('/panel/asistans-portal/');
  }
  return false;
}

function ruleMatches(pathname, rulePath) {
  if (pathname === rulePath) return true;
  if (rulePath === '/panel') return false;
  return pathname.startsWith(`${rulePath}/`);
}

/** Smoke matrisi — acil yardım için basitleştirilmiş: admin/manager/acil staff açar */
function hasAccess(pathname, roleCode, operationArea = 'both') {
  if (!pathname || !roleCode) return false;
  if (pathname === '/panel/profil' || pathname.startsWith('/panel/profil/')) return true;
  if (isPortalRole(roleCode)) return portalAllows(roleCode, pathname);

  if (pathname === '/panel/acil-yardim' || pathname.startsWith('/panel/acil-yardim/')) {
    const r = normalize(roleCode);
    if (r === 'admin' || r === 'manager') return true;
    if (r === 'office_staff' || r === 'field_staff') {
      return operationArea === 'acil' || operationArea === 'both';
    }
    return false;
  }

  const matching = RULES.filter((rule) => ruleMatches(pathname, rule.path))
    .sort((a, b) => b.path.length - a.path.length);
  if (matching.length === 0) return false;
  const rule = matching[0];
  if (rule.roles.length === 0) return true;
  return roleAllowed(roleCode, rule.roles);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const CASES = [
  ['RG-01', 'Yetkili → yetkili', 'admin', '/panel/ayarlar', true],
  ['RG-02', 'Yetkili → yetkili', 'field_staff', '/panel/hasar-dosyalari', true],
  ['RG-03', 'Yetkili → yetkili', 'finance', '/panel/finans', true],
  ['RG-04', 'Yetkili → yetkili', 'MANAGER', '/panel/pazartesi-toplantisi', true],
  ['RG-05', 'Yetkisiz → korunan', 'field_staff', '/panel/finans', false],
  ['RG-05b', 'Yetkisiz → korunan', 'field_staff', '/panel/carilerim', false],
  ['RG-05c', 'Yetkisiz → korunan', 'field_staff', '/panel/personel-ozluk', false],
  ['RG-06', 'Yetkisiz → korunan', 'office_staff', '/panel/kullanicilar', false],
  ['RG-07', 'Yetkisiz → korunan', 'office_staff', '/panel/pazartesi-toplantisi', false],
  ['RG-08', 'Yetkisiz → korunan', 'admin', '/panel/bildirimler', false],
  ['RG-09', 'Portal → Personel', 'expert', '/panel/finans', false],
  ['RG-10', 'Portal → Personel', 'expert', '/panel/musteriler', false],
  ['RG-11', 'Portal → Personel', 'insurance_company_user', '/panel/ayarlar', false],
  ['RG-12', 'Portal → Personel', 'insurance_company_user', '/panel/operasyon', false],
  ['RG-13', 'Personel → Portal', 'admin', '/panel/eksper-portal', true],
  ['RG-14', 'Personel → Portal', 'office_staff', '/panel/sigorta-portal', true],
  ['RG-15', 'Personel → Portal', 'field_staff', '/panel/eksper-portal', false],
  ['RG-16', 'Personel → Portal', 'finance', '/panel/sigorta-portal', false],
  ['RG-17', 'Doğrudan URL / Deep Link', 'expert', '/panel/eksper-portal/dosyalar', true],
  ['RG-18', 'Doğrudan URL / Deep Link', 'insurance_company_user', '/panel/sigorta-portal/onaylar', true],
  ['RG-18b', 'Doğrudan URL / Deep Link', 'insurance_company_user', '/panel/sigorta-portal/canli-izle', true],
  ['RG-19', 'Doğrudan URL / Deep Link', 'expert', '/panel/sigorta-portal', false],
  ['RG-20', 'Browser Refresh', 'field_staff', '/panel/hasar-dosyalari/abc', true],
  ['RG-21', 'Browser Refresh', 'field_staff', '/panel/finans/masraflar', false],
  ['RG-22', 'Portal home', 'expert', '/panel', true],
  ['RG-23', 'Portal profil', 'expert', '/panel/profil', true],
  ['RG-24', 'Portal profil', 'insurance_company_user', '/panel/profil', true],
  ['RG-25', 'Portal → Personel', 'assistance_company_user', '/panel/ayarlar', false],
  ['RG-26', 'Doğrudan URL / Deep Link', 'assistance_company_user', '/panel/asistans-portal/dosyalar', true],
  ['RG-27', 'Portal profil', 'assistance_company_user', '/panel/profil', true],
  ['RG-28', 'Saha tespit tamamlananlar', 'field_staff', '/panel/saha/tespiti-tamamlananlar', true],
  ['RG-29', 'Ofis tespit tamamlananlar yok', 'office_staff', '/panel/saha/tespiti-tamamlananlar', false],
  ['RG-30', 'Saha eski bekleyen URL yönlenir', 'field_staff', '/panel/saha/bekleyen-tespitler', true],
  ['RG-31', 'Ofis eski bekleyen URL yok', 'office_staff', '/panel/saha/bekleyen-tespitler', false],
];

const NAV_SEQ = [
  ['field_staff', '/panel/hasar-dosyalari', true],
  ['field_staff', '/panel/saha/tespiti-tamamlananlar', true],
  ['field_staff', '/panel/finans', false],
  ['field_staff', '/panel/hasar-dosyalari', true],
  ['field_staff', '/panel/hasar-dosyalari/yeni', true],
  ['expert', '/panel/eksper-portal', true],
  ['expert', '/panel/musteriler', false],
  ['expert', '/panel/eksper-portal/onaylar', true],
];

assert(RULES.length >= 30, `rule count ${RULES.length}`);
assert(RULES.some((r) => r.path === '/panel' && r.roles.length === 0), '/panel exact empty roles');
assert(RULES.some((r) => r.path === '/panel/eksper-portal'), 'eksper-portal rule');
assert(RULES.some((r) => r.path === '/panel/sigorta-portal'), 'sigorta-portal rule');
assert(RULES.some((r) => r.path === '/panel/asistans-portal'), 'asistans-portal rule');
assert(portalAllows('expert', '/panel/finans') === false, 'portal allowlist');

for (const [id, scenario, role, path, expect] of CASES) {
  const got = hasAccess(path, role, 'both');
  assert(got === expect, `${id} [${scenario}] role=${role} path=${path} expect=${expect} got=${got}`);
}

for (const [role, path, expect] of NAV_SEQ) {
  const got = hasAccess(path, role, role === 'field_staff' ? 'hasar' : 'both');
  assert(got === expect, `RG-NAV Back/Forward/DeepLink role=${role} path=${path} expect=${expect} got=${got}`);
}

console.log(`route-gate-smoke.mjs PASS (${CASES.length} matrix + ${NAV_SEQ.length} nav + contract)`);
