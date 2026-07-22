# 18 — Migrasi & Seeder Per-Module

> **Update v4.0.0**: `bun run db:push` dan `prisma db push` **sudah tidak dipakai**. Perakitan schema kini dijalankan oleh `bun run migrate` (CLI migrasi bergaya Laravel dengan riwayat, batch, dan rollback), dan `bun run db:sync` hanya menyinkronkan katalog menu/permission. Seeder juga tidak lagi tinggal di `core/` — tiap modul memiliki `seeders/` sendiri. **Baca `tutorial/26-cli-migrasi-dan-seeder-ala-laravel.md`** untuk alur terbaru; halaman ini tetap berlaku untuk konsep *fragmen schema per modul* dan efek enable/disable.

> **Update v3.0.0**: nama tabel & kolom kini **snake_case** (Prisma `@@map`/`@map`; koleksi & field Mongo snake_case) — akses Prisma client tetap camelCase. Fragmen `db/*.prisma` kini dimiliki per modul RBAC (`permission`/`menu`/`role`/`session`), bukan lagi menumpuk di `auth` (lihat `tutorial/22`).

**Tujuan**: Menjelaskan bagaimana tabel dan data katalog sebuah modul hanya ikut termigrasi saat modul itu `enabled: true`, dan otomatis dihapus saat `enabled: false` (dua arah).

**Kapan digunakan**: Saat mengaktifkan/menonaktifkan modul, atau menambah modul baru yang punya tabel sendiri.

**Prasyarat**: File `.env` terisi (`DB_DRIVER`, `DATABASE_URL`/`MONGODB_URI`). Package manager `Bun`.

## Pengenalan

Sebelumnya schema Prisma bersifat monolitik: semua tabel selalu ada. Sekarang **tiap modul memiliki fragmen schema-nya sendiri**, dan sebuah CLI merakit `prisma/schema.prisma` hanya dari modul yang aktif — sekaligus menyimpan **riwayat migrasi milik modul itu sendiri** di `src/modules/{name}/db/migrations/`. Menonaktifkan modul → migrasinya di-*rollback* otomatis (`down.sql` dijalankan), tabelnya hilang. Ini juga berlaku untuk data katalog (menu & permission): aktif → di-*upsert*, nonaktif → dihapus.

Dua perintah utama:

- `bun run migrate` — validasi dependency → rakit schema → buat & terapkan migrasi → sinkron katalog.
- `bun run db:seed` — jalankan seeder milik tiap modul aktif (role default, admin user, dst).

## Alur/Mekanisme

```
bun run migrate
   │
   ├─ validateDependencies()  ← modul enable tapi dependency disable → error jelas
   ├─ assembleSchema()        ← prisma/base/{driver}.prisma + fragmen db/*.prisma modul AKTIF
   ├─ untuk tiap modul AKTIF ber-fragmen: diff snapshot-nya sendiri → migrasi baru (migration.sql + down.sql)
   │     tersimpan di src/modules/{modul}/db/migrations/, HANYA berisi tabel modul itu
   ├─ untuk modul yang baru DINONAKTIFKAN: down.sql migrasinya dijalankan otomatis (rollback)
   └─ syncCatalog()           ← menu/permission modul aktif di-upsert, modul nonaktif dihapus
```

Detail lengkap mekanisme diff per-modul, batch, dan rollback ada di `tutorial/26`.

Untuk **MongoDB** tidak ada langkah schema (koleksi dibuat lazy); `migrate` hanya menjalankan sinkron katalog.

## Langkah-Langkah

### Langkah 1: Beri modul sebuah fragmen schema (opsional)

Jika modul punya tabel sendiri, buat `src/modules/{name}/db/{name}.prisma` berisi **hanya** blok `model` (tanpa `datasource`/`generator`).

```prisma
// src/modules/auth/db/auth.prisma — dimuat hanya jika modul auth aktif
model User { id String @id @default(cuid()) /* ... */ }
model Session { id String @id @default(cuid()) /* ... */ }
```

**Aturan penting**: fragmen harus mandiri — jangan membuat relasi Prisma (`@relation`) ke model milik modul lain. Untuk mereferensikan tabel modul lain, pakai kolom FK skalar biasa.

### Langkah 2: Jalankan migrasi

```bash
bun run migrate
bun run db:seed
```

### Langkah 3: Aktif/nonaktifkan modul

Ubah `enabled` di `src/registry/module.registry.ts`, lalu `bun run migrate` lagi.

```ts
{ name: 'welcome', enabled: false, path: '../modules/welcome/module.js', dependsOn: ['auth'] }
```

Output menunjukkan `removed menus: dashboard` dan (jika ada fragmen) tabelnya di-drop.

## Contoh Lengkap

Perakit schema di `src/core/database/schema-builder.ts`:

```ts
export function assembleSchema(): AssembleResult {
  validateDependencies(modules)
  if (env.DB_DRIVER === 'mongodb') return { driver: 'mongodb', includedModules: [], schemaPath: null }
  const parts = [/* header */, fs.readFileSync(basePath, 'utf8').trim()]
  for (const mod of modules) {
    if (!mod.enabled) continue
    const fragmentPath = path.join(root, 'src', 'modules', mod.name, 'db', `${mod.name}.prisma`)
    if (!fs.existsSync(fragmentPath)) continue
    parts.push(`// ===== module: ${mod.name} =====`, fs.readFileSync(fragmentPath, 'utf8').trim())
  }
  fs.writeFileSync(schemaPath, parts.join('\n') + '\n')
  return { driver: env.DB_DRIVER, includedModules, schemaPath }
}
```

## Aturan/Pedoman

| ✅ Lakukan | ❌ Hindari |
|---|---|
| Jalankan `migrate` lalu `db:seed` setelah mengubah `enabled` | Mengedit `prisma/schema.prisma` manual (auto-generated) |
| Buat fragmen mandiri (FK skalar antar-modul) | `@relation` ke model modul lain di fragmen |
| Simpan blok base per-driver di `prisma/base/` | Menyimpan `datasource` di fragmen modul |

## Verifikasi

1. `bun run migrate` → tabel & menu modul aktif ada di DB.
2. Nonaktifkan sebuah modul menu → `bun run migrate` → outputnya `removed menus: ...` dan `Rolled back: {modul}/...`; baris menu hilang, dan jika modul punya fragmen, migrasinya di-rollback sehingga tabelnya hilang.
3. Aktifkan kembali → `bun run migrate && bun run db:seed` → migrasi diterapkan ulang, tabel & menu kembali.

## Catatan

- Menonaktifkan modul menghapus datanya: migrasi modul itu di-*rollback* (`down.sql` dijalankan), bukan dibuatkan migrasi `DROP TABLE` baru. File migrasinya tetap ada di disk untuk diterapkan ulang saat modul diaktifkan kembali (lihat `tutorial/26`).
- SQL Server punya batas 900-byte pada kolom terindeks; lihat `tutorial/21-menambah-driver-sqlserver.md`.

## Lihat Juga

- `tutorial/19-manifest-menu-permission-module.md`
- `tutorial/02-mengaktifkan-menonaktifkan-modul.md`
- `.claude/rules/database.md`
