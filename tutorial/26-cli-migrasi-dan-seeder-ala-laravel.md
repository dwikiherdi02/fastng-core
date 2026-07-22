# 26 — CLI Migrasi Per-Module & Seeder Berbasis JSON

**Tujuan**: Menjelaskan perintah `migrate:*` bergaya Laravel (riwayat migrasi **milik tiap modul**, batch, rollback nyata) serta seeder data statis berbasis file **JSON**.

**Kapan digunakan**: Setiap kali mengubah fragmen schema modul, mengaktifkan/menonaktifkan modul, atau menambah data awal (seed) untuk sebuah modul.

**Prasyarat**: `.env` terisi (`DB_DRIVER`, `DATABASE_URL`/`MONGODB_URI`). Package manager `Bun`.

> **Menggantikan alur lama**: `bun run db:push` dan `bun run db:migrate` sudah dihapus, dan `bun run db:sync` tidak lagi menyentuh schema (lihat `tutorial/18` yang sudah diperbarui).

## Pengenalan

Sebelumnya schema di-*push* langsung ke database (`prisma db push --accept-data-loss`): tidak ada riwayat, tidak bisa di-rollback, dan berbahaya untuk produksi. Sekarang FastNG punya CLI migrasi dengan semantik Laravel:

| Perintah | Arti |
|---|---|
| `bun run migrate` | Buat migrasi dari perubahan fragmen tiap modul, lalu terapkan |
| `bun run migrate:install` | Buat tabel repository migrasi (`_fastng_migrations`) |
| `bun run migrate:status` | Tampilkan status tiap migrasi per modul (Ran/Pending/Disabled + batch) |
| `bun run migrate:rollback` | Batalkan batch terakhir |
| `bun run migrate:reset` | Batalkan **semua** migrasi |
| `bun run migrate:refresh` | Reset lalu jalankan ulang semua migrasi |
| `bun run migrate:fresh` | Drop semua tabel lalu jalankan ulang semua migrasi |
| `bun run db:seed` | Jalankan seeder milik semua modul aktif |

Dua prinsip inti yang membedakan dari versi sebelumnya:

1. **Migrasi dimiliki tiap modul**, bukan digabung jadi satu riwayat global. Modul `role` dan modul `auth` masing-masing punya folder migrasinya sendiri di `src/modules/{name}/db/migrations/` — mengubah fragmen `role.prisma` saja menghasilkan migrasi baru **hanya** di folder migrasi modul `role`.
2. **Seeder data statis ditulis sebagai JSON**, bukan kode TypeScript. Menyebutkan `table` tujuan secara eksplisit, karena satu modul bisa punya beberapa tabel. Kode TypeScript (`*.seeder.ts`) tetap tersedia sebagai *escape hatch* untuk seed data yang benar-benar dinamis atau relasional.

## Alur/Mekanisme

### Migrasi per-modul: bagaimana diff dilakukan tanpa shadow database

Kunci sistem ini: setiap fragmen modul (`src/modules/{name}/db/{name}.prisma`) **berdiri sendiri** — aturan arsitektur mengharuskan tidak ada `@relation` lintas modul, hanya kolom FK skalar. Ini berarti `prisma/base/{driver}.prisma` (blok `datasource`+`generator` saja) digabung dengan **fragmen satu modul** sudah menjadi datamodel yang valid dan bisa di-diff sendiri, terlepas dari modul lain.

```
bun run migrate
   │
   ├─ validateDependencies()        ← modul enable tapi dependency disable → error jelas
   ├─ assembleSchema()              ← tetap dirakit untuk prisma/schema.prisma (dipakai prisma generate & db execute)
   ├─ prisma generate               ← client disegarkan SEBELUM di-import (hindari EPERM di Windows)
   │
   └─ untuk setiap modul AKTIF yang punya fragmen, urut topological:
        ├─ terapkan migrasi modul itu yang belum tercatat di ledger
        ├─ to   = base + fragmen modul ini (file sementara)
        ├─ from = snapshot migrasi TERAKHIR milik modul ini (atau base saja bila belum ada)
        ├─ diff(from → to)  → migration.sql  (kosong? modul ini "up to date", lanjut ke modul berikutnya)
        ├─ diff(to → from)  → down.sql       (kebalikannya)
        ├─ tulis ke src/modules/{modul}/db/migrations/<timestamp>_<name>/
        └─ terapkan + catat di ledger (batch N)
   │
   ├─ untuk modul yang baru DINONAKTIFKAN tapi migrasinya masih tercatat:
   │     jalankan down.sql-nya (urut terbalik), hapus dari ledger  ← lihat bagian "Modul Dinonaktifkan"
   └─ syncCatalog()                 ← menu/permission modul aktif di-upsert, nonaktif dihapus
```

Isi satu folder migrasi (milik satu modul):

```
src/modules/role/db/migrations/20260722143000_init/
  migration.sql            ← script "naik", HANYA tabel milik modul role
  down.sql                 ← script "turun" (dipakai rollback/reset/refresh)
  schema.snapshot.prisma   ← base + fragmen role, state SETELAH migrasi ini — baseline diff berikutnya
```

Karena snapshot disimpan di dalam folder migrasi modul itu sendiri, tidak ada state tersembunyi, dan modul lain tidak pernah ikut ter-diff hanya karena modul ini berubah.

### Batch: kenapa `migrate:install` ada

Laravel melakukan rollback **per batch**, bukan per file. Semua migrasi (lintas modul sekalipun) yang diterapkan dalam satu kali `bun run migrate` mendapat nomor batch yang sama, dan `migrate:rollback` membatalkan satu batch penuh sekaligus — walau migrasinya tersebar di beberapa folder modul berbeda. Nomor batch disimpan di tabel `_fastng_migrations` — inilah "migration repository" yang dibuat oleh `migrate:install`.

| kolom | isi |
|---|---|
| `module` | nama modul pemilik migrasi |
| `migration` | nama folder migrasi |
| `batch` | nomor batch (global, lintas modul) |
| `applied_at` | waktu penerapan |

Migrasi diterapkan lewat `prisma db execute`, bukan `prisma migrate deploy`, sehingga tabel inilah **satu-satunya** sumber kebenaran tentang apa yang sudah jalan — bukan `_prisma_migrations`.

### Modul Dinonaktifkan: rollback otomatis

Ketika sebuah modul diubah dari `enabled: true` menjadi `false` di `module.registry.ts`, `bun run migrate` berikutnya **otomatis membatalkan** migrasi milik modul itu (menjalankan `down.sql`-nya, menghapus catatannya dari ledger) — bukan membuat migrasi `DROP TABLE` baru. File migrasi modul itu tetap ada di disk (tidak dihapus); kalau modul diaktifkan kembali, `bun run migrate` akan menerapkan ulang migrasi yang sama.

```bash
# src/registry/module.registry.ts: ubah enabled: true → false pada sebuah modul
bun run migrate
#   ...
#   Rolled back: {modul}/20260722_init
```

`migrate:status` menandai migrasi milik modul nonaktif sebagai `Disabled` (bukan `Pending`) selama file migrasinya masih ada tapi belum/tidak diterapkan.

## Langkah-Langkah: Migrasi

### Langkah 1: Ubah fragmen schema modul

Seperti biasa, tiap modul memiliki fragmen `src/modules/{name}/db/{name}.prisma` berisi hanya blok `model` (lihat `tutorial/18`).

```prisma
// src/modules/session/db/session.prisma
model Session {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  userAgent String?  @map("user_agent")   // ← kolom baru
  @@map("sessions")
}
```

### Langkah 2: Buat & terapkan migrasi

```bash
bun run migrate -- --name=add_user_agent
```

Output — perhatikan hanya modul `session` yang mendapat migrasi baru, modul lain tetap "up to date":

```
  permission: up to date.
  Created migration: session/20260722143512_add_user_agent
  Applied: session/20260722143512_add_user_agent (batch 2)
  menu: up to date.
  role: up to date.
  auth: up to date.
```

Tanpa `--name`, migrasi diberi nama `init` (migrasi pertama modul itu) atau `update` (selanjutnya).

### Langkah 3: Periksa status

```bash
bun run migrate:status
```

```
  Module      Migration                      Batch  Status
  ----------  -----------------------------  -----  -------
  permission  20260722001424_init            1      Ran
  menu        20260722001450_init            1      Ran
  session     20260722001437_init            1      Ran
  session     20260722143512_add_user_agent  2      Ran
  role        20260722001502_init            1      Ran
  auth        20260722001516_init            1      Ran
```

### Langkah 4: Rollback bila perlu

```bash
bun run migrate:rollback              # batalkan batch terakhir (lintas modul bila perlu)
bun run migrate:rollback -- --step=2  # batalkan 2 batch terakhir
```

Setelah rollback, fragmen modul **masih** menggambarkan state terbaru (schema tidak berubah, hanya databasenya yang mundur). Statusnya menjadi `Pending`; jalankan `bun run migrate` lagi untuk menerapkannya kembali — batch barunya bertambah, persis seperti Laravel.

### Langkah 5: Membangun ulang database

```bash
bun run migrate:reset              # batalkan semua migrasi tiap modul (pakai down.sql, urut modul terbalik)
bun run migrate:refresh -- --seed  # reset lalu jalankan ulang semua + seed
bun run migrate:fresh -- --seed    # drop semua tabel lalu jalankan ulang semua + seed
```

Bedanya `refresh` vs `fresh`: `refresh` memakai `down.sql` tiap modul, sedangkan `fresh` menghapus seluruh tabel langsung dari database (di-introspeksi via `migrate diff --to-empty`, mencakup seluruh database termasuk tabel ledger). Pakai `fresh` kalau database sudah *drift* atau ada `down.sql` yang rusak.

## Seeder Berbasis JSON

### Struktur

```
src/modules/{name}/seeders/
  {nama-bebas}.json         ← data statis: sebut tabel tujuan + baris datanya
  {nama-bebas}.seeder.ts    ← escape hatch untuk seed data dinamis/relasional
```

Satu folder `seeders/` boleh berisi campuran keduanya — cocok untuk modul yang punya beberapa tabel (mis. modul `role` py punya tabel `roles` dan grant relasional `role_menu_permissions`).

### Format file JSON

```json
{
  "table": "roles",
  "uniqueBy": ["code"],
  "order": 1,
  "rows": [
    { "code": "admin", "name": "Administrator", "description": "Full access", "is_active": true },
    { "code": "user",  "name": "User",          "description": "Default access", "is_active": true }
  ]
}
```

| field | wajib | arti |
|---|---|---|
| `table` | ya | Nama **tabel** tujuan (snake_case, sesuai `@@map`) — inilah pembeda antar file seeder dalam satu modul |
| `uniqueBy` | ya | Kolom (snake_case) penentu identitas baris; dipakai untuk cari-lalu-upsert (idempoten) |
| `rows` | ya | Array objek ber-key **nama kolom** (snake_case) |
| `order` | tidak | Urutan dalam satu modul, default 0 |

Nilai di dalam `rows` boleh berupa directive:

| directive | hasil |
|---|---|
| `{ "$env": "SEED_ADMIN_EMAIL" }` | Diganti isi environment variable itu (error jelas kalau tidak diset) |
| `{ "$hash": <nilai atau directive lain> }` | bcrypt hash dari nilai yang di-resolve (`SALT_ROUNDS = 12`, sama seperti registrasi user biasa) |

Contoh menggabungkan keduanya (password dari env, di-hash):

```json
{
  "table": "users",
  "uniqueBy": ["email"],
  "rows": [{
    "username": { "$env": "SEED_ADMIN_USERNAME" },
    "email":    { "$env": "SEED_ADMIN_EMAIL" },
    "password": { "$hash": { "$env": "SEED_ADMIN_PASSWORD" } },
    "is_active": true
  }]
}
```

### Bagaimana JSON dieksekusi (driver-agnostic)

- **Prisma** (sqlite/mysql/postgresql/sqlserver): `table` dicocokkan ke model Prisma lewat metadata DMMF skema (`Prisma.dmmf.datamodel.models`) — metadata yang sama yang dipakai Prisma Client sendiri, jadi otomatis sinkron dengan `@@map`/`@map` di fragmen modul. Nama kolom snake_case diterjemahkan ke nama field camelCase, lalu dicari via `findFirst({ where })` (dari `uniqueBy`) → `update` bila ada, `create` bila belum.
- **MongoDB**: nama koleksi & field sudah snake_case (lihat `src/core/database/models/`), jadi file JSON yang sama langsung dipakai tanpa terjemahan — `updateOne(filter, { $set: row }, { upsert: true })`.

**Batasan penting**: seeder JSON hanya berlaku untuk tabel dengan **satu kolom `id`** tunggal (`@id`). Tabel join dengan primary key gabungan (mis. `user_roles` dengan `@@id([userId, roleId])`) tidak bisa diidentifikasi dengan cara ini — untuk tabel semacam itu, tulis `*.seeder.ts`.

### Kapan harus turun ke `*.seeder.ts`

Tulis file `.seeder.ts` (bukan `.json`) kalau seed data-nya:
- **Dinamis** — nilainya bergantung pada state database saat itu (contoh: grant `admin` role diturunkan dari katalog menu yang bisa berubah tiap modul di-enable/disable).
- **Relasional** menyentuh tabel dengan primary key gabungan (contoh: assign role ke user lewat `user_roles`).

```ts
// src/registry/seeder.ts
export interface ModuleSeeder {
  /** Nama unik untuk selektor --class. Konvensi PascalCase. */
  name: string
  /** Urutan di dalam satu modul (kecil dulu). Default 0. */
  order?: number
  run(ctx: SeederContext): Promise<void>
}

export interface SeederContext {
  db: PrismaClient | null   // null untuk mongodb
  driver: Env['DB_DRIVER']
  log: (message: string) => void
}
```

Contoh nyata di repo — modul `role` memisah data statis dari logika dinamis:

- `src/modules/role/seeders/roles.json` — baris tabel `roles` (`admin`, `user`)
- `src/modules/role/seeders/grants.seeder.ts` (`order: 2`) — assign grant per role dari katalog menu (dinamis, harus baca live data)

Dan modul `auth`:

- `src/modules/auth/seeders/users.json` — baris tabel `users`, pakai `$env`+`$hash` untuk admin default
- `src/modules/auth/seeders/admin-role.seeder.ts` (`order: 2`) — assign role `admin` lewat `user_roles` (primary key gabungan, bukan tabel ber-`id` tunggal)

### Urutan eksekusi

`loadSeeders()` memindai modul **aktif**, membaca campuran `*.json` dan `*.seeder.ts` dalam satu folder, lalu mengurutkan dengan:

1. urutan topological registry (`dependsOn`) — modul `auth` `dependsOn: ['role', ...]`, jadi seeder `role` dijamin selesai sebelum seeder `auth` mulai;
2. `order` (default 0) — di dalam satu modul, `roles.json` (order 1) sebelum `grants.seeder.ts` (order 2);
3. nama file.

### Menjalankan

```bash
bun run db:seed                          # semua seeder modul aktif
bun run db:seed -- --module=role         # hanya modul role
bun run db:seed -- --class=roles         # basename file JSON
bun run db:seed -- --class=GrantsSeeder  # nama seeder.ts
```

## Contoh Lengkap: menambah seeder baru

Misal modul `posts` butuh kategori awal (tabel `categories`, kolom `id` tunggal — cocok untuk JSON).

**1. Buat file `src/modules/posts/seeders/categories.json`:**

```json
{
  "table": "categories",
  "uniqueBy": ["slug"],
  "rows": [
    { "slug": "berita", "name": "Berita" },
    { "slug": "tutorial", "name": "Tutorial" },
    { "slug": "pengumuman", "name": "Pengumuman" }
  ]
}
```

**2. Jalankan:**

```bash
bun run db:seed -- --module=posts
```

Tidak ada registrasi manual: file cukup ada di folder `seeders/` modul yang aktif.

## Aturan/Pedoman

| ✅ Lakukan | ❌ Jangan |
|---|---|
| Tulis JSON untuk data statis, `*.seeder.ts` hanya untuk yang dinamis/relasional | Menulis TypeScript untuk sekadar upsert baris statis |
| `uniqueBy` merujuk kolom yang benar-benar unik secara logis | Mengandalkan `uniqueBy` untuk tabel tanpa id tunggal (pakai `*.seeder.ts`) |
| Simpan seeder di modul pemilik datanya | Menaruh seed data domain di `src/core/` |
| Commit folder `db/migrations/` tiap modul ke git | Mengedit `prisma/schema.prisma` manual (auto-generated) |
| Pakai `migrate:fresh` kalau database sudah drift | Menjalankan `prisma migrate dev`/`db push` mentah (riwayatnya beda) |
| Biarkan `migrate` merollback modul yang baru dinonaktifkan | Menghapus manual folder migrasi modul yang dinonaktifkan |

**Catatan MongoDB**: semua perintah `migrate:*` tidak melakukan migrasi schema (koleksi dibuat lazy) — hanya sinkron katalog yang berjalan. `bun run db:seed` tetap berfungsi normal (JSON seeder memakai `mongoose.connection.collection()` langsung).

## Verifikasi

1. `bun run migrate:status` → daftar migrasi tiap modul beserta batch-nya.
2. `bun run migrate` dua kali berturut-turut → yang kedua menampilkan `up to date.` untuk semua modul.
3. `bun run db:seed` dua kali → tidak error, data tidak dobel.
4. Tambah kolom di fragmen SATU modul → `bun run migrate` → cek migrasi baru **hanya** muncul di `src/modules/{modul-itu}/db/migrations/`, modul lain tetap "up to date".
5. `bun run migrate:rollback` → `migrate:status` menandai migrasi tadi `Pending`, kolomnya hilang dari database, modul lain tidak tersentuh.
6. Nonaktifkan sebuah modul ber-fragmen (yang tidak punya dependent lain) di registry → `bun run migrate` → migrasinya otomatis di-rollback, status `Disabled`.
7. `bun run dev`, lalu login memakai `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, panggil `GET /api/v1/auth/me/menus` → menu sesuai grant `admin`.

## Migrasi dari Database Lama (hasil `db push`)

Database yang dulu dibangun dengan `bun run db:push` belum punya riwayat migrasi. Adopsi dengan:

```bash
bun run migrate:install
```

Perintah ini mendeteksi database yang **sudah berisi tabel tetapi tanpa riwayat**, lalu untuk tiap modul aktif ber-fragmen: membuat migrasi baseline (atau mengadopsi migrasi yang sudah ada di disk) dan mencatatnya sebagai batch 1 **tanpa menjalankannya**, sehingga data lama tetap aman. Kalau ternyata schema-nya belum sesuai, bangun ulang dengan `bun run migrate:fresh`.

## Referensi Kode Aktual

- `scripts/migrate.ts` — dispatcher CLI (`install|status|rollback|reset|refresh|fresh`)
- `src/core/database/migration/migration.runner.ts` — implementasi tujuh perintah, loop per-modul
- `src/core/database/migration/migration.files.ts` — struktur folder migrasi per modul, `composeModuleSchema()` (base + fragmen satu modul)
- `src/core/database/migration/migration.ledger.ts` — tabel `_fastng_migrations` (kolom `module`, DDL per driver)
- `src/core/database/seeder/table-writer.ts` — eksekusi upsert JSON (Prisma DMMF + Mongoose collection)
- `src/core/database/seeder/json-seeder.ts` — resolve directive `$env`/`$hash`
- `src/registry/seeder.ts` — loader gabungan JSON + `ModuleSeeder`, `loadSeeders()`
- `src/registry/topology.ts` — topological sort yang dipakai bersama module loader & seeder/migration loader
- `scripts/db-seed.ts` — CLI seeder
- `src/modules/role/seeders/{roles.json,grants.seeder.ts}`, `src/modules/auth/seeders/{users.json,admin-role.seeder.ts}` — contoh nyata

## Catatan

- `prisma/schema.prisma` tetap **auto-generated** dari base + fragmen SEMUA modul aktif (dipakai untuk `prisma generate` dan sebagai sumber koneksi `prisma db execute`) — bukan lagi acuan diff (diff kini per-modul).
- `prisma generate` sengaja dijalankan **sebelum** Prisma client di-import: di Windows, DLL query-engine yang sudah ter-load tidak bisa ditimpa (`EPERM`).
- **Migrasi bersifat driver-specific**: SQL di `migration.sql`/`down.sql` mengikuti dialek `DB_DRIVER` saat dibuat, disimpan per modul. Kalau berganti driver, hapus folder `db/migrations/` di **setiap** modul lalu jalankan `bun run migrate` dari awal — CLI memeriksa provider di snapshot terakhir tiap modul dan berhenti dengan pesan jelas bila tidak cocok.
- Untuk SQLite, `down.sql` sering berbentuk *table redefine* (buat tabel baru → salin data → rename). Ini normal dan aman.
- `bun run db:sync` sekarang hanya menyinkronkan katalog menu/permission; pakai kalau yang berubah cuma `{name}.manifest.ts`.

## Lihat Juga

- `tutorial/18-migrasi-seeder-per-module.md` — fragmen schema per modul & efek enable/disable
- `tutorial/19-manifest-menu-permission-module.md` — manifest menu & permission
- `tutorial/01-menambah-modul-baru.md` — struktur folder modul
