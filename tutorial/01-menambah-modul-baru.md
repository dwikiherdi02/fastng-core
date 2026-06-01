# Menambah Modul Baru

Tutorial lengkap membuat modul `posts` dari nol — mengikuti arsitektur Clean Architecture FastNG.

## Gambaran Umum

Setiap modul terdiri dari lapisan berikut (dari luar ke dalam):

```
Route → Controller → Service → Repository → Entity
```

File yang perlu dibuat:

```
src/modules/posts/
├── index.ts                          ← public API modul
├── module.ts                         ← entry point Fastify
├── entities/
│   └── post.entity.ts                ← domain object murni
├── dto/
│   ├── create-post.request.dto.ts    ← validasi input (Zod + JSON Schema)
│   ├── update-post.request.dto.ts    ← validasi input PATCH
│   └── post.response.dto.ts          ← format output
├── repositories/
│   ├── post.repository.ts            ← factory (pilih driver)
│   ├── post.prisma.repository.ts     ← implementasi Prisma
│   └── post.mongo.repository.ts      ← implementasi Mongoose
├── services/
│   └── post.service.ts               ← business logic
├── controllers/
│   └── post.controller.ts            ← handle request/response
└── routes/
    └── post.routes.ts                ← definisi HTTP endpoint
```

---

## Langkah 1: Tambahkan Model Prisma

Edit `prisma/schema.prisma`, tambahkan di bawah model `User`:

```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String
  authorId  String
  published Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  author User @relation(fields: [authorId], references: [id], onDelete: Cascade)
}
```

Tambahkan relasi di model `User`:

```prisma
model User {
  // ...field yang sudah ada...
  posts Post[]
}
```

Jalankan migrasi:

```bash
npm run db:migrate
```

---

## Langkah 2: Buat Entity

`src/modules/posts/entities/post.entity.ts`

```ts
/**
 * Pure domain object — no ORM, no framework dependency.
 */
export class PostEntity {
  id: string
  title: string
  content: string
  authorId: string
  published: boolean
  createdAt: Date
  updatedAt: Date

  constructor(props: {
    id: string
    title: string
    content: string
    authorId: string
    published: boolean
    createdAt: Date
    updatedAt: Date
  }) {
    this.id = props.id
    this.title = props.title
    this.content = props.content
    this.authorId = props.authorId
    this.published = props.published
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }

  isPublished(): boolean {
    return this.published === true
  }
}
```

**Aturan Entity:**
- Tidak boleh import ORM, Fastify, atau framework apapun
- Boleh punya method domain logic (seperti `isPublished()`)

---

## Langkah 3: Buat Prisma Repository

`src/modules/posts/repositories/post.prisma.repository.ts`

```ts
import type { PrismaClient } from '@prisma/client'
import { PostEntity } from '../entities/post.entity.js'

function toEntity(record: {
  id: string; title: string; content: string; authorId: string;
  published: boolean; createdAt: Date; updatedAt: Date
}): PostEntity {
  return new PostEntity({
    id: record.id,
    title: record.title,
    content: record.content,
    authorId: record.authorId,
    published: record.published,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })
}

export class PostPrismaRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<PostEntity | null> {
    const record = await this.prisma.post.findUnique({ where: { id } })
    return record ? toEntity(record) : null
  }

  async findAll({ page = 1, limit = 20 } = {}): Promise<{ items: PostEntity[]; total: number }> {
    const skip = (page - 1) * limit
    const [records, total] = await Promise.all([
      this.prisma.post.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.post.count(),
    ])
    return { items: records.map(toEntity), total }
  }

  async findByAuthor(authorId: string): Promise<PostEntity[]> {
    const records = await this.prisma.post.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(toEntity)
  }

  async create(data: { title: string; content: string; authorId: string; published?: boolean }): Promise<PostEntity> {
    const record = await this.prisma.post.create({ data })
    return toEntity(record)
  }

  async update(id: string, data: Partial<{ title: string; content: string; published: boolean }>): Promise<PostEntity> {
    const record = await this.prisma.post.update({ where: { id }, data })
    return toEntity(record)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } })
  }

  withClient(tx: PrismaClient): PostPrismaRepository {
    return new PostPrismaRepository(tx)
  }
}
```

---

## Langkah 4: Buat Mongo Repository

`src/modules/posts/repositories/post.mongo.repository.js`

Buat dulu model Mongoose di `src/core/database/models/post.model.ts`:

```ts
import mongoose, { Document, Schema } from 'mongoose'

export interface PostDocument extends Document {
  title: string
  content: string
  authorId: string
  published: boolean
  createdAt: Date
  updatedAt: Date
}

const postSchema = new Schema<PostDocument>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    authorId: { type: String, required: true },
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export const PostModel = mongoose.model<PostDocument>('Post', postSchema)
```

Kemudian buat repository:

`src/modules/posts/repositories/post.mongo.repository.ts`

```ts
import { PostModel } from '../../../core/database/models/post.model.js'
import { PostEntity } from '../entities/post.entity.js'

function toEntity(doc: any): PostEntity {
  return new PostEntity({
    id: doc._id.toString(),
    title: doc.title,
    content: doc.content,
    authorId: doc.authorId,
    published: doc.published,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  })
}

export class PostMongoRepository {
  async findById(id: string): Promise<PostEntity | null> {
    const doc = await PostModel.findById(id).lean()
    return doc ? toEntity(doc) : null
  }

  async findAll({ page = 1, limit = 20 } = {}): Promise<{ items: PostEntity[]; total: number }> {
    const skip = (page - 1) * limit
    const [docs, total] = await Promise.all([
      PostModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PostModel.countDocuments(),
    ])
    return { items: docs.map(toEntity), total }
  }

  async findByAuthor(authorId: string): Promise<PostEntity[]> {
    const docs = await PostModel.find({ authorId }).sort({ createdAt: -1 }).lean()
    return docs.map(toEntity)
  }

  async create(data: { title: string; content: string; authorId: string; published?: boolean }): Promise<PostEntity> {
    const doc = await PostModel.create(data)
    return toEntity(doc)
  }

  async update(id: string, data: Partial<{ title: string; content: string; published: boolean }>): Promise<PostEntity> {
    const doc = await PostModel.findByIdAndUpdate(id, data, { new: true }).lean()
    return toEntity(doc)
  }

  async delete(id: string): Promise<void> {
    await PostModel.findByIdAndDelete(id)
  }

  withClient(): PostMongoRepository {
    return this
  }
}
```

---

## Langkah 5: Buat Factory Repository

`src/modules/posts/repositories/post.repository.ts`

```ts
import type { PrismaClient } from '@prisma/client'
import env from '../../../core/config/env.config.js'
import { PostPrismaRepository } from './post.prisma.repository.js'
import { PostMongoRepository } from './post.mongo.repository.js'

/**
 * Factory — returns the correct repository for the active DB driver.
 */
export function createPostRepository(prisma: PrismaClient | null): PostPrismaRepository | PostMongoRepository {
  if (env.DB_DRIVER === 'mongodb') {
    return new PostMongoRepository()
  }
  return new PostPrismaRepository(prisma!)
}
```

---

## Langkah 6: Buat Service

`src/modules/posts/services/post.service.ts`

```ts
import { NotFoundError, ForbiddenError } from '../../../core/utils/errors.js'
import type { PostEntity } from '../entities/post.entity.js'

export class PostService {
  constructor(private repository: any) {}

  async listPosts({ page, limit }: { page?: number; limit?: number } = {}): Promise<{ items: PostEntity[]; total: number }> {
    return this.repository.findAll({ page, limit })
  }

  async getPost(id: string): Promise<PostEntity> {
    const entity = await this.repository.findById(id)
    if (!entity) throw new NotFoundError('Post not found')
    return entity
  }

  async createPost(authorId: string, data: { title: string; content: string; published?: boolean }): Promise<PostEntity> {
    return this.repository.create({ ...data, authorId })
  }

  async updatePost(userId: string, postId: string, data: Partial<{ title: string; content: string; published: boolean }>): Promise<PostEntity> {
    const entity = await this.repository.findById(postId)
    if (!entity) throw new NotFoundError('Post not found')
    if (entity.authorId !== userId) throw new ForbiddenError('Not the author of this post')
    return this.repository.update(postId, data)
  }

  async deletePost(userId: string, postId: string, role: string): Promise<void> {
    const entity = await this.repository.findById(postId)
    if (!entity) throw new NotFoundError('Post not found')
    // Admin dapat hapus post siapapun
    if (role !== 'admin' && entity.authorId !== userId) {
      throw new ForbiddenError('Not the author of this post')
    }
    await this.repository.delete(postId)
  }
}
```

---

## Langkah 7: Buat DTOs

### Request DTO

`src/modules/posts/dto/create-post.request.dto.ts`

```ts
import { z } from 'zod'

// Zod schema — untuk validasi di controller
export const createPostRequestSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  published: z.boolean().optional().default(false),
})

export type CreatePostRequest = z.infer<typeof createPostRequestSchema>

// JSON Schema — untuk Fastify/Swagger
export const createPostRouteSchema = {
  tags: ['Posts'],
  summary: 'Create a new post',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['title', 'content'],
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 200 },
      content: { type: 'string', minLength: 10 },
      published: { type: 'boolean', default: false },
    },
  },
}
```

### Response DTO

`src/modules/posts/dto/post.response.dto.ts`

```ts
import type { PostEntity } from '../entities/post.entity.js'

export function toPostResponse(entity: PostEntity) {
  return {
    id: entity.id,
    title: entity.title,
    content: entity.content,
    authorId: entity.authorId,
    published: entity.published,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
}
```

---

## Langkah 8: Buat Controller

`src/modules/posts/controllers/post.controller.ts`

```ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { successResponse } from '../../../core/utils/response.js'
import { toPostResponse } from '../dto/post.response.dto.js'
import { createPostRequestSchema } from '../dto/create-post.request.dto.js'
import { ValidationError } from '../../../core/utils/errors.js'
import type { PostService } from '../services/post.service.js'

export class PostController {
  constructor(private service: PostService) {}

  async listPosts(request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply): Promise<void> {
    const page = parseInt(request.query.page ?? '1')
    const limit = parseInt(request.query.limit ?? '20')
    const { items, total } = await this.service.listPosts({ page, limit })
    return reply.send(successResponse(items.map(toPostResponse), { total, page, limit }))
  }

  async getPost(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const entity = await this.service.getPost(request.params.id)
    return reply.send(successResponse(toPostResponse(entity)))
  }

  async createPost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = createPostRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }
    const entity = await this.service.createPost(request.user.id, parsed.data)
    return reply.code(201).send(successResponse(toPostResponse(entity)))
  }

  async updatePost(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const entity = await this.service.updatePost(
      request.user.id,
      request.params.id,
      request.body as any
    )
    return reply.send(successResponse(toPostResponse(entity)))
  }

  async deletePost(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    await this.service.deletePost(request.user.id, request.params.id, request.user.role)
    return reply.code(204).send()
  }
}
```

---

## Langkah 9: Buat Routes

`src/modules/posts/routes/post.routes.ts`

```ts
import type { FastifyInstance } from 'fastify'
import type { PostController } from '../controllers/post.controller.js'
import { createPostRouteSchema } from '../dto/create-post.request.dto.js'

const listPostsSchema = {
  tags: ['Posts'],
  summary: 'List all posts',
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
}

const getPostSchema = {
  tags: ['Posts'],
  summary: 'Get post by ID',
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
}

export default async function postRoutes(fastify: FastifyInstance, controller: PostController): Promise<void> {
  const auth = { preHandler: [fastify.authenticate] }

  // Public endpoints
  fastify.get('/', { schema: listPostsSchema }, (req, rep) =>
    controller.listPosts(req, rep)
  )

  fastify.get('/:id', { schema: getPostSchema }, (req, rep) =>
    controller.getPost(req, rep)
  )

  // Protected endpoints
  fastify.post('/', { ...auth, schema: createPostRouteSchema }, (req, rep) =>
    controller.createPost(req, rep)
  )

  fastify.patch('/:id', { ...auth }, (req, rep) =>
    controller.updatePost(req, rep)
  )

  fastify.delete('/:id', { ...auth }, (req, rep) =>
    controller.deletePost(req, rep)
  )
}
```

---

## Langkah 10: Buat Module Entry Point

`src/modules/posts/module.ts`

```ts
import type { FastifyInstance } from 'fastify'
import { createPostRepository } from './repositories/post.repository.js'
import { PostService } from './services/post.service.js'
import { PostController } from './controllers/post.controller.js'
import postRoutes from './routes/post.routes.js'

/**
 * Posts module entry point.
 */
export default async function postsModule(fastify: FastifyInstance): Promise<void> {
  const repository = createPostRepository(fastify.db)
  const service = new PostService(repository)
  const controller = new PostController(service)

  fastify.register(
    async (instance) => {
      await postRoutes(instance, controller)
    },
    { prefix: '/api/v1/posts' }
  )
}
```

---

## Langkah 11: Buat Public API (index.ts)

`src/modules/posts/index.ts`

```ts
// Public API for the posts module.
// Only this file may be imported by other modules.

export { PostService } from './services/post.service.js'
export { createPostRepository } from './repositories/post.repository.js'
```

---

## Langkah 12: Daftarkan di Registry

Edit `src/registry/module.registry.ts`:

```ts
const moduleRegistry = [
  // ...modul yang sudah ada...
  {
    name: 'posts',
    enabled: true,
    path: '../modules/posts/module.js',  // NodeNext ESM: path value stays .js
    dependsOn: ['auth', 'users'],
  },
]
```

Restart server — modul akan otomatis terdaftar.

---

## Verifikasi

Cek log saat server start:

```
[INFO] Module loaded: posts
```

Test endpoint baru:

```bash
# Buat post (perlu JWT)
curl -X POST http://localhost:3000/api/v1/posts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello World","content":"Konten post pertama"}'

# List semua post
curl http://localhost:3000/api/v1/posts
```

Lihat di Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs) — kategori **Posts** akan muncul.
