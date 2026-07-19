# Mengganti Database Driver

FastNG mendukung 4 database: **SQLite** (default), **MySQL**, **PostgreSQL**, dan **MongoDB**. Penggantian dilakukan via environment variable `DB_DRIVER`.

---

## Driver yang Tersedia

| `DB_DRIVER` | Database | ORM/Driver |
|---|---|---|
| `sqlite` | SQLite (file lokal) | Prisma |
| `mysql` | MySQL / MariaDB | Prisma |
| `postgresql` | PostgreSQL | Prisma |
| `mongodb` | MongoDB | Mongoose |

---

## SQLite (default)

SQLite sudah dikonfigurasi secara default. Tidak perlu setup tambahan — database tersimpan sebagai file `dev.db`.

**`.env`:**
```
DB_DRIVER=sqlite
DATABASE_URL=file:./dev.db
```

**Jalankan:**
```bash
npm run db:push
npm run dev
```

Log konfirmasi: `[DB] Connected to SQLite`

---

## MySQL

### Langkah 1 — Copy schema MySQL

```powershell
Copy-Item prisma\schema.mysql.prisma prisma\schema.prisma -Force
```

### Langkah 2 — Update `.env`

```
DB_DRIVER=mysql
DATABASE_URL=mysql://user:password@localhost:3306/FastNG_db
```

Ganti `user`, `password`, dan `FastNG_db` sesuai konfigurasi MySQL kamu.

### Langkah 3 — Generate Prisma Client dan push schema

```bash
npm run db:generate
npm run db:push
```

### Langkah 4 — Jalankan server

```bash
npm run dev
```

Log konfirmasi: `[DB] Connected to MySQL`

---

## PostgreSQL

### Langkah 1 — Copy schema PostgreSQL

```powershell
Copy-Item prisma\schema.postgresql.prisma prisma\schema.prisma -Force
```

### Langkah 2 — Update `.env`

```
DB_DRIVER=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/FastNG_db
```

### Langkah 3 — Generate dan push

```bash
npm run db:generate
npm run db:push
```

Log konfirmasi: `[DB] Connected to PostgreSQL`

---

## MongoDB

### Langkah 1 — Update `.env`

```
DB_DRIVER=mongodb
MONGODB_URI=mongodb://localhost:27017/FastNG_db
```

Untuk MongoDB Atlas:
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/FastNG_db
```

### Langkah 2 — Jalankan server

```bash
npm run dev
```

Tidak perlu `npm run db:push` — Mongoose membuat collection otomatis saat data pertama dimasukkan.

Log konfirmasi: `[DB] Connected to MongoDB`

> **Penting:** Saat menggunakan MongoDB, `fastify.db` bernilai `null`. Koneksi database diakses via model Mongoose (`UserModel`, `RefreshTokenModel`) di dalam repository.

---

## Cara Kerja Factory Pattern di Repository

Setiap modul memiliki dua repository yang dipilih otomatis berdasarkan `DB_DRIVER`:

```ts
// src/modules/users/repositories/user.repository.ts
import { UserPrismaRepository } from './user.prisma.repository.js'
import { UserMongoRepository } from './user.mongo.repository.js'
import type { FastifyInstance } from 'fastify'

export function createUserRepository(fastify: FastifyInstance): UserPrismaRepository | UserMongoRepository {
  if (fastify.config.DB_DRIVER === 'mongodb') {
    return new UserMongoRepository()
  }
  return new UserPrismaRepository(fastify.db)
}
```

Factory ini dipanggil di `module.js` saat modul di-register. Kamu tidak perlu mengubah apapun di service atau controller saat ganti driver.

---

## `db:push` vs `db:migrate`

| Perintah | Kapan digunakan |
|---|---|
| `npm run db:push` | Development — langsung apply tanpa history migrasi |
| `npm run db:migrate` | Production — buat file migrasi SQL, ada history rollback |
| `npm run db:studio` | Buka GUI database browser di browser |

Untuk development awal, selalu gunakan `db:push`. Untuk production, gunakan `db:migrate` agar ada trail perubahan schema.

---

## Perhatian saat Ganti Driver

- **Data tidak ikut pindah** — ganti driver berarti mulai dengan database kosong
- Pastikan service database (MySQL/PostgreSQL/MongoDB) sudah running sebelum `bun run dev`
- `DATABASE_URL` wajib diisi untuk semua Prisma driver (sqlite, mysql, postgresql)
- `MONGODB_URI` wajib untuk MongoDB
- Setelah ganti schema Prisma, selalu jalankan `npm run db:generate` sebelum `npm run dev`
