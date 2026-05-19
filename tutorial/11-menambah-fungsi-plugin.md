# Menambah Plugin Core

Tutorial cara membuat dan mendaftarkan Fastify plugin baru di `src/core/plugins/`.

---

## Apa itu Plugin Fastify?

Plugin adalah cara utama Fastify untuk mengenkapsulasi fungsionalitas dan berbagi dekorator/hook ke seluruh aplikasi. Plugin yang dibungkus `fastify-plugin` (`fp`) akan **berbagi scope** dengan parent — artinya decorator yang ditambahkan di plugin tersedia di seluruh app.

**Pola dasar:**

```js
import fp from 'fastify-plugin'

async function myPlugin(fastify, opts) {
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
| `cors.plugin.js` | CORS headers via `@fastify/cors` |
| `helmet.plugin.js` | Security headers via `@fastify/helmet` |
| `rate-limit.plugin.js` | Rate limiting via `@fastify/rate-limit` |
| `swagger.plugin.js` | API docs via `@fastify/swagger` + `@fastify/swagger-ui` |
| `db.plugin.js` | Database connection, mendaftarkan `fastify.db` |
| `jwt.plugin.js` | JWT + `fastify.authenticate` decorator |

---

## Cara Membuat Plugin Baru

### Contoh 1: Plugin Email (Nodemailer)

Install dependency:

```bash
yarn add nodemailer
```

Buat file plugin:

`src/core/plugins/email.plugin.js`

```js
import fp from 'fastify-plugin'
import nodemailer from 'nodemailer'
import env from '../config/env.config.js'

async function emailPlugin(fastify) {
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

  /**
   * Kirim email
   * @param {{ to: string, subject: string, html: string }} options
   */
  async function sendEmail({ to, subject, html }) {
    return transporter.sendMail({
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

Daftarkan di `src/app.js`:

```js
import emailPlugin from './core/plugins/email.plugin.js'

// Di dalam buildApp(), setelah plugin lain:
await fastify.register(emailPlugin)
```

Gunakan di service atau controller:

```js
// Di module.js — inject fastify ke service
export default async function authModule(fastify) {
  const service = new AuthService(repository, fastify.sendEmail)
  // ...
}

// Di auth.service.js
export class AuthService {
  constructor(repository, sendEmail) {
    this.repository = repository
    this.sendEmail = sendEmail
  }

  async register(data) {
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
yarn add ioredis
```

`src/core/plugins/cache.plugin.js`

```js
import fp from 'fastify-plugin'
import Redis from 'ioredis'
import env from '../config/env.config.js'

async function cachePlugin(fastify) {
  const redis = new Redis(env.REDIS_URL)

  redis.on('error', (err) => {
    fastify.log.error({ err }, 'Redis connection error')
  })

  redis.on('connect', () => {
    fastify.log.info('Redis connected')
  })

  const cache = {
    /**
     * Ambil nilai dari cache
     * @param {string} key
     * @returns {Promise<string | null>}
     */
    async get(key) {
      return redis.get(key)
    },

    /**
     * Simpan nilai ke cache dengan TTL (detik)
     * @param {string} key
     * @param {string} value
     * @param {number} ttlSeconds
     */
    async set(key, value, ttlSeconds = 300) {
      return redis.setex(key, ttlSeconds, value)
    },

    /**
     * Hapus key dari cache
     * @param {string} key
     */
    async del(key) {
      return redis.del(key)
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

```js
// Di module.js
export default async function postsModule(fastify) {
  const service = new PostService(repository, fastify.cache)
  // ...
}

// Di post.service.js
async getPost(id) {
  const cacheKey = `post:${id}`
  const cached = await this.cache.get(cacheKey)
  if (cached) return JSON.parse(cached)

  const entity = await this.repository.findById(id)
  if (!entity) throw new NotFoundError('Post not found')

  await this.cache.set(cacheKey, JSON.stringify(entity), 60)
  return entity
}
```

---

### Contoh 3: Plugin Tanpa Dependency npm (Dekorator Custom)

Plugin sederhana untuk menambahkan utilitas ke fastify instance:

`src/core/plugins/pagination.plugin.js`

```js
import fp from 'fastify-plugin'

async function paginationPlugin(fastify) {
  /**
   * Parse query params pagination dengan nilai default
   * @param {{ page?: string, limit?: string }} query
   * @param {{ maxLimit?: number }} opts
   */
  function parsePagination(query, { maxLimit = 100 } = {}) {
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

```js
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
| Contoh | `jwt.plugin.js`, `db.plugin.js` | Plugin route-level |

---

## Checklist Membuat Plugin Baru

1. Buat file di `src/core/plugins/nama-plugin.js`
2. Import `fp` dari `fastify-plugin`
3. Buat async function `(fastify, opts)` → tambahkan logic
4. Gunakan `fastify.decorate('nama', value)` untuk expose ke app
5. Tambahkan `onClose` hook jika perlu cleanup (tutup koneksi, dll.)
6. Wrap dengan `fp(function, { name: 'nama-plugin' })`
7. Import dan `await fastify.register(plugin)` di `src/app.js`
8. Tambahkan env vars baru ke `src/core/config/env.config.js` jika diperlukan
