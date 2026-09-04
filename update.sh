#!/bin/bash
# ============================================================
#  UPDATE - Portal Pelanggan GenieACS
#  Untuk Ubuntu / Armbian
#  Gunakan script ini untuk update aplikasi tanpa reset konfigurasi
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_URL="https://github.com/anwar-BK/billing-V2.0.git"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║     UPDATE PORTAL PELANGGAN GENIEACS             ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Cek root
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}[WARN]${NC} Jalankan dengan: ${BOLD}sudo bash update.sh${NC}"
  exit 1
fi

cd "$SCRIPT_DIR"

# Backup settings.json sebelum source code diperbarui.
echo -e "${BLUE}[INFO]${NC} Backup settings.json sebelum update..."
if [ -f settings.json ]; then
  cp settings.json settings.json.bak
  echo -e "${GREEN}[OK]${NC} Backup tersimpan di settings.json.bak"
else
  echo -e "${YELLOW}[WARN]${NC} settings.json tidak ditemukan; lewati backup file."
fi

# Ambil perubahan terbaru dari GitHub tanpa menyentuh data runtime.
if [ -d .git ]; then
  echo -e "${BLUE}[INFO]${NC} Mengambil update dari GitHub..."
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "$REPO_URL"
  fi
  git fetch origin
  BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || true)"
  if [ -n "$BRANCH" ] && git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    git pull --ff-only origin "$BRANCH"
    echo -e "${GREEN}[OK]${NC} Source code diperbarui dari origin/$BRANCH"
  else
    echo -e "${YELLOW}[WARN]${NC} Branch remote tidak terdeteksi; source code tidak diubah."
  fi
else
  echo -e "${YELLOW}[WARN]${NC} Folder ini bukan clone Git; lewati update source code."
fi

# Update dan restart sesuai mode instalasi.
if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  echo -e "${BLUE}[INFO]${NC} Build dan restart Docker Compose..."
  docker compose up -d --build
  echo -e "${GREEN}[OK]${NC} Container diperbarui dan dijalankan kembali."
else
  echo -e "${BLUE}[INFO]${NC} Update dependensi npm..."
  npm install --production --silent
  echo -e "${GREEN}[OK]${NC} Dependensi diperbarui."
  echo -e "${BLUE}[INFO]${NC} Restart aplikasi..."
  pm2 restart app-customer
  echo -e "${GREEN}[OK]${NC} Aplikasi berhasil direstart."
fi

# Tampilkan status jika menggunakan PM2.
if command -v pm2 >/dev/null 2>&1; then
  pm2 status app-customer
fi

echo ""
echo -e "${GREEN}${BOLD}Update selesai!${NC}"
echo -e "Konfigurasi lama tersimpan di: ${YELLOW}settings.json.bak${NC}"
echo ""
