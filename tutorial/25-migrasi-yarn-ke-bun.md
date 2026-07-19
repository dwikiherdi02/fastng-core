# 25 — Migrasi Package Manager & Runtime: Yarn → Bun

**Tujuan**: Menjelaskan perpindahan tooling FastNG dari Yarn (package manager) + Node/`tsx` (dev runtime) ke **Bun**, dan bagaimana command sehari-hari berubah.

**Kapan digunakan**: Setiap kali menjalankan `install`, `dev`, `build`, `start`, `lint`, `format`, `db:*`, atau `audit` — semua sekarang lewat Bun, bukan Yarn.

**Prasyarat**: Bun terpasang (`bun --version` >= 1.1). Node.js >= 20 tetap dibutuhkan sebagai dependency tidak langsung (Prisma CLI dan sejumlah tool masih berjalan di atas Node).

## Pengenalan

FastNG sebelumnya memakai **Yarn** untuk instalasi dependency, dan **Node.js + `tsx`** untuk menjalankan TypeScript langsung tanpa build (`node --import tsx/esm --watch src/server.ts`). Bun menggabungkan kedua peran itu dalam satu binary: Bun adalah package manager (seperti Yarn/npm) **dan** runtime JavaScript/TypeScript yang bisa mengeksekusi file `.ts` dengan ESM secara native, tanpa loader tambahan. Ini menghilangkan kebutuhan dependency `tsx`, mempercepat instalasi dependency, dan menyederhanakan command dev.

**Yang TIDAK berubah**: pola arsitektur (Route → Controller → Service → Repository → Entity), struktur modul, registry, Prisma sebagai ORM, dan strategi build produksi (`tsc` tetap dipakai untuk compile ke `dist/`). Bun di sini murni menggantikan peran Yarn + Node/`tsx` sebagai tooling — bukan mengganti framework atau arsitektur aplikasi.

## Alur/Mekanisme

```
Sebelum:  yarn install        → node_modules (yarn.lock)
          yarn dev             → node --import tsx/esm --watch src/server.ts
          yarn start           → node dist/server.js

Sesudah:  bun install          → node_modules (bun.lock)
          bun run dev          → bun --watch src/server.ts   (TS/ESM native, tanpa tsx)
          bun run start        → bun dist/server.js
```

`build` (`tsc`) tidak berubah — hanya *siapa yang menjalankan* hasil build-nya (`dist/server.js`) yang beralih dari `node` ke `bun`. Bun dapat menjalankan file JavaScript hasil compile `tsc` tanpa masalah karena Bun adalah superset runtime yang kompatibel dengan Node API pada kasus umum.

## Tabel Command: Yarn (lama) vs Bun (baru)

| Aksi | Yarn (lama) | Bun (baru) |
|---|---|---|
| Install dependency | `yarn` / `yarn install` | `bun install` |
| Tambah dependency | `yarn add {package}` | `bun add {package}` |
| Hapus dependency | `yarn remove {package}` | `bun remove {package}` |
| Jalankan dev server | `yarn dev` | `bun run dev` |
| Build (compile TS) | `yarn build` | `bun run build` |
| Jalankan hasil build | `yarn start` | `bun run start` |
| Generate Prisma Client | `yarn db:generate` | `bun run db:generate` |
| Migrasi (dev, buat file) | `yarn db:migrate` | `bun run db:migrate` |
| Push schema (tanpa file migrasi) | `yarn db:push` | `bun run db:push` |
| Sinkron schema + katalog modul | `yarn db:sync` | `bun run db:sync` |
| Seed role & admin default | `yarn db:seed` | `bun run db:seed` |
| Lint | `yarn lint` | `bun run lint` |
| Format | `yarn format` | `bun run format` |
| Audit keamanan dependency | `yarn audit --level high` | `bun audit --audit-level=high` |
| Jalankan binary paket sekali pakai | `npx {tool}` | `bunx {tool}` |

## Langkah-Langkah (yang sudah dilakukan pada migrasi ini)

### Langkah 1: Perbarui `package.json`

- Script `dev`, `start`, `db:sync`, `db:seed` diganti agar menjalankan `bun` langsung (bukan `node --import tsx/esm`).
- `tsx` dihapus dari `devDependencies` — tidak lagi diperlukan.
- `audit` diganti dari `yarn audit --level high` menjadi `bun audit --audit-level=high`.
- Ditambahkan `"packageManager": "bun@<versi>"` dan `"engines": { "bun": ">=1.1.0" }` untuk kejelasan tooling.

### Langkah 2: Ganti lockfile

```bash
rm yarn.lock
bun install
```

Bun menghasilkan `bun.lock` (dikomit ke git, menggantikan peran `yarn.lock`).

### Langkah 3: Update script CLI internal

`scripts/db-sync.ts` memanggil Prisma CLI lewat `spawnSync`. Baris yang tadinya `npx prisma db push ...` diganti menjadi `bunx prisma db push ...` agar tidak bergantung pada `npx`/npm terpisah.

### Langkah 4: Bersihkan `.gitignore`

Entri khusus Yarn Berry (`.yarn/cache`, `.yarn/unplugged`, `.yarn/build-state.yml`, `.yarn/install-state.gz`, `.pnp.*`, `yarn-debug.log*`, `yarn-error.log*`) dihapus karena tidak relevan lagi.

### Langkah 5: Update dokumentasi

Semua referensi command `yarn ...` di `CLAUDE.md`, `.claude/rules/*.md`, `.claude/skills/*/SKILL.md`, `README.md`, dan tutorial lain diganti ke bentuk `bun run ...` / `bun add` / `bun audit` yang sesuai.

### Langkah 6: Tambahkan shim kompatibilitas `mongodb`/`bson` untuk Bun

Saat verifikasi end-to-end, `bun run dev` dan `bun run db:sync` **crash** dengan error:

```
NotImplementedError: node:v8 isBuildingSnapshot is not yet implemented in Bun.
```

**Penyebab**: `src/core/database/index.ts` selalu meng-import driver Mongoose secara statis (agar factory pattern bisa memilih driver saat runtime berdasarkan `DB_DRIVER`), yang secara transitif meng-*import* `mongodb` → `bson`. Static initializer `bson` memanggil `process.getBuiltinModule('v8').startupSnapshot.isBuildingSnapshot()` untuk mereset state `ObjectId` setelah V8 startup snapshot display-restore. Bun (diverifikasi di v1.3.14) sudah punya API ini sebagai *stub*, tapi men-throw `NotImplementedError` begitu **dipanggil** — bukan `undefined` yang aman di-skip oleh optional chaining `bson`. Ini terjadi **terlepas dari `DB_DRIVER` yang dipakai** (termasuk `sqlite`), karena importnya statis/eager, bukan kondisional.

**Solusi**: tambahkan file preload `scripts/bun-v8-compat.ts` yang mem-patch `isBuildingSnapshot` menjadi no-op *sebelum* modul lain dimuat, lalu daftarkan lewat `bunfig.toml`:

```toml
# bunfig.toml
preload = ["./scripts/bun-v8-compat.ts"]
```

Bun otomatis membaca `bunfig.toml` di root project untuk setiap invocation (`bun run dev`, `bun run db:sync`, `bun run start`, dll), jadi shim ini aktif tanpa perlu diketik ulang di tiap script.

## Contoh Lengkap

Alur setup project dari nol setelah migrasi:

```bash
# 1. Clone
git clone <repo-url>
cd fastng-core

# 2. Install dependency (postinstall otomatis menjalankan `prisma generate`)
bun install

# 3. Siapkan env
cp .env.example .env

# 4. Sinkron schema + seed data awal (driver default: sqlite)
bun run db:sync
bun run db:seed

# 5. Jalankan dev server
bun run dev
```

## Aturan/Pedoman

| ✅ Lakukan | ❌ Hindari |
|---|---|
| Gunakan `bun install` / `bun add` / `bun remove` untuk semua perubahan dependency | Menjalankan `yarn` atau `npm install` — akan menghasilkan lockfile ganda yang bentrok dengan `bun.lock` |
| Panggil script lewat `bun run <script>` (eksplisit, konsisten) | Bergantung pada shorthand `bun <script>` di dokumentasi tim — bisa ambigu dengan subcommand bawaan Bun di masa depan |
| Commit `bun.lock` ke git | Meng-*gitignore* `bun.lock` — lockfile tetap wajib untuk instalasi yang reproducible |
| Verifikasi `node_modules/.prisma/client` ter-generate setelah `bun install` | Mengasumsikan `postinstall` selalu jalan tanpa memeriksa — lihat bagian Catatan |

## Verifikasi

1. `bun install` → cek `bun.lock` ter-generate dan `node_modules/.prisma/client` ada (artinya `postinstall` / `prisma generate` berjalan).
2. `bun run dev` → server naik di `http://localhost:3000`, `/docs` bisa diakses.
3. `bun run db:sync` lalu `bun run db:seed` → tidak error, role default & admin user ter-seed.
4. `bun run build` lalu `bun run start` → server naik dari hasil compile `dist/`.
5. `bun run lint` dan `bun audit` → berjalan tanpa error konfigurasi.

## Referensi Kode Aktual

- `package.json` — script `dev`/`start`/`db:sync`/`db:seed`/`audit`, field `packageManager`/`engines`
- `scripts/db-sync.ts` — pemanggilan `bunx prisma db push`
- `scripts/bun-v8-compat.ts` — shim kompatibilitas `v8.startupSnapshot.isBuildingSnapshot` untuk Bun (lihat Langkah 6)
- `bunfig.toml` — mendaftarkan shim di atas sebagai `preload`
- `.gitignore` — entri Yarn Berry yang sudah dihapus
- `.claude/rules/conventions.md` — tabel Package Manager & Key Scripts

## Catatan

- **Bug kompatibilitas `mongodb`/`bson` di Bun** (lihat Langkah 6): tanpa `scripts/bun-v8-compat.ts` + `bunfig.toml`, **setiap** command yang mengimpor `src/core/database/index.ts` (yaitu `dev`, `start`, `db:sync`, `db:seed`) akan crash di Bun 1.3.14 — bukan cuma saat `DB_DRIVER=mongodb`, karena driver Mongoose di-import secara statis untuk mendukung factory pattern. Ini adalah keterbatasan Bun (belum mengimplementasikan `node:v8` startup-snapshot API), bukan bug di kode FastNG. Hapus shim ini jika versi Bun yang dipakai sudah mengimplementasikan API tersebut dengan benar (cek dengan menghapus sementara `preload` di `bunfig.toml` lalu jalankan `bun run dev` — jika tidak crash, shim sudah tidak diperlukan).
- **`postinstall` lifecycle script**: Bun membatasi eksekusi lifecycle script dari *dependency* pihak ketiga demi keamanan, tapi `postinstall` milik project sendiri (memanggil `prisma generate`) tetap berjalan otomatis saat `bun install` — sudah diverifikasi pada migrasi ini. Jika suatu saat ini berhenti berjalan (misal setelah upgrade Bun), jalankan manual `bun run db:generate` sebagai fallback.
- **`bun audit`**: fitur ini tersedia sejak Bun versi yang cukup baru (diverifikasi ada di Bun 1.3.x lewat `bun audit --help`). Jika tim memakai Bun versi lama yang belum mendukungnya, gunakan fallback `npm audit --audit-level=high`.
- **Prisma & native binary**: Prisma query engine tetap berupa binary native yang dijalankan sebagai child process oleh Prisma CLI — ini transparan terhadap Bun maupun Node, jadi tidak ada penyesuaian khusus yang diperlukan di sisi Prisma.
- **Tidak ada CI/Docker/Husky** di repo ini saat migrasi dilakukan, sehingga tidak ada file pipeline yang perlu disesuaikan. Jika CI/Docker ditambahkan di kemudian hari, pastikan base image/action menyediakan Bun (mis. `oven-sh/setup-bun` untuk GitHub Actions, atau base image `oven/bun` untuk Docker).

## Lihat Juga

- `.claude/rules/conventions.md` — kebijakan tooling & package manager terkini
- `CLAUDE.md` — bagian Tooling & Conventions
- `tutorial/18-migrasi-seeder-per-module.md` — command `db:sync`/`db:seed` yang sekarang dijalankan lewat Bun
