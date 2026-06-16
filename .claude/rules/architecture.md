# Architecture: Layer Responsibilities & Per-Layer Rules

FastNG follows a strict layering rule: data flows inward (Route → Controller → Service → Repository → Entity → Database), and each layer has a specific responsibility with explicit do's and don'ts.

## Per-Layer Responsibilities

```
HTTP Request
    ↓
[Route] — HTTP method/path + JSON Schema + preHandler guards
    ↓
[Controller] — Parse input (Zod), call service, format response
    ↓
[Service] — All business logic, domain rules, error handling
    ↓
[Repository] — DB access only, ORM mapping
    ↓
[Entity] — Pure domain object (no ORM/Fastify)
    ↓
[Database]
```

## Per-Layer Do's & Don'ts

### Entity Layer (`entities/*.entity.ts`)

**✅ May:**
- Declare pure domain object properties
- Implement domain-logic methods (e.g., `isAdmin()`, `isPublished()`)
- Have a simple constructor that accepts a props object
- Contain value objects and computed properties

**❌ Must NOT:**
- Import from ORM libraries (`@prisma/client`, `mongoose`, etc.)
- Import from Fastify or any framework
- Have a `.save()` method or any persistence logic
- Throw HTTP errors or framework-specific exceptions
- Access databases directly

**Example**: 
```ts
// ✅ Correct
export class PostEntity {
  id: string
  title: string
  authorId: string
  published: boolean
  constructor(props: { id, title, authorId, published }) { ... }
  isPublished(): boolean { return this.published }
}

// ❌ Wrong: imports ORM or has persistence
import { PrismaClient } from '@prisma/client'
export class PostEntity { ... save() { /* ORM call */ } }
```

---

### Repository Layer (`repositories/{name}.repository.ts` + `.prisma.repository.ts` + `.mongo.repository.ts`)

**✅ May:**
- Execute database queries (Prisma/Mongoose)
- Map raw ORM records to Entity objects (via a local `toEntity()` function)
- Map Entity back to ORM shape before persisting
- Return `Entity | null` for read operations
- Accept a DB client (PrismaClient or Mongoose connection) via constructor
- Implement `withClient(tx: TransactionClient): I{Name}Repository` returning a new bound instance (Prisma only)

**❌ Must NOT:**
- Contain business logic or validation (unless it's data-format validation for ORM constraints)
- Import or use Fastify or any HTTP framework
- Throw domain errors like `NotFoundError` or `ForbiddenError` — return `null` instead
- Call other repositories directly (coordinate in the service layer)
- Hold a reference to the raw DB client permanently (receive it from the service)

**Example**:
```ts
// ✅ Correct
export interface IPostRepository {
  findById(id: string): Promise<PostEntity | null>
  create(data: CreatePostData): Promise<PostEntity>
  withClient(tx: TransactionClient): IPostRepository
}

export class PostPrismaRepository implements IPostRepository {
  constructor(private prisma: PrismaClient) {}
  
  async findById(id: string) {
    const record = await this.prisma.post.findUnique({ where: { id } })
    return record ? this.toEntity(record) : null  // ✅ return null, don't throw
  }
  
  async create(data: CreatePostData) {
    const record = await this.prisma.post.create({ data })
    return this.toEntity(record)
  }
  
  withClient(tx: TransactionClient) {
    return new PostPrismaRepository(tx)  // ✅ return new bound instance
  }
  
  private toEntity(record: any): PostEntity { ... }
}

// ❌ Wrong: throws domain error
async findById(id: string) {
  const record = await this.prisma.post.findUnique({ where: { id } })
  if (!record) throw new NotFoundError('Post not found')  // ❌ throw in service instead
  return this.toEntity(record)
}
```

---

### Service Layer (`services/{name}.service.ts`)

**✅ May:**
- Contain all business logic and domain rules
- Throw typed `AppError` subclasses (NotFoundError, ConflictError, ForbiddenError, etc.)
- Call one or more repositories to orchestrate complex operations
- Verify domain rules (e.g., "only the author can edit this post")
- Access the Fastify instance for plugins/decorators (e.g., `this.fastify.jwt.sign()`)
- Convert repository `null` results to thrown errors (the service is responsible for this translation)

**❌ Must NOT:**
- Execute database queries directly (always go through an injected repository)
- Return `null` or `undefined` to indicate "not found" — must `throw NotFoundError` instead
- Directly access `request` or `reply` from Fastify
- Hold a raw PrismaClient or Mongoose connection (receive repositories via constructor)
- Perform HTTP response formatting (that's the controller's job)
- Catch and suppress errors silently

**Example**:
```ts
// ✅ Correct
export class PostService {
  constructor(
    private repository: IPostRepository,
    private fastify: FastifyInstance
  ) {}
  
  async getPost(id: string): Promise<PostEntity> {
    const post = await this.repository.findById(id)
    if (!post) throw new NotFoundError('Post not found')  // ✅ throw, don't return null
    return post
  }
  
  async updatePost(id: string, authorId: string, data: UpdatePostData) {
    const post = await this.repository.findById(id)
    if (!post) throw new NotFoundError('Post not found')
    if (post.authorId !== authorId) throw new ForbiddenError('Only author can edit')  // ✅ domain rule
    return await this.repository.update(id, data)
  }
}

// ❌ Wrong: DB call, returns null, or accesses request
async getPost(id: string) {
  const post = await this.prisma.post.findUnique({ where: { id } })  // ❌ direct DB call
  if (!post) return null  // ❌ return null instead of throwing
}

async updatePost(request, id, data) {  // ❌ request parameter
  ...
}
```

---

### Controller Layer (`controllers/{name}.controller.ts`)

**✅ May:**
- Validate request input using Zod schema (via `safeParse`)
- Throw `ValidationError` on Zod validation failure
- Call the service with parsed input
- Format the service response using Response DTOs (e.g., `toPostResponse(entity)`)
- Call `successResponse()` to wrap output in the standard envelope
- Parse query parameters and route params

**❌ Must NOT:**
- Contain business logic or domain rules
- Execute database queries or call repositories directly (always via service)
- Throw errors other than `ValidationError` (let service errors propagate to the global handler)
- Perform try/catch on service calls (let errors bubble up)
- Format response before calling `successResponse()`

**Example**:
```ts
// ✅ Correct
export class PostController {
  constructor(private service: PostService) {}
  
  async updatePost(request: FastifyRequest, reply: FastifyReply) {
    const parsed = UpdatePostSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError('Invalid request body')
    }
    
    const post = await this.service.updatePost(  // ✅ call service, no try/catch
      request.params.id,
      request.user.id,
      parsed.data
    )
    
    reply.code(200).send(successResponse(toPostResponse(post)))  // ✅ format & send
  }
}

// ❌ Wrong: business logic, try/catch, or direct DB
async updatePost(request, reply) {
  try {
    // ❌ domain rule check in controller
    if (request.user.role !== 'admin' && request.user.id !== request.body.authorId) { ... }
    
    // ❌ direct DB call
    const post = await this.prisma.post.update(...)
    
    reply.send(post)  // ❌ unformatted response
  } catch (e) {  // ❌ try/catch on service error
    reply.code(500).send(...)
  }
}
```

---

### Route Layer (`routes/{name}.routes.ts`)

**✅ May:**
- Define HTTP method (GET/POST/PATCH/DELETE) and path
- Attach Fastify JSON Schema for validation and Swagger documentation
- Apply `preHandler` guards (e.g., `fastify.authenticate`, `fastify.requireAdmin`)
- Add route metadata (tags, description, summary for Swagger)
- Map route parameters to the controller method

**❌ Must NOT:**
- Contain any business logic
- Perform database queries or call repositories
- Call services directly (always through the controller)
- Perform input validation (that's the controller's job with Zod)
- Return responses directly (use the controller)

**Example**:
```ts
// ✅ Correct
export default async function postRoutes(fastify, controller) {
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [fastify.authenticate],  // ✅ guard
      schema: UpdatePostRouteSchema,  // ✅ JSON Schema for Swagger
    },
    (request, reply) => controller.updatePost(request, reply)  // ✅ delegate to controller
  )
}

// ❌ Wrong: direct logic or DB
fastify.patch('/:id', async (request, reply) => {
  // ❌ validation in route
  if (!request.body.title) return reply.code(400).send(...)
  
  // ❌ service call in route
  const post = await postService.updatePost(request.params.id, request.body)
  
  reply.send(post)
})
```

---

## Cross-Module Import Rule

**Only import from another module's `index.ts` (public API):**

```ts
// ✅ Correct
import { AuthService, createAuthRepository } from '../auth/index.js'

// ❌ Wrong: internal file import
import { AuthService } from '../auth/services/auth.service.js'
import { AuthRepository } from '../auth/repositories/auth.repository.js'
```

**`core/` must never import from `modules/`** — this prevents circular dependencies and maintains the layering invariant. Only modules may import from `core/`.

---

## Full Request-to-Response Data Flow Example

**Scenario: Create a new post**

```
POST /api/v1/posts
  ↓
[Route: postRoutes()]
  → fastify.post('/', { preHandler: [fastify.authenticate], schema }, handler)
  → delegates to controller.createPost(request, reply)

  ↓
[Controller: PostController.createPost()]
  → CreatePostSchema.safeParse(request.body) — validate input
  → throw ValidationError if invalid
  → call service.createPost(request.user.id, parsed.data) — no try/catch
  → await the service response
  → reply.code(201).send(successResponse(toPostResponse(entity)))

  ↓
[Service: PostService.createPost()]
  → verify business rules: author role, post title length, etc.
  → call repository.create(data) with validated data
  → if needed, throw NotFoundError/ConflictError/etc.
  → return the entity

  ↓
[Repository: PostPrismaRepository.create()]
  → map entity to Prisma shape
  → await prisma.post.create({ data })
  → map DB record back to PostEntity via toEntity()
  → return PostEntity (never throw domain errors)

  ↓
[Entity: PostEntity]
  → pure object carrying id, title, authorId, createdAt, etc.
  → may have domain methods like isPublished() or canBeEdited(userId)

  ↓
[Response]
  → { success: true, data: { id, title, author: { id, name }, ... }, meta: {...} }
```

For complete tutorials, references, and code samples, see `tutorial/13-aturan-arsitektur.md` (Indonesian).
