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
├── index.js                          ← public API modul
├── module.js                         ← entry point Fastify
├── entities/
│   └── post.entity.js                ← domain object murni
├── dto/
│   ├── create-post.request.dto.js    ← validasi input (Zod + JSON Schema)
│   ├── update-post.request.dto.js    ← validasi input PATCH
│   └── post.response.dto.js          ← format output
├── repositories/
│   ├── post.repository.js            ← factory (pilih driver)
│   ├── post.prisma.repository.js     ← implementasi Prisma
│   └── post.mongo.repository.js      ← implementasi Mongoose
├── services/
│   └── post.service.js               ← business logic
├── controllers/
│   └── post.controller.js            ← handle request/response
└── routes/
    └── post.routes.js                ← definisi HTTP endpoint
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
yarn db:migrate
```

---

## Langkah 2: Buat Entity

`src/modules/posts/entities/post.entity.js`

```js
/**
 * Pure domain object — no ORM, no framework dependency.
 */
export class PostEntity {
  /**
   * @param {{id: string, title: string, content: string, authorId: string, published: boolean, createdAt: Date, updatedAt: Date}} props
   */
  constructor({ id, title, content, authorId, published, createdAt, updatedAt }) {
    this.id = id
    this.title = title
    this.content = content
    this.authorId = authorId
    this.published = published
    this.createdAt = createdAt
    this.updatedAt = updatedAt
  }

  isPublished() {
    return this.published === true
  }
}
```

**Aturan Entity:**
- Tidak boleh import ORM, Fastify, atau framework apapun
- Boleh punya method domain logic (seperti `isPublished()`)

---

## Langkah 3: Buat Prisma Repository

`src/modules/posts/repositories/post.prisma.repository.js`

```js
import { PostEntity } from '../entities/post.entity.js'

function toEntity(record) {
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
  /** @param {import('@prisma/client').PrismaClient} prisma */
  constructor(prisma) {
    this.prisma = prisma
  }

  async findById(id) {
    const record = await this.prisma.post.findUnique({ where: { id } })
    return record ? toEntity(record) : null
  }

  async findAll({ page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit
    const [records, total] = await Promise.all([
      this.prisma.post.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.post.count(),
    ])
    return { items: records.map(toEntity), total }
  }

  async findByAuthor(authorId) {
    const records = await this.prisma.post.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(toEntity)
  }

  async create(data) {
    const record = await this.prisma.post.create({ data })
    return toEntity(record)
  }

  async update(id, data) {
    const record = await this.prisma.post.update({ where: { id }, data })
    return toEntity(record)
  }

  async delete(id) {
    await this.prisma.post.delete({ where: { id } })
  }
}
```

---

## Langkah 4: Buat Mongo Repository

`src/modules/posts/repositories/post.mongo.repository.js`

Buat dulu model Mongoose di `src/core/database/models/post.model.js`:

```js
import mongoose from 'mongoose'

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    authorId: { type: String, required: true },
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export const PostModel = mongoose.model('Post', postSchema)
```

Kemudian buat repository:

`src/modules/posts/repositories/post.mongo.repository.js`

```js
import { PostModel } from '../../../core/database/models/post.model.js'
import { PostEntity } from '../entities/post.entity.js'

function toEntity(doc) {
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
  async findById(id) {
    const doc = await PostModel.findById(id).lean()
    return doc ? toEntity(doc) : null
  }

  async findAll({ page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit
    const [docs, total] = await Promise.all([
      PostModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PostModel.countDocuments(),
    ])
    return { items: docs.map(toEntity), total }
  }

  async findByAuthor(authorId) {
    const docs = await PostModel.find({ authorId }).sort({ createdAt: -1 }).lean()
    return docs.map(toEntity)
  }

  async create(data) {
    const doc = await PostModel.create(data)
    return toEntity(doc)
  }

  async update(id, data) {
    const doc = await PostModel.findByIdAndUpdate(id, data, { new: true }).lean()
    return toEntity(doc)
  }

  async delete(id) {
    await PostModel.findByIdAndDelete(id)
  }
}
```

---

## Langkah 5: Buat Factory Repository

`src/modules/posts/repositories/post.repository.js`

```js
import env from '../../../core/config/env.config.js'
import { PostPrismaRepository } from './post.prisma.repository.js'
import { PostMongoRepository } from './post.mongo.repository.js'

/**
 * Factory — returns the correct repository for the active DB driver.
 * @param {import('@prisma/client').PrismaClient | null} prisma
 */
export function createPostRepository(prisma) {
  if (env.DB_DRIVER === 'mongodb') {
    return new PostMongoRepository()
  }
  return new PostPrismaRepository(prisma)
}
```

---

## Langkah 6: Buat Service

`src/modules/posts/services/post.service.js`

```js
import { NotFoundError, ForbiddenError } from '../../../core/utils/errors.js'

export class PostService {
  /** @param {import('../repositories/post.prisma.repository.js').PostPrismaRepository} repository */
  constructor(repository) {
    this.repository = repository
  }

  async listPosts({ page, limit } = {}) {
    return this.repository.findAll({ page, limit })
  }

  async getPost(id) {
    const entity = await this.repository.findById(id)
    if (!entity) throw new NotFoundError('Post not found')
    return entity
  }

  async createPost(authorId, data) {
    return this.repository.create({ ...data, authorId })
  }

  async updatePost(userId, postId, data) {
    const entity = await this.repository.findById(postId)
    if (!entity) throw new NotFoundError('Post not found')
    if (entity.authorId !== userId) throw new ForbiddenError('Not the author of this post')
    return this.repository.update(postId, data)
  }

  async deletePost(userId, postId, role) {
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

`src/modules/posts/dto/create-post.request.dto.js`

```js
import { z } from 'zod'

// Zod schema — untuk validasi di controller
export const createPostRequestSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  published: z.boolean().optional().default(false),
})

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

`src/modules/posts/dto/post.response.dto.js`

```js
/**
 * @param {import('../entities/post.entity.js').PostEntity} entity
 */
export function toPostResponse(entity) {
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

`src/modules/posts/controllers/post.controller.js`

```js
import { successResponse } from '../../../core/utils/response.js'
import { toPostResponse } from '../dto/post.response.dto.js'
import { createPostRequestSchema } from '../dto/create-post.request.dto.js'
import { ValidationError } from '../../../core/utils/errors.js'

export class PostController {
  /** @param {import('../services/post.service.js').PostService} service */
  constructor(service) {
    this.service = service
  }

  async listPosts(request, reply) {
    const page = parseInt(request.query.page ?? '1')
    const limit = parseInt(request.query.limit ?? '20')
    const { items, total } = await this.service.listPosts({ page, limit })
    return reply.send(successResponse(items.map(toPostResponse), { total, page, limit }))
  }

  async getPost(request, reply) {
    const entity = await this.service.getPost(request.params.id)
    return reply.send(successResponse(toPostResponse(entity)))
  }

  async createPost(request, reply) {
    const parsed = createPostRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }
    const entity = await this.service.createPost(request.user.sub, parsed.data)
    return reply.code(201).send(successResponse(toPostResponse(entity)))
  }

  async updatePost(request, reply) {
    const entity = await this.service.updatePost(
      request.user.sub,
      request.params.id,
      request.body
    )
    return reply.send(successResponse(toPostResponse(entity)))
  }

  async deletePost(request, reply) {
    await this.service.deletePost(request.user.sub, request.params.id, request.user.role)
    return reply.code(204).send()
  }
}
```

---

## Langkah 9: Buat Routes

`src/modules/posts/routes/post.routes.js`

```js
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

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('../controllers/post.controller.js').PostController} controller
 */
export default async function postRoutes(fastify, controller) {
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

`src/modules/posts/module.js`

```js
import { createPostRepository } from './repositories/post.repository.js'
import { PostService } from './services/post.service.js'
import { PostController } from './controllers/post.controller.js'
import postRoutes from './routes/post.routes.js'

/**
 * Posts module entry point.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function postsModule(fastify) {
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

## Langkah 11: Buat Public API (index.js)

`src/modules/posts/index.js`

```js
// Public API for the posts module.
// Only this file may be imported by other modules.

export { PostService } from './services/post.service.js'
export { createPostRepository } from './repositories/post.repository.js'
```

---

## Langkah 12: Daftarkan di Registry

Edit `src/registry/module.registry.js`:

```js
const moduleRegistry = [
  // ...modul yang sudah ada...
  {
    name: 'posts',
    enabled: true,
    path: '../modules/posts/module.js',
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
