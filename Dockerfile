# 1. Gunakan base image Node.js versi 20
FROM node:20-slim

# 2. Tentukan direktori kerja di dalam kontainer
WORKDIR /app

# Kompilasi native module (better-sqlite3) butuh toolchain di image slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# 3. Salin file package.json dan package-lock.json (jika ada)
COPY package*.json ./

# 4. Install dependensi aplikasi secara bersih
RUN npm install --production

# 5. Salin seluruh source code billing ke dalam kontainer
COPY . .

RUN mkdir -p /app/database /app/logs /app/auth_info_baileys

# 6. Buka port sesuai aplikasi billing Anda (3001)
EXPOSE 3001

# 7. Perintah untuk menjalankan aplikasi
CMD ["npm", "start"]
