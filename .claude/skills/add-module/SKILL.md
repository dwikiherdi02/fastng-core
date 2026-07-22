# Skill: Add a New Module

**Description**: Scaffold a new feature module (entities, DTOs, repositories, service, controller, routes, registry entry) following FastNG's modular clean architecture.

**Source tutorial**: [tutorial/01-menambah-modul-baru.md](../../../tutorial/01-menambah-modul-baru.md) and [tutorial/02-mengaktifkan-menonaktifkan-modul.md](../../../tutorial/02-mengaktifkan-menonaktifkan-modul.md)

## High-Level Steps

1. **Define the schema** — add a Prisma model (or Mongoose schema) for your new entity
2. **Create the entity** — pure domain object (no ORM imports)
3. **Create repository layer** — interface + Prisma & Mongoose implementations + factory
4. **Create service layer** — business logic; throws typed domain errors
5. **Create DTOs** — paired Zod + Fastify JSON Schema for request/response validation
6. **Create controller** — HTTP parsing and response formatting
7. **Create routes** — HTTP endpoints + Swagger schema + guards
8. **Wire the module** — `module.ts` combines all layers; `index.ts` exports public API
9. **Register in registry** — add entry to `src/registry/module.registry.ts`
10. **Test the module** — restart server, check logs, verify routes in Swagger UI

## Detailed Workflow

### Step 1: Add Database Schema

**For Prisma (sqlite/mysql/postgresql/sqlserver):**

Create `src/modules/{name}/db/{name}.prisma` — only `model` blocks, no `datasource`/`generator`. Cross-module references are scalar FK columns, never `@relation` (fragments must be self-contained — see `.claude/rules/database.md`):

```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String
  authorId  String   @map("author_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("posts")
}
```

Run: `bun run migrate -- --name=add_{name}` (assembles the schema, diffs THIS module's own fragment against its own history — creating a migration under `src/modules/{name}/db/migrations/` — applies it, syncs the catalog). If the module ships seed data, add `src/modules/{name}/seeders/{table}.json` (default) or a `*.seeder.ts` escape hatch for dynamic/relational data, then run `bun run db:seed -- --module={name}` — see `tutorial/26`.

**For MongoDB (if using Mongoose):**

Skip schema.prisma edits. Instead, create the Mongoose model in Step 3.

### Step 2: Create the Entity

File: `src/modules/{name}/entities/{name}.entity.ts`

```ts
export interface PostEntityProps {
  id: string
  title: string
  content: string
  authorId: string
  createdAt: Date
  updatedAt: Date
}

export class PostEntity {
  id: string
  title: string
  content: string
  authorId: string
  createdAt: Date
  updatedAt: Date

  constructor(props: PostEntityProps) {
    this.id = props.id
    this.title = props.title
    this.content = props.content
    this.authorId = props.authorId
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }

  isPublished(): boolean {
    // Example domain method
    return this.content.length > 0
  }
}
```

**Rules:**
- Pure domain object — no ORM, Fastify, or framework imports
- Constructor accepts a props object
- May have domain-logic methods

### Step 3: Create Repository Layer

**3a. Interface + Factory** (`repositories/{name}.repository.ts`):

```ts
import { PostEntity } from '../entities/post.entity.js'

export interface IPostRepository {
  findById(id: string): Promise<PostEntity | null>
  findAll(opts?: { limit?: number; offset?: number }): Promise<PostEntity[]>
  create(data: CreatePostInput): Promise<PostEntity>
  update(id: string, data: UpdatePostInput): Promise<PostEntity>
  delete(id: string): Promise<void>
  withClient(tx: any): IPostRepository
}

export function createPostRepository(db: any): IPostRepository {
  if (process.env.DB_DRIVER === 'mongodb') {
    return new PostMongoRepository()
  }
  return new PostPrismaRepository(db)
}
```

**3b. Prisma Implementation** (`repositories/{name}.prisma.repository.ts`):

```ts
import { PrismaClient } from '@prisma/client'
import { PostEntity, PostEntityProps } from '../entities/post.entity.js'
import { IPostRepository } from './post.repository.js'

export class PostPrismaRepository implements IPostRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<PostEntity | null> {
    const record = await this.prisma.post.findUnique({ where: { id } })
    return record ? this.toEntity(record) : null
  }

  async findAll(opts?: { limit?: number; offset?: number }): Promise<PostEntity[]> {
    const records = await this.prisma.post.findMany({
      take: opts?.limit,
      skip: opts?.offset,
    })
    return records.map(r => this.toEntity(r))
  }

  async create(data: CreatePostInput): Promise<PostEntity> {
    const record = await this.prisma.post.create({ data })
    return this.toEntity(record)
  }

  async update(id: string, data: UpdatePostInput): Promise<PostEntity> {
    const record = await this.prisma.post.update({ where: { id }, data })
    return this.toEntity(record)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } })
  }

  withClient(tx: any): IPostRepository {
    return new PostPrismaRepository(tx)
  }

  private toEntity(record: any): PostEntity {
    return new PostEntity({
      id: record.id,
      title: record.title,
      content: record.content,
      authorId: record.authorId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
  }
}
```

**3c. Mongoose Implementation** (`repositories/{name}.mongo.repository.ts`):

```ts
import { PostModel } from '../../core/database/models/post.model.js'
import { PostEntity } from '../entities/post.entity.js'
import { IPostRepository } from './post.repository.js'

export class PostMongoRepository implements IPostRepository {
  async findById(id: string): Promise<PostEntity | null> {
    const record = await PostModel.findById(id)
    return record ? this.toEntity(record) : null
  }

  async findAll(opts?: { limit?: number; offset?: number }): Promise<PostEntity[]> {
    const records = await PostModel.find().limit(opts?.limit).skip(opts?.offset)
    return records.map(r => this.toEntity(r))
  }

  async create(data: CreatePostInput): Promise<PostEntity> {
    const record = await PostModel.create(data)
    return this.toEntity(record)
  }

  async update(id: string, data: UpdatePostInput): Promise<PostEntity> {
    const record = await PostModel.findByIdAndUpdate(id, data, { new: true })
    return this.toEntity(record!)
  }

  async delete(id: string): Promise<void> {
    await PostModel.findByIdAndDelete(id)
  }

  withClient(): IPostRepository {
    return this  // MongoDB: no-op for transactions
  }

  private toEntity(record: any): PostEntity {
    return new PostEntity({
      id: record._id.toString(),
      title: record.title,
      content: record.content,
      authorId: record.authorId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
  }
}
```

**For MongoDB, also create the schema** in `src/core/database/models/post.model.ts`:

```ts
import { Schema, model } from 'mongoose'

const postSchema = new Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    authorId: { type: String, required: true },
  },
  { timestamps: true }
)

export const PostModel = model('Post', postSchema)
```

### Step 4: Create Service

File: `src/modules/{name}/services/{name}.service.ts`

```ts
import { PostEntity } from '../entities/post.entity.js'
import { IPostRepository } from '../repositories/post.repository.js'
import { NotFoundError, ForbiddenError } from '../../core/utils/errors.js'
import { FastifyInstance } from 'fastify'

export class PostService {
  constructor(
    private repository: IPostRepository,
    private fastify: FastifyInstance
  ) {}

  async getPost(id: string): Promise<PostEntity> {
    const post = await this.repository.findById(id)
    if (!post) throw new NotFoundError('Post not found')
    return post
  }

  async createPost(authorId: string, data: CreatePostInput): Promise<PostEntity> {
    return await this.repository.create({ ...data, authorId })
  }

  async updatePost(id: string, authorId: string, data: UpdatePostInput): Promise<PostEntity> {
    const post = await this.repository.findById(id)
    if (!post) throw new NotFoundError('Post not found')
    if (post.authorId !== authorId) {
      throw new ForbiddenError('Only the author can update this post')
    }
    return await this.repository.update(id, data)
  }

  async deletePost(id: string, userId: string, userRole: string): Promise<void> {
    const post = await this.repository.findById(id)
    if (!post) throw new NotFoundError('Post not found')
    if (userRole !== 'admin' && post.authorId !== userId) {
      throw new ForbiddenError('Only the author or an admin can delete this post')
    }
    await this.repository.delete(id)
  }
}
```

**Rules:**
- All business logic goes here
- Throw typed `AppError` subclasses
- Never return `null` for "not found" — throw instead
- Call the repository, not the DB directly

### Step 5: Create DTOs

**Request DTO** (`dto/create-post.request.dto.ts`):

```ts
import { z } from 'zod'

export const CreatePostSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).min(3).max(200),
  content: z.string().min(1, 'Content is required'),
})

export type CreatePostRequest = z.infer<typeof CreatePostSchema>

export const CreatePostRouteSchema = {
  body: {
    type: 'object' as const,
    required: ['title', 'content'],
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 200 },
      content: { type: 'string' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            authorId: { type: 'string' },
          },
        },
      },
    },
  },
}
```

**Response DTO** (`dto/post.response.dto.ts`):

```ts
import { PostEntity } from '../entities/post.entity.js'

export function toPostResponse(entity: PostEntity) {
  return {
    id: entity.id,
    title: entity.title,
    content: entity.content,
    authorId: entity.authorId,
    createdAt: entity.createdAt,
  }
}

export const PostResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    authorId: { type: 'string' },
    createdAt: { type: 'string' },
  },
}
```

### Step 6: Create Controller

File: `src/modules/{name}/controllers/{name}.controller.ts`

```ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { PostService } from '../services/post.service.js'
import { CreatePostSchema } from '../dto/create-post.request.dto.js'
import { toPostResponse } from '../dto/post.response.dto.js'
import { ValidationError } from '../../core/utils/errors.js'
import { successResponse } from '../../core/utils/response.js'

export class PostController {
  constructor(private service: PostService) {}

  async createPost(request: FastifyRequest, reply: FastifyReply) {
    const parsed = CreatePostSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError('Invalid post data')
    }

    const post = await this.service.createPost(request.user.id, parsed.data)
    reply.code(201).send(successResponse(toPostResponse(post)))
  }

  async getPost(request: FastifyRequest, reply: FastifyReply) {
    const post = await this.service.getPost(request.params.id)
    reply.send(successResponse(toPostResponse(post)))
  }
}
```

**Rules:**
- Validate input with Zod `safeParse`
- Call service (no try/catch)
- Format response with mapper + `successResponse()`

### Step 7: Create Routes

File: `src/modules/{name}/routes/{name}.routes.ts`

```ts
import { FastifyInstance } from 'fastify'
import { PostController } from '../controllers/post.controller.js'
import { CreatePostRouteSchema } from '../dto/create-post.request.dto.js'

export default async function postRoutes(fastify: FastifyInstance, controller: PostController) {
  const auth = { preHandler: [fastify.authenticate] }

  fastify.get(
    '/',
    { schema: { tags: ['Posts'] } },
    (request, reply) => controller.listPosts(request, reply)
  )

  fastify.get(
    '/:id',
    { schema: { tags: ['Posts'] } },
    (request, reply) => controller.getPost(request, reply)
  )

  fastify.post(
    '/',
    { ...auth, schema: { ...CreatePostRouteSchema, tags: ['Posts'] } },
    (request, reply) => controller.createPost(request, reply)
  )
}
```

### Step 8: Wire the Module

File: `src/modules/{name}/module.ts`

```ts
import { FastifyInstance } from 'fastify'
import { createPostRepository } from './repositories/post.repository.js'
import { PostService } from './services/post.service.js'
import { PostController } from './controllers/post.controller.js'
import { postRoutes } from './routes/post.routes.js'

export default async function postsModule(fastify: FastifyInstance): Promise<void> {
  const repository = createPostRepository(fastify.db)
  const service = new PostService(repository, fastify)
  const controller = new PostController(service)

  await fastify.register(
    async (instance) => {
      await postRoutes(instance, controller)
    },
    { prefix: '/api/v1/posts' }
  )
}
```

File: `src/modules/{name}/index.ts` (public API)

```ts
export { PostService } from './services/post.service.js'
export { createPostRepository } from './repositories/post.repository.js'
export type { IPostRepository } from './repositories/post.repository.js'
```

### Step 9: Register in Registry

File: `src/registry/module.registry.ts`

Add your module:

```ts
const modules: ModuleConfig[] = [
  { name: 'auth', enabled: true, path: '../modules/auth/module.js', dependsOn: [] },
  { name: 'posts', enabled: true, path: '../modules/posts/module.js', dependsOn: ['auth'] },
  // ... other modules
]
```

**Key points:**
- `path` must use `.js` extension even though source is `.ts`
- `dependsOn` lists modules that must load before this one (e.g., if routes use `fastify.authenticate` from auth)

### Step 10: Test

1. Restart the server: `bun run dev`
2. Check logs for `[ModuleLoader] Loading module: posts`
3. Navigate to `http://localhost:3000/docs` (Swagger UI)
4. Test your endpoints
5. Run `bun run lint` and `bun run format` to clean up code

For full code samples and more details, see the source tutorial.
