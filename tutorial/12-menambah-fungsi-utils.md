# Menambah Fungsi Utils

Tutorial cara memperluas utilitas di `src/core/utils/`. Ada dua file utama: `errors.js` (error types) dan `response.js` (format response). Kamu juga bisa menambahkan file utils baru.

---

## File Utils yang Ada

| File | Isi |
|------|-----|
| `src/core/utils/errors.js` | `AppError` + subclass: `NotFoundError`, `ConflictError`, dll. |
| `src/core/utils/response.js` | `successResponse()` dan `errorResponse()` |

---

## Bagian 1: Menambah Error Type Baru di `errors.js`

Error types digunakan untuk komunikasi antar lapisan tanpa membocorkan detail HTTP ke service layer.

### Error yang sudah ada

```js
// AppError (base)
// NotFoundError     → 404
// ConflictError     → 409
// UnauthorizedError → 401
// ForbiddenError    → 403
// ValidationError   → 422
// BadRequestError   → 400
```

### Cara menambah error baru

Tambahkan class di akhir `src/core/utils/errors.js`:

```ts
export class QuotaExceededError extends AppError {
  constructor(message = 'Quota exceeded') {
    super(message, 429)
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503)
  }
}

export class GoneError extends AppError {
  constructor(message = 'Resource is no longer available') {
    super(message, 410)
  }
}
```

### Error dengan data tambahan

Untuk error yang perlu membawa data ekstra (misalnya daftar field yang gagal validasi):

```ts
export class UnprocessableError extends AppError {
  errors: { field: string; message: string }[]

  constructor(message = 'Unprocessable entity', errors: { field: string; message: string }[] = []) {
    super(message, 422)
    this.errors = errors
  }
}
```

Update `error-handler.js` untuk menangani field errors:

```ts
// src/core/middlewares/error-handler.ts
import { AppError, UnprocessableError } from '../utils/errors.js'
import { errorResponse } from '../utils/response.js'
import type { FastifyRequest, FastifyReply } from 'fastify'

export default function errorHandler(error: any, request: FastifyRequest, reply: FastifyReply): void {
  // Tambahkan sebelum blok AppError umum
  if (error instanceof UnprocessableError) {
    return reply.code(422).send({
      success: false,
      message: error.message,
      errors: error.errors,
    })
  }

  if (error instanceof AppError) {
    return reply.code(error.statusCode).send(errorResponse(error.message))
  }
  // ...
}
```

Gunakan di service:

```ts
import { UnprocessableError } from '../../../core/utils/errors.js'

async createPost(authorId: string, data: { title: string; content: string }): Promise<PostEntity> {
  const errors: { field: string; message: string }[] = []
  if (data.title.length < 3) errors.push({ field: 'title', message: 'Minimal 3 karakter' })
  if (data.content.length < 10) errors.push({ field: 'content', message: 'Minimal 10 karakter' })
  if (errors.length > 0) throw new UnprocessableError('Validasi gagal', errors)

  return this.repository.create({ ...data, authorId })
}
```

---

## Bagian 2: Menambah Helper di `response.js`

### Format response saat ini

```js
// successResponse({ id: 1, name: 'John' })
// → { success: true, data: { id: 1, name: 'John' } }

// successResponse(items, { total: 100, page: 1, limit: 20 })
// → { success: true, data: [...], meta: { total: 100, page: 1, limit: 20 } }

// errorResponse('Not found')
// → { success: false, message: 'Not found' }
```

### Menambah helper paginasi

Tambahkan ke `src/core/utils/response.js`:

```ts
export function paginationMeta({ total, page, limit }: { total: number; page: number; limit: number }) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  }
}
```

Gunakan di controller:

```ts
import { successResponse, paginationMeta } from '../../../core/utils/response.js'
import type { FastifyRequest, FastifyReply } from 'fastify'

async listPosts(request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply): Promise<void> {
  const page = parseInt(request.query.page ?? '1')
  const limit = parseInt(request.query.limit ?? '20')
  const { items, total } = await this.service.listPosts({ page, limit })

  return reply.send(
    successResponse(items.map(toPostResponse), paginationMeta({ total, page, limit }))
  )
}
```

Output response:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 150,
    "page": 2,
    "limit": 20,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

---

## Bagian 3: Membuat File Utils Baru

Untuk utilitas yang tidak berkaitan dengan error atau response, buat file terpisah.

### Contoh: `src/core/utils/slugify.ts`

```ts
/**
 * Konversi string ke URL slug.
 * Contoh: "Hello World!" → "hello-world"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

### Contoh: `src/core/utils/date.ts`

```ts
/**
 * Format tanggal ke string Indonesia.
 */
export function formatDateIndo(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * Cek apakah tanggal sudah lewat.
 */
export function isExpired(date: Date): boolean {
  return new Date() > new Date(date)
}
```

Import dan gunakan:

```ts
import { slugify } from '../../../core/utils/slugify.js'
import { isExpired } from '../../../core/utils/date.js'

async createPost(authorId: string, data: { title: string; content: string }): Promise<PostEntity> {
  return this.repository.create({
    ...data,
    slug: slugify(data.title),
    authorId,
  })
}
```

---

## Aturan Menulis Utils

1. **Pure functions** — tidak bergantung pada Fastify, ORM, atau state global
2. **Satu file, satu tanggung jawab** — `slugify.js` hanya untuk slug, jangan campur
3. **Export named** — gunakan `export function` bukan `export default`, agar mudah di-import selektif
4. **Tidak perlu class** — utils adalah fungsi biasa, bukan class (kecuali ada alasan kuat)
5. **Tidak melempar HTTP error** — utils hanya mengolah data; error handling ada di service/controller

---

## Ringkasan File Utils

```
src/core/utils/
├── errors.ts     ← Tambah subclass AppError baru di sini
├── response.ts   ← Tambah helper format response di sini
├── slugify.ts    ← Contoh utils custom (buat file baru jika topik berbeda)
└── date.ts       ← Contoh utils tanggal
```
