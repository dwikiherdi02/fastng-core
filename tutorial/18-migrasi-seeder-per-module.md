# 18 — Migrasi & Seeder Per-Module

> **Update v3.0.0**: nama tabel & kolom kini **snake_case** (Prisma `@@map`/`@map`; koleksi & field Mongo snake_case) — akses Prisma client tetap camelCase. Fragmen `db/*.prisma` kini dimiliki per modul RBAC (`permission`/`menu`/`role`/`session`), bukan lagi menumpuk di `auth` (lihat `tutorial/22`).

**Tujuan**: Menjelaskan bagaimana tabel dan data katalog sebuah modul hanya ikut termigrasi saat modul itu `enabled: true`, dan otomatis dihapus saat `enabled: false` (dua arah).

**Kapan digunakan**: Saat mengaktifkan/menonaktifkan modul, atau menambah modul baru yang punya tabel sendiri.

**Prasyarat**: File `.env` terisi (`DB_DRIVER`, `DATABASE_URL`/`MONGODB_URI`). Package manager `yarn`.

## Pengenalan

Sebelumnya schema Prisma bersifat monolitik: semua tabel selalu ada. Sekarang **tiap modul memiliki fragmen schema-nya sendiri**, dan sebuah CLI merakit `prisma/schema.prisma` hanya dari modul yang aktif. Menonaktifkan modul → tabelnya di-*drop*. Ini juga berlaku untuk data katalog (menu & permission): aktif → di-*upsert*, nonaktif → dihapus.

Dua perintah utama:

- `yarn db:sync` — validasi dependency → rakit schema → `prisma db push` → sinkron katalog.
- `yarn db:seed` — buat role default (`admin`/`user`) + admin user.

## Alur/Mekanisme

```
yarn db:sync
   │
   ├─ validateDependencies()           ← modul enable tapi dependency disable → error jelas
   ├─ assembleSchema()                 ← prisma/base/{driver}.prisma + fragmen db/*.prisma modul AKTIF
   ├─ prisma db push --accept-data-loss ← DB dibuat sama dengan schema → tabel modul nonaktif DI-DROP
   └─ syncCatalog()                    ← menu/permission modul aktif di-upsert, modul nonaktif dihapus
```

Untuk **MongoDB** tidak ada langkah schema (koleksi dibuat lazy); `db:sync` hanya menjalankan sinkron katalog.

## Langkah-Langkah

### Langkah 1: Beri modul sebuah fragmen schema (opsional)

Jika modul punya tabel sendiri, buat `src/modules/{name}/db/{name}.prisma` berisi **hanya** blok `model` (tanpa `datasource`/`generator`).

```prisma
// src/modules/auth/db/auth.prisma — dimuat hanya jika modul auth aktif
model User { id String @id @default(cuid()) /* ... */ }
model Session { id String @id @default(cuid()) /* ... */ }
```

**Aturan penting**: fragmen harus mandiri — jangan membuat relasi Prisma (`@relation`) ke model milik modul lain. Untuk mereferensikan tabel modul lain, pakai kolom FK skalar biasa.

### Langkah 2: Jalankan sinkronisasi

```bash
yarn db:sync
yarn db:seed
```

### Langkah 3: Aktif/nonaktifkan modul

Ubah `enabled` di `src/registry/module.registry.ts`, lalu `yarn db:sync` lagi.

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
| Jalankan `db:sync` lalu `db:seed` setelah mengubah `enabled` | Mengedit `prisma/schema.prisma` manual (auto-generated) |
| Buat fragmen mandiri (FK skalar antar-modul) | `@relation` ke model modul lain di fragmen |
| Simpan blok base per-driver di `prisma/base/` | Menyimpan `datasource` di fragmen modul |

## Verifikasi

1. `yarn db:sync` → tabel & menu modul aktif ada di DB.
2. Nonaktifkan sebuah modul menu → `yarn db:sync` → outputnya `removed menus: ...`; baris menu hilang; jika modul punya fragmen, tabelnya juga hilang.
3. Aktifkan kembali → `yarn db:sync && yarn db:seed` → tabel & menu kembali.

## Catatan

- `--accept-data-loss` memang disengaja: menonaktifkan modul menghapus datanya. Untuk produksi, pertimbangkan backup atau gunakan `prisma migrate` bila butuh histori.
- SQL Server punya batas 900-byte pada kolom terindeks; lihat `tutorial/21-menambah-driver-sqlserver.md`.

## Lihat Juga

- `tutorial/19-manifest-menu-permission-module.md`
- `tutorial/02-mengaktifkan-menonaktifkan-modul.md`
- `.claude/rules/database.md`
