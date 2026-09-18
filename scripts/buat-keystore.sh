#!/usr/bin/env bash
# Membuat kunci penanda tangan APK — sekali seumur hidup app ini.
#
# Kunci ini yang membuktikan sebuah APK benar-benar keluaran Anda. Android
# menolak memasang update yang ditandatangani kunci lain, jadi:
#   - hilang  → app yang sudah terpasang tidak bisa di-update, harus dicopot
#   - bocor   → orang lain bisa membuat "update" palsu atas nama app ini
# Simpan berkasnya di tempat aman dan JANGAN di-commit (sudah di .gitignore).
#
# Mesin ini tidak punya JDK, jadi keytool dijalankan di dalam container.
# Yang dibutuhkan cuma Docker.
#
# Pakai:  bash scripts/buat-keystore.sh
set -euo pipefail

cd "$(dirname "$0")/.."

KEYSTORE="android.keystore"
ALIAS="warkopsaja"
PAKET="com.balanglompo.warkopsaja"

if [ -f "$KEYSTORE" ]; then
  echo "❌ $KEYSTORE sudah ada. Berhenti — menimpanya berarti kehilangan kunci lama."
  exit 1
fi

read -rsp "Password untuk keystore (simpan baik-baik, tidak bisa dipulihkan): " PW; echo
read -rsp "Ulangi password: " PW2; echo
[ "$PW" = "$PW2" ] || { echo "❌ Password tidak sama."; exit 1; }
[ ${#PW} -ge 6 ] || { echo "❌ Minimal 6 karakter."; exit 1; }

echo "→ Membuat kunci (RSA 2048, berlaku ~27 tahun)…"
docker run --rm -v "$PWD":/ks -w /ks eclipse-temurin:17-jdk \
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PW" -keypass "$PW" \
    -dname "CN=Warkopsaja, OU=Kasir, O=Warkopsaja, L=Makassar, C=ID" >/dev/null

echo "→ Mengambil sidik jari SHA-256…"
SIDIK=$(docker run --rm -v "$PWD":/ks -w /ks eclipse-temurin:17-jdk \
  keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$PW" \
  | grep -i "SHA256:" | head -1 | sed 's/.*SHA256: *//' | tr -d ' \r')

[ -n "$SIDIK" ] || { echo "❌ Gagal membaca sidik jari."; exit 1; }

# Sidik jari ini BUKAN rahasia — memang untuk dipublikasikan, supaya Android
# bisa mencocokkan APK dengan domainnya (Digital Asset Links). Yang rahasia
# cuma berkas keystore + passwordnya.
cat > public/.well-known/assetlinks.json <<JSON
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "$PAKET",
      "sha256_cert_fingerprints": [
        "$SIDIK"
      ]
    }
  }
]
JSON

echo
echo "✅ Selesai."
echo "   Kunci      : $KEYSTORE  (JANGAN di-commit, sudah di .gitignore)"
echo "   Sidik jari : $SIDIK"
echo "   assetlinks : public/.well-known/assetlinks.json sudah diisi"
echo
echo "Langkah berikutnya — simpan kunci & password ke GitHub Secrets supaya"
echo "Actions bisa menandatangani APK-nya:"
echo
echo "   base64 -i $KEYSTORE | gh secret set ANDROID_KEYSTORE_BASE64"
echo "   gh secret set ANDROID_KEYSTORE_PASSWORD   # tempel password di atas"
echo "   gh secret set ANDROID_KEY_PASSWORD        # password yang sama"
echo
echo "Lalu commit assetlinks.json, deploy (push ke main), baru jalankan"
echo "workflow \"Build APK Android\"."
