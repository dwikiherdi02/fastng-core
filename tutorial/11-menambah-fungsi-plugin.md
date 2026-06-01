# Menambah Plugin Core

Tutorial cara membuat dan mendaftarkan Fastify plugin baru di `src/core/plugins/`.

---

## Apa itu Plugin Fastify?

Plugin adalah cara utama Fastify untuk mengenkapsulasi fungsionalitas dan berbagi dekorator/hook ke seluruh aplikasi. Plugin yang dibungkus `fastify-plugin` (`fp`) akan **berbagi scope** dengan parent — artinya decorator yang ditambahkan di plugin tersedia di seluruh app.

**Pola dasar:**

```ts
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'

async function myPlugin(fastify: FastifyInstance, opts: Record<string, unknown>): Promise<void> {
  // Tambah decorator, hook, atau register plugin npm
  fastify.decorate('myFeature', someValue)
}

export default fp(myPlugin, { name: 'my-plugin' })
```

Tanpa `fp()`, plugin akan ter-encapsulate dan decorator-nya tidak terlihat di luar scope plugin tersebut.

---

## Plugin yang Sudah Ada

| File | Fungsi |
|------|--------|
| `cors.plugin.ts` | CORS headers via `@fastify/cors` |
| `helmet.plugin.ts` | Security headers via `@fastify/helmet` |
| `rate-limit.plugin.ts` | Rate limiting via `@fastify/rate-limit` |
| `swagger.plugin.ts` | API docs via `@fastify/swagger` + `@fastify/swagger-ui` |
| `db.plugin.ts` | Database connection, mendaftarkan `fastify.db` |
| `jwt.plugin.ts` | JWT + `fastify.authenticate` decorator |

---

## Cara Membuat Plugin Baru

### Contoh 1: Plugin Email (Nodemailer)

Install dependency:

```bash
npm install nodemailer
```

Buat file plugin:

`src/core/plugins/email.plugin.ts`

```ts
import fp from 'fastify-plugin'
import nodemailer from 'nodemailer'
import env from '../config/env.config.js'
import type { FastifyInstance } from 'fastify'

async function emailPlugin(fastify: FastifyInstance): Promise<void> {
  const transporter = nodemailer.createTransporter({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  })

  // Verifikasi koneksi saat startup
  await transporter.verify()
  fastify.log.info('Email transporter connected')

  async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
    await transporter.sendMail({
      from: `"FastNG" <${env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
  }

  // Daftarkan sebagai decorator agar tersedia di seluruh app
  fastify.decorate('sendEmail', sendEmail)
}

export default fp(emailPlugin, { name: 'email-plugin' })
```

Daftarkan di `src/app.ts`:

```ts
import emailPlugin from './core/plugins/email.plugin.js'

// Di dalam buildApp(), setelah plugin lain:
await fastify.register(emailPlugin)
```

Gunakan di service atau controller:

```ts
// Di module.ts — inject fastify ke service
export default async function authModule(fastify: any): Promise<void> {
  const service = new AuthService(repository, fastify.sendEmail)
  // ...
}

// Di auth.service.ts
export class AuthService {
  constructor(
    private repository: any,
    private sendEmail: (opts: { to: string; subject: string; html: string }) => Promise<void>
  ) {}

  async register(data: any): Promise<any> {
    const user = await this.repository.create(data)
    // Kirim welcome email
    await this.sendEmail({
      to: user.email,
      subject: 'Selamat datang!',
      html: `<p>Halo ${user.username}, akun Anda berhasil dibuat.</p>`,
    })
    return user
  }
}
```

---

### Contoh 2: Plugin Redis Cache

Install dependency:

```bash
npm install ioredis
```

`src/core/plugins/cache.plugin.ts`

```ts
import fp from 'fastify-plugin'
import Redis from 'ioredis'
import env from '../config/env.config.js'
import type { FastifyInstance } from 'fastify'

async function cachePlugin(fastify: FastifyInstance): Promise<void> {
  const redis = new Redis(env.REDIS_URL)

  redis.on('error', (err) => {
    fastify.log.error({ err }, 'Redis connection error')
  })

  redis.on('connect', () => {
    fastify.log.info('Redis connected')
  })

  const cache = {
    async get(key: string): Promise<string | null> {
      return redis.get(key)
    },

    async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
      await redis.setex(key, ttlSeconds, value)
    },

    async del(key: string): Promise<void> {
      await redis.del(key)
    },
  }

  fastify.decorate('cache', cache)

  // Tutup koneksi saat app shutdown
  fastify.addHook('onClose', async () => {
    await redis.quit()
    fastify.log.info('Redis connection closed')
  })
}

export default fp(cachePlugin, { name: 'cache-plugin' })
```

Gunakan di controller atau service:

```ts
// Di module.ts
export default async function postsModule(fastify: any): Promise<void> {
  const service = new PostService(repository, fastify.cache)
  // ...
}

// Di post.service.ts
async getPost(id: string): Promise<PostEntity> {
  const cacheKey = `post:${id}`
  const cached = await this.cache.get(cacheKey)
  if (cached) return JSON.parse(cached) as PostEntity

  const entity = await this.repository.findById(id)
  if (!entity) throw new NotFoundError('Post not found')

  await this.cache.set(cacheKey, JSON.stringify(entity), 60)
  return entity
}
```

---

### Contoh 3: Plugin Tanpa Dependency npm (Dekorator Custom)

Plugin sederhana untuk menambahkan utilitas ke fastify instance:

`src/core/plugins/pagination.plugin.ts`

```ts
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'

async function paginationPlugin(fastify: FastifyInstance): Promise<void> {
  function parsePagination(
    query: { page?: string; limit?: string },
    { maxLimit = 100 } = {}
  ): { page: number; limit: number; skip: number } {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))
    return { page, limit, skip: (page - 1) * limit }
  }

  fastify.decorate('parsePagination', parsePagination)
}

export default fp(paginationPlugin, { name: 'pagination-plugin' })
```

---

## Urutan Registrasi Plugin

Urutan di `src/app.js` penting karena beberapa plugin bergantung pada plugin lain:

```ts
// Urutan yang benar:
await fastify.register(swaggerPlugin)   // 1. Docs (tidak bergantung apapun)
await fastify.register(helmetPlugin)    // 2. Security headers
await fastify.register(corsPlugin)      // 3. CORS
await fastify.register(rateLimitPlugin) // 4. Rate limit
await fastify.register(dbPlugin)        // 5. Database (fastify.db tersedia setelah ini)
await fastify.register(jwtPlugin)       // 6. JWT (fastify.authenticate tersedia setelah ini)
await fastify.register(emailPlugin)     // 7. Plugin tambahan
await fastify.register(cachePlugin)     // 8. Plugin tambahan
```

**Aturan:** Plugin yang menggunakan `fastify.db` harus didaftarkan setelah `dbPlugin`.

---

## Perbedaan Plugin dengan dan tanpa `fp()`

| | Dengan `fp()` | Tanpa `fp()` |
|--|--------------|-------------|
| Scope decorator | Global (tersedia di parent) | Lokal (hanya dalam plugin) |
| Penggunaan | Core plugins yang perlu diakses semua module | Plugin enkapsulasi fitur tertentu |
| Contoh | `jwt.plugin.ts`, `db.plugin.ts` | Plugin route-level |

---

## Checklist Membuat Plugin Baru

1. Buat file di `src/core/plugins/nama-plugin.ts`
2. Import `fp` dari `fastify-plugin`
3. Buat async function `(fastify, opts)` → tambahkan logic
4. Gunakan `fastify.decorate('nama', value)` untuk expose ke app
5. Tambahkan `onClose` hook jika perlu cleanup (tutup koneksi, dll.)
6. Wrap dengan `fp(function, { name: 'nama-plugin' })`
7. Import dan `await fastify.register(plugin)` di `src/app.js`
8. Tambahkan env vars baru ke `src/core/config/env.config.js` jika diperlukan
