# FastNG

REST API boilerplate berbasis **Modular Clean Architecture** menggunakan **Fastify** + **Node.js**.  
Mendukung multiple database driver (SQLite, MySQL, PostgreSQL, MongoDB) yang dapat diganti hanya lewat environment variable.

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Runtime | Node.js >= 20 |
| HTTP Framework | Fastify 5 |
| ORM (relational) | Prisma |
| ODM (MongoDB) | Mongoose |
| Validasi | Zod |
| Auth | JWT (`@fastify/jwt`) + bcrypt |
| API Docs | Swagger UI (`/docs`) |
| Logging | Pino (built-in Fastify) |

---

## Prasyarat

- **Node.js** >= 20
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
yarn install

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
```

### Ganti Database Driver

#### SQLite (default — tidak perlu server eksternal)
```env
DB_DRIVER=sqlite
DATABASE_URL="file:./prisma/dev.db"
```
```bash
yarn db:push   # buat tabel
yarn dev
```

#### MySQL
```env
DB_DRIVER=mysql
DATABASE_URL="mysql://user:password@localhost:3306/FastNG"
```
```bash
# Salin schema MySQL ke schema utama
cp prisma/schema.mysql.prisma prisma/schema.prisma
yarn db:migrate
yarn dev
```

#### PostgreSQL
```env
DB_DRIVER=postgresql
DATABASE_URL="postgresql://user:password@localhost:5432/FastNG"
```
```bash
cp prisma/schema.postgresql.prisma prisma/schema.prisma
yarn db:migrate
yarn dev
```

#### MongoDB
```env
DB_DRIVER=mongodb
MONGODB_URI=mongodb://localhost:27017/FastNG
```
```bash
# Tidak perlu migrasi — schema dikelola Mongoose
yarn dev
```

---

## Menjalankan Aplikasi

```bash
# Development (auto-restart on file change)
yarn dev

# Production
yarn start
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
│   │   └── env.config.js          # Validasi env vars (Zod), fail-fast
│   ├── database/
│   │   ├── drivers/
│   │   │   ├── prisma.driver.js   # PrismaClient singleton
│   │   │   └── mongoose.driver.js # Mongoose connect/disconnect
│   │   ├── models/
│   │   │   ├── user.model.js      # Mongoose User schema
│   │   │   └── refresh-token.model.js
│   │   └── index.js               # connectDb() / disconnectDb() by driver
│   ├── middlewares/
│   │   └── error-handler.js       # Global error → HTTP status mapping
│   ├── plugins/
│   │   ├── db.plugin.js           # Koneksi DB + fastify.db decorator
│   │   ├── jwt.plugin.js          # JWT + fastify.authenticate decorator
│   │   ├── cors.plugin.js
│   │   ├── helmet.plugin.js
│   │   ├── rate-limit.plugin.js
│   │   └── swagger.plugin.js      # OpenAPI + Swagger UI
│   └── utils/
│       ├── errors.js              # NotFoundError, ConflictError, dll
│       └── response.js            # successResponse / errorResponse
│
├── modules/
│   ├── auth/
│   │   ├── index.js               # Public API modul
│   │   ├── module.js              # Entry point, register routes
│   │   ├── entities/              # Pure domain object
│   │   ├── dto/                   # Request/response shape + Zod schema
│   │   ├── repositories/          # Prisma impl, Mongo impl, factory
│   │   ├── services/              # Business logic
│   │   ├── controllers/           # Orchestrasi request/response
│   │   └── routes/                # HTTP routing
│   ├── users/                     # Struktur sama seperti auth
│   └── welcome/                   # Controller + routes saja
│
├── registry/
│   ├── module.registry.js         # Deklarasi modul: name, enabled, dependsOn
│   └── module.loader.js           # Topological sort + dep validation
│
├── app.js                         # Build Fastify instance (plugins + modules)
└── server.js                      # Entrypoint — start HTTP server

prisma/
├── schema.prisma                  # Schema aktif (default: SQLite)
├── schema.mysql.prisma            # Referensi MySQL
└── schema.postgresql.prisma       # Referensi PostgreSQL
```

---

## Menambah Modul Baru

Ikuti langkah berikut untuk membuat modul `posts` sebagai contoh:

**1. Buat folder dan file modul**
```
src/modules/posts/
├── index.js
├── module.js
├── entities/post.entity.js
├── dto/create-post.request.dto.js
├── dto/post.response.dto.js
├── repositories/post.prisma.repository.js
├── repositories/post.mongo.repository.js
├── repositories/post.repository.js
├── services/post.service.js
├── controllers/post.controller.js
└── routes/post.routes.js
```

**2. Daftarkan di registry**

Edit `src/registry/module.registry.js`:
```js
{
  name: 'posts',
  enabled: true,
  path: '../modules/posts/module.js',
  dependsOn: ['auth', 'users'],
}
```

**3. Tambahkan model Prisma** (jika relational)

Edit `prisma/schema.prisma`, lalu:
```bash
yarn db:migrate
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
| `yarn dev` | `node --env-file=.env --watch src/server.js` | Development server |
| `yarn start` | `node --env-file=.env src/server.js` | Production server |
| `yarn db:generate` | `prisma generate` | Generate Prisma Client |
| `yarn db:migrate` | `prisma migrate dev` | Buat + jalankan migrasi |
| `yarn db:push` | `prisma db push` | Push schema tanpa migrasi (dev) |
| `yarn lint` | `eslint src/` | Lint kode |
| `yarn format` | `prettier --write src/` | Format kode |

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
