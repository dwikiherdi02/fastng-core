# Menambah Middleware & Hook

Tutorial cara menambah middleware dan hook di FastNG. Fastify menggunakan **Hook** (bukan Express-style middleware), namun pola error handler tetap ada.

---

## Arsitektur Middleware Saat Ini

```
Request masuk
    │
    ▼
[onRequest Hook]     ← rate limiter, auth cek awal
    │
    ▼
[preHandler Hook]    ← autentikasi JWT (fastify.authenticate)
    │
    ▼
[Route Handler]      ← controller
    │
    ▼
[onSend Hook]        ← modifikasi response sebelum dikirim
    │
    ▼
Response keluar
    │
    ▼ (jika ada error)
[setErrorHandler]    ← src/core/middlewares/error-handler.js
```

---

## Bagian 1: Mengedit Error Handler

File error handler ada di `src/core/middlewares/error-handler.js`. Ini adalah satu-satunya error handler global.

### Cara kerja saat ini

```js
export default function errorHandler(error, request, reply) {
  // 1. JWT errors (dari @fastify/jwt)
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || error.statusCode === 401) {
    return reply.code(401).send(errorResponse('Unauthorized'))
  }

  // 2. Fastify validation error (dari JSON Schema)
  if (error.validation) {
    return reply.code(422).send(errorResponse(error.message))
  }

  // 3. Typed domain errors (AppError dan subclassnya)
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send(errorResponse(error.message))
  }

  // 4. HTTP errors dari @fastify/sensible
  if (error.statusCode && error.statusCode < 500) {
    return reply.code(error.statusCode).send(errorResponse(error.message))
  }

  // 5. Unexpected server error
  request.log.error(error)
  return reply.code(500).send(errorResponse('Internal server error'))
}
```

### Menambah penanganan error baru

Contoh: menangani error dari library `multer` (file upload):

```js
// src/core/middlewares/error-handler.js
import { AppError } from '../utils/errors.js'
import { errorResponse } from '../utils/response.js'

export default function errorHandler(error, request, reply) {
  // Tambah SEBELUM blok AppError
  if (error.code === 'LIMIT_FILE_SIZE') {
    return reply.code(413).send(errorResponse('File terlalu besar, maksimal 5MB'))
  }

  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || error.statusCode === 401) {
    return reply.code(401).send(errorResponse('Unauthorized'))
  }

  // ...sisa handler yang sudah ada...
}
```

### Menambah logging detail untuk debugging

```js
export default function errorHandler(error, request, reply) {
  // Tambah info request ke log untuk semua error
  const context = {
    method: request.method,
    url: request.url,
    userId: request.user?.sub ?? 'anonymous',
  }

  if (error instanceof AppError) {
    request.log.warn({ ...context, errorName: error.name }, error.message)
    return reply.code(error.statusCode).send(errorResponse(error.message))
  }

  request.log.error({ ...context, error }, 'Unexpected server error')
  return reply.code(500).send(errorResponse('Internal server error'))
}
```

---

## Bagian 2: Menambah Global Hook

Global hook didaftarkan di `src/app.js`, berlaku untuk **semua** route.

### onRequest Hook — Jalankan sebelum parsing body

Contoh: mencatat semua request masuk ke audit log:

```js
// src/app.js — tambahkan setelah fastify.setErrorHandler(errorHandler)

fastify.addHook('onRequest', async (request, reply) => {
  request.log.info({
    method: request.method,
    url: request.url,
    ip: request.ip,
  }, 'Incoming request')
})
```

### onSend Hook — Modifikasi response sebelum dikirim

Contoh: menambahkan header `X-Response-Time` ke setiap response:

```js
// src/app.js
fastify.addHook('onSend', async (request, reply, payload) => {
  const elapsed = Date.now() - request.startTime
  reply.header('X-Response-Time', `${elapsed}ms`)
  return payload  // wajib return payload
})

// Simpan waktu mulai di onRequest
fastify.addHook('onRequest', async (request) => {
  request.startTime = Date.now()
})
```

### onResponse Hook — Setelah response dikirim

Cocok untuk analytics, karena tidak bisa lagi modifikasi response:

```js
fastify.addHook('onResponse', async (request, reply) => {
  request.log.info({
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    responseTime: reply.elapsedTime,
  }, 'Request completed')
})
```

---

## Bagian 3: Menambah Hook di Level Modul

Hook dapat didaftarkan di dalam `module.js` — berlaku hanya untuk route modul tersebut.

Contoh: mencatat semua akses ke modul `posts`:

```js
// src/modules/posts/module.js
export default async function postsModule(fastify) {
  const repository = createPostRepository(fastify.db)
  const service = new PostService(repository)
  const controller = new PostController(service)

  fastify.register(
    async (instance) => {
      // Hook hanya berlaku dalam scope instance ini
      instance.addHook('onRequest', async (request, reply) => {
        request.log.info({ url: request.url }, 'Posts module accessed')
      })

      await postRoutes(instance, controller)
    },
    { prefix: '/api/v1/posts' }
  )
}
```

---

## Bagian 4: Membuat File Middleware Terpisah

Untuk hook yang kompleks, buat file terpisah di `src/core/middlewares/`:

`src/core/middlewares/request-id.js`

```js
import { randomUUID } from 'crypto'

/**
 * Tambahkan X-Request-ID ke setiap request dan response.
 * Daftarkan di app.js dengan: fastify.addHook('onRequest', requestIdMiddleware)
 */
export async function requestIdMiddleware(request, reply) {
  const id = request.headers['x-request-id'] ?? randomUUID()
  request.requestId = id
  reply.header('X-Request-Id', id)
}
```

Daftarkan di `src/app.js`:

```js
import { requestIdMiddleware } from './core/middlewares/request-id.js'

// Di dalam buildApp():
fastify.addHook('onRequest', requestIdMiddleware)
```

---

## Tabel Jenis Hook Fastify

| Hook | Kapan Dijalankan | Bisa Kirim Reply? | Use Case |
|------|-----------------|-------------------|----------|
| `onRequest` | Paling awal, sebelum parsing | Ya | Rate limit, request ID |
| `preParsing` | Sebelum parse body | Ya | Dekompresi custom |
| `preValidation` | Sebelum validasi schema | Ya | Transformasi body |
| `preHandler` | Sebelum handler route | Ya | Autentikasi, otorisasi |
| `preSerialization` | Sebelum serialisasi | Tidak | Transformasi payload |
| `onSend` | Sebelum kirim | Dapat ubah payload | Header tambahan |
| `onResponse` | Setelah kirim | Tidak | Analytics, logging |
| `onError` | Saat error (sebelum errorHandler) | Ya | Pre-processing error |

---

## Catatan Penting

- Hook `onRequest` s/d `preHandler` dapat menghentikan request dengan memanggil `reply.send()` atau `throw error`
- Hook `onSend` **harus** mengembalikan `payload` (meskipun tidak diubah)
- Hook di level modul (dalam `fastify.register`) hanya berlaku untuk route dalam scope tersebut
- Gunakan `fastify.addHook` di `app.js` untuk hook global
