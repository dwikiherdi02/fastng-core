# Menambah Custom Error Type

FastNG memiliki sistem error terpusat di `src/core/utils/errors.js`. Dengan menambah subclass baru, error handler global akan otomatis menentukan HTTP status code yang tepat tanpa perubahan di tempat lain.

---

## Cara Kerja Sistem Error

```
service throw new SomeError('message')
           ↓
  errorHandler() di app.js
           ↓
  instanceof AppError? → reply dengan error.statusCode
           ↓
  response: { success: false, message: '...' }
```

Semua error adalah subclass dari `AppError` — kamu hanya perlu menambahkan class baru tanpa ubah error handler.

---

## Error yang Sudah Ada

| Class | HTTP Status | Dipakai untuk |
|---|---|---|
| `NotFoundError` | 404 | Resource tidak ditemukan |
| `ConflictError` | 409 | Data duplikat |
| `UnauthorizedError` | 401 | Token tidak valid |
| `ForbiddenError` | 403 | Tidak punya izin |
| `ValidationError` | 422 | Input tidak valid |
| `BadRequestError` | 400 | Request salah format |

---

## Cara Menambah Error Type Baru

### Langkah 1 — Tambahkan Class di `errors.ts`

Edit `src/core/utils/errors.ts` dan tambahkan di bawah error yang sudah ada:

```ts
// Error 429 — kuota habis
export class QuotaExceededError extends AppError {
  constructor(message = 'Quota exceeded') {
    super(message, 429)
  }
}

// Error 410 — resource dihapus permanen
export class GoneError extends AppError {
  constructor(message = 'Resource no longer available') {
    super(message, 410)
  }
}

// Error 503 — layanan eksternal tidak tersedia
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503)
  }
}
```

### Langkah 2 — Gunakan di Service

```ts
import { QuotaExceededError } from '../../../core/utils/errors.js'

export class PostService {
  async createPost(authorId: string, data: { title: string; content: string }): Promise<PostEntity> {
    const count = await this.repository.countByAuthor(authorId)
    if (count >= 10) {
      throw new QuotaExceededError('You have reached the maximum of 10 posts')
    }
    return this.repository.create({ ...data, authorId })
  }
}
```

### Langkah 3 — Verifikasi

Tidak perlu ubah error handler. Response otomatis:

```json
{
  "success": false,
  "message": "You have reached the maximum of 10 posts"
}
```

HTTP status `429 Too Many Requests`.

---

## Contoh: Error dengan Data Tambahan

Jika perlu menyertakan detail field yang gagal validasi:

```ts
export class ValidationError extends AppError {
  errors: { field: string; message: string }[]

  constructor(message = 'Validation failed', errors: { field: string; message: string }[] = []) {
    super(message, 422)
    this.errors = errors
  }
}
```

Update error handler di `src/core/middlewares/error-handler.ts`:

```ts
if (error instanceof AppError) {
  const body = errorResponse(error.message)
  if ('errors' in error) (body as any).errors = error.errors
  return reply.code(error.statusCode).send(body)
}
```

Penggunaan di service:

```ts
throw new ValidationError('Input tidak valid', [
  { field: 'email', message: 'Email sudah terdaftar' }
])
```

---

## Daftar HTTP Status Code Umum

| Status | Makna |
|---|---|
| 400 | Bad Request — format request salah |
| 401 | Unauthorized — belum login / token invalid |
| 403 | Forbidden — login tapi tidak punya izin |
| 404 | Not Found — data tidak ditemukan |
| 409 | Conflict — data sudah ada (duplikat) |
| 410 | Gone — data sudah dihapus permanen |
| 422 | Unprocessable Entity — input tidak lolos validasi |
| 429 | Too Many Requests — rate limit / quota habis |
| 503 | Service Unavailable — layanan down sementara |
