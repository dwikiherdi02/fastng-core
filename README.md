# FastNG

REST API boilerplate berbasis **Modular Clean Architecture** menggunakan **Fastify** + **Node.js** + **TypeScript**.  
Mendukung multiple database driver (SQLite, MySQL, PostgreSQL, MongoDB) yang dapat diganti hanya lewat environment variable.

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Runtime | Node.js >= 20 |
| Language | TypeScript 5 (strict mode, NodeNext ESM) |
| HTTP Framework | Fastify 5 |
| ORM (relational) | Prisma |
| ODM (MongoDB) | Mongoose |
| Validasi | Zod |
| Auth | JWT (`@fastify/jwt`) + bcrypt |
| API Docs | Swagger UI (`/docs`) |
| Logging | Pino (built-in Fastify) |
| Scheduling | `@fastify/schedule` + `toad-scheduler` |
| Dev build | Bun (native TS/ESM, zero-build dev server) |

---

## Prasyarat

- **Bun** >= 1.1 (package manager + dev/CLI runtime)
- **Node.js** >= 20 (dibutuhkan oleh beberapa tooling seperti Prisma CLI)
- Database sesuai driver yang dipilih:
  - SQLite — tidak perlu instalasi tambahan
  - MySQL — MySQL Server >= 8
  - PostgreSQL — PostgreSQL >= 14
  - MongoDB — MongoDB >= 6

---

## Instalasi

```bash
# 1. Clone / download project
git clone <repo-url>
cd FastNG

# 2. Install dependencies
bun install

# 3. Salin file env dan sesuaikan
cp .env.example .env
```

---

## Konfigurasi Environment

Edit file `.env`:

```env
# ── App ──────────────────────────────────────────
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

# ── Database driver ───────────────────────────────
# Pilihan: sqlite | mysql | postgresql | mongodb
DB_DRIVER=sqlite

# ── Prisma (sqlite / mysql / postgresql) ──────────
DATABASE_URL="file:./prisma/dev.db"

# ── MongoDB ───────────────────────────────────────
MONGODB_URI=mongodb://localhost:27017/FastNG

# ── Auth ──────────────────────────────────────────
JWT_SECRET=ganti_dengan_secret_panjang_dan_acak
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# ── Rate Limit ────────────────────────────────────
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute

# ── CORS ──────────────────────────────────────────
CORS_ORIGIN=*

# ── Scheduler ─────────────────────────────────────
SCHEDULER_ENABLED=true
```

### Ganti Database Driver

#### SQLite (default — tidak perlu server eksternal)
```env
DB_DRIVER=sqlite
DATABASE_URL="file:./prisma/dev.db"
```
```bash
bun run migrate    # rakit schema modul aktif + buat & jalankan migrasi
bun run db:seed    # role default + admin user
bun run dev
```

#### MySQL
```env
DB_DRIVER=mysql
DATABASE_URL="mysql://user:password@localhost:3306/FastNG"
```
```bash
bun run migrate    # schema dirakit otomatis dari prisma/base/mysql.prisma + fragmen modul
bun run db:seed
bun run dev
```

#### PostgreSQL
```env
DB_DRIVER=postgresql
DATABASE_URL="postgresql://user:password@localhost:5432/FastNG"
```
```bash
bun run migrate    # schema dirakit otomatis dari prisma/base/postgresql.prisma + fragmen modul
bun run db:seed
bun run dev
```

#### MongoDB
```env
DB_DRIVER=mongodb
MONGODB_URI=mongodb://localhost:27017/FastNG
```
```bash
# Tidak perlu migrasi — schema dikelola Mongoose
bun run dev
```

---

## Menjalankan Aplikasi

```bash
# Development (auto-restart on file change)
bun run dev

# Production (compile dulu)
bun run build
bun run start
```

Server berjalan di `http://localhost:3000`  
Swagger UI tersedia di `http://localhost:3000/docs`

---

## API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Auth

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| `POST` | `/auth/register` | — | Registrasi user baru |
| `POST` | `/auth/login` | — | Login, mendapat access + refresh token |
| `POST` | `/auth/refresh` | — | Tukar refresh token dengan token baru |
| `POST` | `/auth/logout` | Bearer | Revoke refresh token |

**Register**
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
---

  "password": "Password123"
}
```

**Login**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "Password123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "...",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2026-05-12T..."
    }
  }
}
```

**Refresh Token**
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "eyJ..." }
```

**Logout**
```http
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "refreshToken": "eyJ..." }
```

---

### Users

| Method | Endpoint | Auth | Role | Deskripsi |
|---|---|---|---|---|
| `GET` | `/users/me` | Bearer | user | Lihat profil sendiri |
| `PATCH` | `/users/me` | Bearer | user | Update profil sendiri |
| `GET` | `/users` | Bearer | admin | List semua user |
| `GET` | `/users/:id` | Bearer | admin | Detail user by ID |
| `DELETE` | `/users/:id` | Bearer | admin | Hapus user |

**Get profile**
```http
GET /api/v1/users/me
Authorization: Bearer <accessToken>
```

**Update profile**
```http
PATCH /api/v1/users/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "username": "newusername",
  "email": "newemail@example.com"
}
```

**List users (admin)**
```http
GET /api/v1/users?page=1&limit=20
Authorization: Bearer <accessToken>
```

---

### Welcome

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| `GET` | `/welcome` | Bearer | Greeting untuk user yang login |

```http
GET /api/v1/welcome
Authorization: Bearer <accessToken>
```

Response:
```json
{
  "success": true,
  "data": { "message": "Hello, johndoe!" }
}
```

---

## Response Format

Semua response menggunakan envelope yang seragam:

**Sukses**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

**Error**
```json
{
  "success": false,
  "message": "Pesan error"
}
```

---

## Struktur Project

```
src/
├── core/
│   ├── config/
│   │   └── env.config.ts          # Validasi env vars (Zod), fail-fast
│   ├── database/
│   │   ├── drivers/
│   │   │   ├── prisma.driver.ts   # PrismaClient singleton
│   │   │   └── mongoose.driver.ts # Mongoose connect/disconnect
│   │   ├── models/
│   │   │   ├── user.model.ts      # Mongoose User schema + types
│   │   │   └── refresh-token.model.ts
│   │   └── index.ts               # connectDb() / disconnectDb() by driver
│   ├── middlewares/
│   │   └── error-handler.ts       # Global error → HTTP status mapping
│   ├── plugins/
│   │   ├── db.plugin.ts           # Koneksi DB + fastify.db decorator
│   │   ├── jwt.plugin.ts          # JWT + fastify.authenticate decorator
│   │   ├── cors.plugin.ts
│   │   ├── helmet.plugin.ts
│   │   ├── rate-limit.plugin.ts
│   │   ├── swagger.plugin.ts      # OpenAPI + Swagger UI
│   │   └── schedule.plugin.ts     # Scheduled jobs via @fastify/schedule
│   └── utils/
│       ├── errors.ts              # NotFoundError, ConflictError, dll
│       └── response.ts            # successResponse / errorResponse
│
├── modules/
│   ├── auth/
│   │   ├── index.ts               # Public API modul (re-export types + classes)
│   │   ├── module.ts              # Entry point, register routes
│   │   ├── entities/              # Pure domain object
│   │   ├── dto/                   # Request/response shape + Zod schema + types
│   │   ├── repositories/          # Interface, Prisma impl, Mongo impl, factory
│   │   ├── services/              # Business logic
│   │   ├── controllers/           # Orchestrasi request/response
│   │   └── routes/                # HTTP routing
│   │   └── jobs/                  # Scheduled jobs (SimpleIntervalJob, CronJob)
│   ├── users/                     # Struktur sama seperti auth
│   └── welcome/                   # Controller + routes saja
│
├── registry/
│   ├── module.registry.ts         # Deklarasi modul: name, enabled, dependsOn
│   └── module.loader.ts           # Topological sort + dep validation
│
├── types/
│   └── fastify.d.ts               # Augmentasi FastifyInstance + FastifyJWT
├── app.ts                         # Build Fastify instance (plugins + modules)
└── server.ts                      # Entrypoint — start HTTP server

prisma/
├── base/                          # Blok datasource+generator per driver
│   ├── sqlite.prisma
│   ├── mysql.prisma
│   ├── postgresql.prisma
│   └── sqlserver.prisma
└── schema.prisma                  # AUTO-GENERATED dari base + fragmen modul aktif

# Riwayat migrasi TIDAK di prisma/migrations — tiap modul punya foldernya sendiri:
src/modules/{name}/db/
├── {name}.prisma                  # fragmen schema modul ini
└── migrations/
    └── <timestamp>_<name>/        # migration.sql + down.sql + schema.snapshot.prisma
```

---

## Menambah Modul Baru

Ikuti langkah berikut untuk membuat modul `posts` sebagai contoh:

**1. Buat folder dan file modul**
```
src/modules/posts/
├── index.ts
├── module.ts
├── entities/post.entity.ts
├── dto/create-post.request.dto.ts
├── dto/post.response.dto.ts
├── repositories/post.prisma.repository.ts
├── repositories/post.mongo.repository.ts
├── repositories/post.repository.ts
├── services/post.service.ts
├── controllers/post.controller.ts
└── routes/post.routes.ts
```

**2. Daftarkan di registry**

Edit `src/registry/module.registry.ts`:
```ts
{
  name: 'posts',
  enabled: true,
  path: '../modules/posts/module.js',
  dependsOn: ['auth', 'users'],
}
```

> **Catatan:** `path` tetap menggunakan ekstensi `.js` karena NodeNext ESM memerlukan import path eksplisit — saat dev `bun` me-resolve `.js` → `.ts` secara transparan.

**3. Tambahkan model Prisma** (jika relational)

Buat fragmen `src/modules/posts/db/posts.prisma` (hanya blok `model`), lalu:
```bash
bun run migrate -- --name=add_posts
```

Modul akan otomatis terdaftar saat server restart — tanpa mengubah `app.js`.

---

## Aturan Arsitektur

- **Jangan** import langsung dari dalam modul lain — selalu lewat `index.js`-nya
- **Jangan** taruh business logic di controller atau repository
- **Jangan** akses DB langsung dari service — delegasikan ke repository
- **Selalu** throw typed error dari service (jangan return `null` untuk not-found)
- **Selalu** ekspor public API lewat `index.js` modul
- Urutan layer: Route → Controller → Service → Repository → Entity
- **Multi-repo transaction** — gunakan `withTransaction(db, callback)` + `repository.withClient(tx)` untuk operasi multi-tabel yang harus atomik; hanya tersedia untuk Prisma driver
- **Service-in-service** — inject service lain via constructor di `module.js`; hanya boleh ke modul yang sudah ada di `dependsOn[]`; import hanya lewat `index.js` modul asal

---

## Scripts

| Script | Perintah | Deskripsi |
|---|---|---|
| `bun run dev` | `bun --env-file=.env --watch src/server.ts` | Development server (no build needed) |
| `bun run build` | `tsc` | Compile TypeScript ke `dist/` |
| `bun run start` | `bun --env-file=.env dist/server.js` | Production server (jalankan setelah build) |
| `bun run migrate` | `scripts/migrate.ts` | Rakit schema modul aktif → buat & jalankan migrasi → sinkron katalog |
| `bun run migrate:install` | `scripts/migrate.ts install` | Buat tabel repository migrasi (`_fastng_migrations`) |
| `bun run migrate:status` | `scripts/migrate.ts status` | Status tiap migrasi (Ran/Pending + batch) |
| `bun run migrate:rollback` | `scripts/migrate.ts rollback` | Batalkan batch terakhir (`-- --step=N`) |
| `bun run migrate:reset` | `scripts/migrate.ts reset` | Batalkan semua migrasi |
| `bun run migrate:refresh` | `scripts/migrate.ts refresh` | Reset lalu jalankan ulang semua (`-- --seed`) |
| `bun run migrate:fresh` | `scripts/migrate.ts fresh` | Drop semua tabel lalu jalankan ulang semua (`-- --seed`) |
| `bun run db:seed` | `scripts/db-seed.ts` | Jalankan seeder tiap modul aktif (`-- --module=` / `-- --class=`) |
| `bun run db:sync` | `scripts/db-sync.ts` | Sinkron katalog menu/permission saja |
| `bun run db:generate` | `prisma generate` | Generate Prisma Client |
| `bun run lint` | `eslint src/` | Lint kode TypeScript |
| `bun run format` | `prettier --write src/` | Format kode |
| `bun audit` | `bun audit --audit-level=high` | Cek keamanan dependency |

---

## 📚 Tutorial & Panduan

Lihat panduan lengkap di folder [`tutorial/`](tutorial/):

### Membangun Modul
- [Menambah Modul Baru](tutorial/01-menambah-modul-baru.md)
- [Mengaktifkan / Menonaktifkan Modul](tutorial/02-mengaktifkan-menonaktifkan-modul.md)

### Autentikasi & Otorisasi
- [Cara Kerja JWT & Refresh Token](tutorial/03-cara-kerja-jwt-refresh-token.md)
- [Menambah Protected Route](tutorial/04-menambah-protected-route.md)
- [Menambah Role & Authorization](tutorial/05-menambah-role-authorization.md)

### Validasi & Error Handling
- [Menambah DTO & Validasi](tutorial/06-menambah-dto-validasi.md)
- [Menambah Custom Error](tutorial/07-menambah-custom-error.md)

### Konfigurasi & Infrastruktur
- [Ganti Database Driver](tutorial/08-ganti-database-driver.md)
- [Menambah Environment Variable](tutorial/09-menambah-env-variable.md)

### Ekstensibilitas Core
- [Menambah Fungsi Middleware & Hook](tutorial/10-menambah-fungsi-middleware.md)
- [Menambah Plugin Core](tutorial/11-menambah-fungsi-plugin.md)
- [Menambah Fungsi Utils](tutorial/12-menambah-fungsi-utils.md)

### Referensi
- [Aturan Arsitektur FastNG](tutorial/13-aturan-arsitektur.md)

### Pola Lanjutan
- [Multi-Repository & DB Transaction](tutorial/14-multi-repo-db-transaction.md)
- [Service-in-Service](tutorial/15-service-in-service.md)
