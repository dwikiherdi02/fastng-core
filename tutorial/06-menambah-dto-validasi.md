# Menambah DTO dan Validasi Zod

FastNG menggunakan dua skema secara bersamaan untuk setiap request/response:
- **Zod schema** — validasi runtime di controller (`safeParse`)
- **JSON Schema** — digunakan Fastify untuk serialisasi dan dokumentasi Swagger

---

## Mengapa Dua Skema?

| Aspek | Zod | JSON Schema |
|---|---|---|
| Validasi input | Ya, pesan error yang jelas | Tidak (validasi Fastify terbatas) |
| Swagger docs | Tidak bisa langsung | Ya, Fastify baca otomatis |
| Type safety | Ya (`z.infer<typeof Schema>`) | Tidak |
| Serialisasi response | Tidak | Ya, Fastify filter field tak dikenal |

---

## Struktur DTO — Satu File, Dua Export

```js
// src/modules/posts/dto/create-post.request.dto.js
import { z } from 'zod'

// Bagian 1: Zod — untuk validasi di controller
export const CreatePostSchema = z.object({
  title: z.string().min(3).max(100),
  content: z.string().min(10),
  published: z.boolean().optional().default(false)
})

// Bagian 2: JSON Schema — untuk Fastify/Swagger
export const CreatePostJsonSchema = {
  type: 'object',
  required: ['title', 'content'],
  properties: {
    title: { type: 'string', minLength: 3, maxLength: 100 },
    content: { type: 'string', minLength: 10 },
    published: { type: 'boolean', default: false }
  }
}
```

---

## Cara Membuat Request DTO

### Langkah 1 — Buat file DTO

```js
// src/modules/posts/dto/create-post.request.dto.js
import { z } from 'zod'

export const CreatePostSchema = z.object({
  title: z.string({ required_error: 'Title is required' })
    .min(3, 'Minimal 3 karakter')
    .max(100, 'Maksimal 100 karakter'),
  content: z.string({ required_error: 'Content is required' })
    .min(10, 'Minimal 10 karakter'),
  tags: z.array(z.string()).optional().default([])
})

export const CreatePostJsonSchema = {
  type: 'object',
  required: ['title', 'content'],
  properties: {
    title: { type: 'string', minLength: 3, maxLength: 100 },
    content: { type: 'string', minLength: 10 },
    tags: { type: 'array', items: { type: 'string' } }
  }
}
```

### Langkah 2 — Validasi di Controller

```js
// src/modules/posts/controllers/post.controller.js
import { CreatePostSchema } from '../dto/create-post.request.dto.js'
import { ValidationError } from '../../../core/utils/errors.js'
import { successResponse } from '../../../core/utils/response.js'

export class PostController {
  async create(request, reply) {
    // Validasi input dengan Zod
    const parsed = CreatePostSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message)
    }

    // parsed.data sudah bersih dan tervalidasi
    const result = await this.service.createPost(request.user.id, parsed.data)
    return reply.code(201).send(successResponse(result))
  }
}
```

### Langkah 3 — Daftarkan di Route

```js
// src/modules/posts/routes/post.routes.js
import { CreatePostJsonSchema } from '../dto/create-post.request.dto.js'

export async function postRoutes(fastify, controller) {
  const auth = { preHandler: [fastify.authenticate] }

  fastify.post('/posts', {
    ...auth,
    schema: {
      security: [{ bearerAuth: [] }],
      body: CreatePostJsonSchema
    }
  }, controller.create.bind(controller))
}
```

---

## Cara Membuat Response DTO

```js
// src/modules/posts/dto/post.response.dto.js

// Schema untuk satu post dalam response
export const PostResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        published: { type: 'boolean' },
        authorId: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  }
}

// Schema untuk list post dengan pagination
export const PostListResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          published: { type: 'boolean' },
          createdAt: { type: 'string' }
        }
      }
    },
    meta: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        page: { type: 'number' }
      }
    }
  }
}
```

---

## Validasi Query Parameter

```js
// src/modules/posts/dto/list-posts.query.dto.js
import { z } from 'zod'

export const ListPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  published: z.enum(['true', 'false']).optional()
})

export const ListPostsQueryJsonSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
    published: { type: 'string', enum: ['true', 'false'] }
  }
}
```

Di controller:

```js
async findAll(request, reply) {
  const parsed = ListPostsQuerySchema.safeParse(request.query)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.errors[0].message)
  }

  const { page, limit, published } = parsed.data
  const result = await this.service.findAll({ page, limit, published })
  return reply.send(successResponse(result.data, { total: result.total, page }))
}
```

---

## Validasi "Minimal Satu Field Harus Diisi" (PATCH)

Untuk update endpoint, semua field opsional tapi minimal satu harus ada:

```js
// src/modules/posts/dto/update-post.request.dto.js
import { z } from 'zod'

export const UpdatePostSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  content: z.string().min(10).optional(),
  published: z.boolean().optional()
}).refine(
  data => Object.values(data).some(v => v !== undefined),
  { message: 'At least one field must be provided' }
)

export const UpdatePostJsonSchema = {
  type: 'object',
  minProperties: 1,
  properties: {
    title: { type: 'string', minLength: 3, maxLength: 100 },
    content: { type: 'string', minLength: 10 },
    published: { type: 'boolean' }
  }
}
```

---

## Referensi Tipe Zod Umum

| Tipe | Contoh |
|---|---|
| String wajib | `z.string()` |
| String opsional | `z.string().optional()` |
| Number dari query string | `z.coerce.number()` |
| Integer positif | `z.coerce.number().int().positive()` |
| Boolean | `z.boolean()` |
| Enum | `z.enum(['active', 'inactive'])` |
| Email | `z.string().email()` |
| URL | `z.string().url()` |
| Array of string | `z.array(z.string())` |
| Default value | `.default('nilai')` |
| Min/Max panjang | `.min(3).max(100)` |
| Regex | `.regex(/^[a-z0-9-]+$/)` |
| Custom error | `z.string({ required_error: 'Wajib diisi' })` |
