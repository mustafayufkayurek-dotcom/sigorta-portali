/** İl merkezi yaklaşık koordinatları — harita pin yerleşimi için */
export const TURKEY_PROVINCE_COORDS: Record<string, { lat: number; lng: number }> = {
  adana: { lat: 37.0, lng: 35.3213 },
  adiyaman: { lat: 37.7648, lng: 38.2786 },
  afyonkarahisar: { lat: 38.7507, lng: 30.5567 },
  agri: { lat: 39.7191, lng: 43.0503 },
  amasya: { lat: 40.6499, lng: 35.8353 },
  ankara: { lat: 39.9334, lng: 32.8597 },
  antalya: { lat: 36.8969, lng: 30.7133 },
  artvin: { lat: 41.1828, lng: 41.8183 },
  aydin: { lat: 37.856, lng: 27.8416 },
  balikesir: { lat: 39.6484, lng: 27.8826 },
  bilecik: { lat: 40.1428, lng: 29.9793 },
  bingol: { lat: 38.8855, lng: 40.4966 },
  bitlis: { lat: 38.3938, lng: 42.1232 },
  bolu: { lat: 40.7395, lng: 31.6089 },
  burdur: { lat: 37.7203, lng: 30.2908 },
  bursa: { lat: 40.1826, lng: 29.0669 },
  canakkale: { lat: 40.1553, lng: 26.4142 },
  cankiri: { lat: 40.6013, lng: 33.6134 },
  corum: { lat: 40.5506, lng: 34.9556 },
  denizli: { lat: 37.7765, lng: 29.0864 },
  diyarbakir: { lat: 37.9144, lng: 40.2306 },
  edirne: { lat: 41.6771, lng: 26.5557 },
  elazig: { lat: 38.681, lng: 39.2264 },
  erzincan: { lat: 39.75, lng: 39.5 },
  erzurum: { lat: 39.9043, lng: 41.2679 },
  eskisehir: { lat: 39.7767, lng: 30.5206 },
  gaziantep: { lat: 37.0662, lng: 37.3833 },
  giresun: { lat: 40.9128, lng: 38.3895 },
  gumushane: { lat: 40.4603, lng: 39.4814 },
  hakkari: { lat: 37.5744, lng: 43.7408 },
  hatay: { lat: 36.4018, lng: 36.3498 },
  isparta: { lat: 37.7648, lng: 30.5566 },
  mersin: { lat: 36.8121, lng: 34.6415 },
  istanbul: { lat: 41.055, lng: 28.985 }, // Şişli / Mecidiyeköy — karada (Haliç merkezi değil)
  izmir: { lat: 38.4192, lng: 27.1287 },
  kars: { lat: 40.6013, lng: 43.0975 },
  kastamonu: { lat: 41.3887, lng: 33.7827 },
  kayseri: { lat: 38.7312, lng: 35.4787 },
  kirklareli: { lat: 41.7351, lng: 27.2253 },
  kirsehir: { lat: 39.1425, lng: 34.1709 },
  kocaeli: { lat: 40.8533, lng: 29.8815 },
  konya: { lat: 37.8746, lng: 32.4932 },
  kutahya: { lat: 39.4167, lng: 29.9833 },
  malatya: { lat: 38.3552, lng: 38.3095 },
  manisa: { lat: 38.6191, lng: 27.4289 },
  kahramanmaras: { lat: 37.5858, lng: 36.9371 },
  mardin: { lat: 37.3212, lng: 40.7245 },
  mugla: { lat: 37.2153, lng: 28.3636 },
  mus: { lat: 38.9462, lng: 41.7539 },
  nevsehir: { lat: 38.6939, lng: 34.6857 },
  nigde: { lat: 37.969, lng: 34.6766 },
  ordu: { lat: 40.9839, lng: 37.8764 },
  rize: { lat: 41.0201, lng: 40.5234 },
  sakarya: { lat: 40.7569, lng: 30.3783 },
  samsun: { lat: 41.2867, lng: 36.33 },
  siirt: { lat: 37.9333, lng: 41.95 },
  sinop: { lat: 42.0264, lng: 35.1551 },
  sivas: { lat: 39.7477, lng: 37.0179 },
  tekirdag: { lat: 40.978, lng: 27.511 },
  tokat: { lat: 40.3167, lng: 36.55 },
  trabzon: { lat: 41.0027, lng: 39.7168 },
  tunceli: { lat: 39.1079, lng: 39.5401 },
  sanliurfa: { lat: 37.1591, lng: 38.7969 },
  usak: { lat: 38.6823, lng: 29.4082 },
  van: { lat: 38.4891, lng: 43.4089 },
  yozgat: { lat: 39.8181, lng: 34.8147 },
  zonguldak: { lat: 41.4564, lng: 31.7987 },
  aksaray: { lat: 38.3687, lng: 34.037 },
  bayburt: { lat: 40.2552, lng: 40.2249 },
  karaman: { lat: 37.1759, lng: 33.2287 },
  kirikkale: { lat: 39.8468, lng: 33.5153 },
  batman: { lat: 37.8812, lng: 41.1351 },
  sirnak: { lat: 37.5164, lng: 42.4611 },
  bartin: { lat: 41.6344, lng: 32.3375 },
  ardahan: { lat: 41.1105, lng: 42.7022 },
  igdir: { lat: 39.9167, lng: 44.0333 },
  yalova: { lat: 40.65, lng: 29.2667 },
  karabuk: { lat: 41.2061, lng: 32.6204 },
  kilis: { lat: 36.7184, lng: 37.1212 },
  osmaniye: { lat: 37.0742, lng: 36.2478 },
  duzce: { lat: 40.8438, lng: 31.1565 },
};

function normalizeProvinceKey(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

export function resolveProvinceCoords(cityName?: string | null): { lat: number; lng: number } | null {
  if (!cityName?.trim()) return null;
  const key = normalizeProvinceKey(cityName);
  return TURKEY_PROVINCE_COORDS[key] ?? null;
}
