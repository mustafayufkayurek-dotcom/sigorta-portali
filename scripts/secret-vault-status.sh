#!/usr/bin/env bash
# Felaket kasası durumu — şifre, anahtar, kutu ayarı yazılmaz.
# Sunucuda: APP_DIR=/opt/app bash scripts/secret-vault-status.sh
set -euo pipefail
echo "Felaket kasası"
echo "Dosya ve resim yedeği ikinci yerde durur. Şifre ve kutu ayarı yazılımda durmaz."
echo "Sunucu tamamen giderse giriş bilgisi elinizdeki kilitli kutudadır."
echo "Kasa yazılım hesabı açmaz; telefon veya ofis dışı kilitli kutu sizin işinizdir."
exit 0
