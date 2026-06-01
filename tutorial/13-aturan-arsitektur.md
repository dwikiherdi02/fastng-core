# Aturan Arsitektur FastNG

Referensi aturan per lapisan untuk menjaga konsistensi dan keberlanjutan codebase.

---

## Gambaran Lapisan

```
┌─────────────────────────────────────────────────┐
│                   HTTP Layer                    │
│  Route Handler (routes/*.routes.ts)             │
│  → Definisi endpoint, schema Swagger, preHandler│
└──────────────────┬──────────────────────────────┘
                   │ memanggil
┌──────────────────▼──────────────────────────────┐
│              Controller Layer                   │
│  (controllers/*.controller.ts)                  │
│  → Parse & validasi input, format output        │
└──────────────────┬──────────────────────────────┘
                   │ memanggil
┌──────────────────▼──────────────────────────────┐
│               Service Layer                     │
│  (services/*.service.ts)                        │
│  → Business logic, orchestrasi, throw errors    │
└──────────────────┬──────────────────────────────┘
                   │ memanggil
┌──────────────────▼──────────────────────────────┐
│             Repository Layer                    │
│  (repositories/*.repository.ts)                 │
│  → Akses database, query, return Entity         │
└──────────────────┬──────────────────────────────┘
                   │ menggunakan
┌──────────────────▼──────────────────────────────┐
│               Entity Layer                      │
│  (entities/*.entity.ts)                         │
│  → Pure domain object, tidak tergantung ORM     │
└─────────────────────────────────────────────────┘
```

---

## Aturan per Lapisan

### Entity (`entities/`)

| ✅ Boleh | ❌ Dilarang |
|----------|------------|
| Property domain object | Import Prisma, Mongoose, Fastify |
| Method domain logic (`isAdmin()`, `isPublished()`) | Akses database langsung |
| Constructor sederhana | Throw HTTP error |

```ts
// ✅ BENAR
export class PostEntity {
  id: string
  title: string
  published: boolean

  constructor({ id, title, content, authorId, published }: {
    id: string; title: string; content: string; authorId: string; published: boolean
  }) {
    this.id = id
    this.title = title
    this.published = published
  }

  isPublished(): boolean { return this.published === true }
}

// ❌ SALAH — entity tidak boleh import ORM
import { PrismaClient } from '@prisma/client'
export class PostEntity {
  async save() { /* ... */ }  // entity bukan ActiveRecord
}
```

---

### Repository (`repositories/`)

| ✅ Boleh | ❌ Dilarang |
|----------|------------|
| Query database (Prisma/Mongoose) | Business logic (validasi, otorisasi) |
| Return `Entity` atau `null` | Import Fastify, plugin |
| Map raw record → Entity | Throw `NotFoundError` (cukup return null) |
| Menerima prisma via constructor | Akses langsung ke `fastify.*` |

```ts
// ✅ BENAR — repository hanya query, return entity atau null
async findById(id: string): Promise<PostEntity | null> {
  const record = await this.prisma.post.findUnique({ where: { id } })
  return record ? toEntity(record) : null  // return null, bukan throw error
}

// ❌ SALAH — business logic tidak boleh ada di repository
async findById(id: string): Promise<PostEntity> {
  const record = await this.prisma.post.findUnique({ where: { id } })
  if (!record) throw new NotFoundError('Post not found')  // ini tugas service
  if (record.authorId !== currentUserId) throw new ForbiddenError(...)  // ini tugas service
  return toEntity(record)
}
```

---

### Service (`services/`)

| ✅ Boleh | ❌ Dilarang |
|----------|------------|
| Business logic & aturan domain | Direct database query (tanpa repository) |
| Throw typed errors (`NotFoundError`, dll.) | Akses `request`, `reply`, `fastify.*` |
| Orkestrasi beberapa repository | Format HTTP response |
| Validasi aturan bisnis | Return `null` untuk "tidak ditemukan" |

```ts
// ✅ BENAR — service throw typed error, tidak return null
async getPost(id: string): Promise<PostEntity> {
  const entity = await this.repository.findById(id)
  if (!entity) throw new NotFoundError('Post not found')
  return entity
}

// ✅ BENAR — service boleh orchestrasi
async transferPoints(fromId: string, toId: string, amount: number): Promise<{ success: boolean }> {
  const sender = await this.userRepository.findById(fromId)
  if (!sender) throw new NotFoundError('Sender not found')
  if (sender.points < amount) throw new BadRequestError('Insufficient points')

  await this.pointRepository.deduct(fromId, amount)
  await this.pointRepository.add(toId, amount)
  return { success: true }
}

// ❌ SALAH — service tidak boleh akses request/reply
async getPost(request: any, reply: any) {  // parameter Fastify di service = SALAH
  const id = request.params.id
  // ...
}
```

---

### Controller (`controllers/`)

| ✅ Boleh | ❌ Dilarang |
|----------|------------|
| Validasi input (Zod `safeParse`) | Business logic |
| Memanggil service | Direct database access |
| Format response (`successResponse`, `toXxxResponse`) | Throw error selain `ValidationError` |
| Parse query params | Logika kondisional domain |

```ts
// ✅ BENAR — controller validasi input, panggil service, format output
async createPost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parsed = createPostRequestSchema.safeParse(request.body)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
  }
  const entity = await this.service.createPost(request.user.id, parsed.data)
  return reply.code(201).send(successResponse(toPostResponse(entity)))
}

// ❌ SALAH — business logic di controller
async createPost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Cek duplikat di controller = SALAH, ini tugas service/repository
  const existing = await this.prisma.post.findFirst({ where: { title: (request.body as any).title } })
  if (existing) throw new ConflictError('Title already exists')
}
```

---

### Route (`routes/`)

| ✅ Boleh | ❌ Dilarang |
|----------|------------|
| Definisi HTTP method + path | Business logic apapun |
| JSON Schema untuk Swagger | Akses database |
| `preHandler: [fastify.authenticate]` | Panggil service langsung |
| Mapping route → controller method | Logika kondisional |

```ts
// ✅ BENAR — route hanya definisi endpoint
fastify.post('/', { ...auth, schema: createPostRouteSchema }, (req, rep) =>
  controller.createPost(req, rep)
)

// ❌ SALAH — logika di route handler
fastify.post('/', async (req, rep) => {
  const user = await db.user.findUnique({ where: { id: req.user.id } })
  if (!user) return rep.code(404).send(...)
  // ini seharusnya di service/controller
})
```

---

## Aturan Import Antar Modul

### Hanya boleh import via `index.js`

```ts
// ✅ BENAR — import dari public API modul
import { UserService } from '../users/index.js'
import { createUserRepository } from '../users/index.js'

// ❌ SALAH — import langsung dari internal file modul lain
import { UserService } from '../users/services/user.service.js'
import { UserPrismaRepository } from '../users/repositories/user.prisma.repository.js'
```

### Import diizinkan dari `core/`

```ts
// ✅ Modul boleh import dari core
import { NotFoundError } from '../../../core/utils/errors.js'
import { successResponse } from '../../../core/utils/response.js'
import env from '../../../core/config/env.config.js'
```

### Core tidak boleh import dari modul

```ts
// ❌ SALAH — core tidak boleh bergantung pada modul tertentu
// src/core/plugins/db.plugin.ts
import { UserService } from '../../modules/users/index.js'  // DILARANG
```

---

## Aturan Umum

### 1. Tidak ada `null` untuk "tidak ditemukan"

```ts
// ❌ Service return null
async getUser(id: string) {
  return this.repository.findById(id)  // bisa null — controller tidak tahu
}

// ✅ Service throw typed error
async getUser(id: string): Promise<UserEntity> {
  const user = await this.repository.findById(id)
  if (!user) throw new NotFoundError('User not found')
  return user
}
```

### 2. Public API lewat `index.js`

Setiap modul **wajib** punya `index.js` yang mengekspor semua yang boleh diakses modul lain:

```ts
// src/modules/users/index.ts
export { UserService } from './services/user.service.js'
export { createUserRepository } from './repositories/user.repository.js'
// Jangan export entity internal, repository konkret, dll.
```

### 3. Tidak ada direct DB access di luar repository

```ts
// ❌ Service akses Prisma langsung
export class PostService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma  // SALAH — service tidak boleh pegang prisma
  }

  async getPost(id: string) {
    return this.prisma.post.findUnique({ where: { id } })
  }
}

// ✅ Service via repository
export class PostService {
  constructor(private repository: PostPrismaRepository | PostMongoRepository) {
    // repository sudah meng-abstract DB
  }
}
```

### 4. Error hanya typed AppError

```ts
// ❌ Throw Error biasa
throw new Error('Not found')  // tidak ada HTTP status code

// ❌ Return error object
return { error: 'Not found' }

// ✅ Throw typed error
throw new NotFoundError('Post not found')  // error-handler tahu status 404-nya
```

---

## Alur Data: Create Post

```
POST /api/v1/posts
    │
    ▼ routes/post.routes.js
    fastify.post('/', { ...auth, schema }, handler)
    │
    ▼ controllers/post.controller.ts
    - Zod safeParse(request.body)
    - throw ValidationError jika gagal
    │
    ▼ services/post.service.ts
    - createPost(authorId, data)
    - validasi business rule
    │
    ▼ repositories/post.prisma.repository.ts
    - prisma.post.create({ data })
    - return PostEntity
    │
    ▼ kembali ke controller
    - toPostResponse(entity)
    - reply.code(201).send(successResponse(...))
```
