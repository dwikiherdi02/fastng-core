# 21 — Menambah / Memakai Driver SQL Server

**Tujuan**: Menjelaskan cara menjalankan FastNG dengan Microsoft SQL Server sebagai database (via Prisma).

**Kapan digunakan**: Saat target deployment memakai SQL Server 2017+.

**Prasyarat**: Instance SQL Server yang bisa diakses; `.env` dapat diedit.

## Pengenalan

FastNG mendukung lima driver: `sqlite` (default), `mysql`, `postgresql`, `sqlserver`, dan `mongodb`. Empat pertama memakai Prisma; `sqlserver` ditambahkan pada v2.0.0. Karena schema Prisma sekarang dirakit dari blok base per-driver + fragmen modul, mengganti driver cukup mengubah `DB_DRIVER` dan `DATABASE_URL` lalu `yarn db:sync`.

## Alur/Mekanisme

```
DB_DRIVER=sqlserver → schema-builder memakai prisma/base/sqlserver.prisma
                    → provider = "sqlserver" + fragmen modul aktif
                    → prisma db push
```

## Langkah-Langkah

### Langkah 1: Set `.env`

```env
DB_DRIVER=sqlserver
DATABASE_URL="sqlserver://localhost:1433;database=FastNG;user=sa;password=Your_password123;encrypt=true;trustServerCertificate=true"
```

### Langkah 2: Sinkron & seed

```bash
yarn db:sync
yarn db:seed
```

`db:sync` merakit `prisma/schema.prisma` dengan `provider = "sqlserver"` (dari `prisma/base/sqlserver.prisma`), lalu `prisma db push`.

### Langkah 3: Jalankan

```bash
yarn dev
```

## Contoh Lengkap

Blok base `prisma/base/sqlserver.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

`DB_DRIVER` divalidasi di `src/core/config/env.config.ts` (enum kini mencakup `sqlserver`, dan `sqlserver` termasuk driver yang mewajibkan `DATABASE_URL`).

## Aturan/Pedoman

| ✅ Lakukan | ❌ Hindari |
|---|---|
| `encrypt=true;trustServerCertificate=true` untuk dev lokal | Membiarkan koneksi tanpa enkripsi di produksi |
| `yarn db:sync` setelah ganti driver | Menyalin schema lama secara manual |

## Verifikasi

1. `yarn db:sync` selesai tanpa error dan tabel terbentuk di SQL Server.
2. `yarn db:seed` membuat role & admin user.
3. `POST /api/v1/auth/login` dengan admin berhasil.

## Catatan

- **Batas index 900-byte**: SQL Server membatasi panjang kolom terindeks. Prisma memetakan `String` ke `NVarChar(1000)` secara default, sehingga kolom `@unique`/`@@index` yang sangat panjang mungkin perlu `@db.NVarChar(n)` eksplisit di fragmen saat menargetkan SQL Server produksi. Kolom pada boilerplate (username, email, code, hash) aman karena pendek.
- Fragmen modul dijaga netral-provider (tanpa atribut native khusus) agar tetap valid untuk semua driver.

## Lihat Juga

- `tutorial/08-ganti-database-driver.md`
- `tutorial/18-migrasi-seeder-per-module.md`
- `.claude/rules/database.md`
