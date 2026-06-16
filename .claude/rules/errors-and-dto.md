# Errors and DTOs: Validation, Serialization, and Error Handling

## Error System

FastNG uses a centralized, typed error system. All errors are subclasses of a base `AppError` class, and HTTP status codes are determined automatically by type checking, not hard-coded in routes or controllers.

### AppError Base Class

`src/core/utils/errors.ts`:

```ts
export class AppError extends Error {
  statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = this.constructor.name
    Object.setPrototypeOf(this, AppError.prototype)
  }
}
```

All errors extend this and set a `statusCode` in their constructor.

### Standard Error Types

| Class | HTTP Status | Use When |
|---|---|---|
| `NotFoundError` | 404 | Resource does not exist |
| `ConflictError` | 409 | Duplicate/constraint violation (e.g., email already registered) |
| `UnauthorizedError` | 401 | Invalid or missing JWT token |
| `ForbiddenError` | 403 | User lacks permission (e.g., not the author of a post) |
| `ValidationError` | 422 | Input validation failed (Zod `safeParse` error) |
| `BadRequestError` | 400 | Malformed request (e.g., missing required field) |

All are defined in `src/core/utils/errors.ts`:

```ts
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409)
  }
}

// ... and so on for each error type
```

### How Errors Flow

1. **Service throws** a typed error:
   ```ts
   if (!user) throw new NotFoundError('User not found')
   if (existingEmail) throw new ConflictError('Email already registered')
   ```

2. **Controller does NOT catch** — errors propagate naturally:
   ```ts
   // ✅ Correct: no try/catch
   const result = await this.service.getUser(id)
   reply.send(successResponse(toUserResponse(result)))
   ```

3. **Global error handler** in `src/core/middlewares/error-handler.ts` catches all errors:
   ```ts
   fastify.setErrorHandler((error, request, reply) => {
     if (error instanceof AppError) {
       return reply.code(error.statusCode).send({
         success: false,
         message: error.message,
       })
     }
     // Unknown error → 500
     return reply.code(500).send({ success: false, message: 'Internal server error' })
   })
   ```

## Adding a New Error Type

**Step 1:** Add the class to `src/core/utils/errors.ts`:

```ts
export class QuotaExceededError extends AppError {
  constructor(message = 'Quota exceeded') {
    super(message, 429)  // HTTP 429 Too Many Requests
  }
}

export class GoneError extends AppError {
  constructor(message = 'Resource gone') {
    super(message, 410)  // HTTP 410 Gone
  }
}
```

**Step 2:** Use it in a service:

```ts
if (userPostCount >= MAX_POSTS_PER_DAY) {
  throw new QuotaExceededError('You have reached the maximum posts for today')
}
```

**Step 3:** No error-handler changes needed unless the error carries extra structured data.

### Errors with Extra Fields

If your error needs to carry more than just a `message` (e.g., validation errors with a list of fields), add the field to the error class:

```ts
// src/core/utils/errors.ts
export class UnprocessableError extends AppError {
  errors: Array<{ field: string; message: string }>

  constructor(message = 'Unprocessable entity', errors = []) {
    super(message, 422)
    this.errors = errors
  }
}
```

Then update the global error handler to handle this special case **before** the generic `AppError` check:

```ts
// src/core/middlewares/error-handler.ts
if (error instanceof UnprocessableError && error.errors.length > 0) {
  return reply.code(422).send({
    success: false,
    message: error.message,
    errors: error.errors,  // ← include the extra field
  })
}

// Generic AppError handling
if (error instanceof AppError) {
  return reply.code(error.statusCode).send({
    success: false,
    message: error.message,
  })
}
```

## DTO Pattern

FastNG uses a **dual-schema pattern** for DTOs: every DTO file exports both a **Zod schema** (for runtime validation in the controller) and a **Fastify JSON Schema** (for Fastify's request/response validation and Swagger docs).

### Why Two Schemas?

- **Zod**: Runtime type checking, clear error messages, `z.infer` for TypeScript types, but no built-in Swagger/OpenAPI support.
- **JSON Schema**: Fastify's native schema language, used for request validation and Swagger documentation, but limited type safety and validation features.

Both must be kept in sync manually — one is not auto-derived from the other.

### Request DTO File

`src/modules/posts/dto/create-post.request.dto.ts`:

```ts
import { z } from 'zod'

// ✅ Zod schema for controller-side validation + TypeScript type inference
export const CreatePostSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).min(3).max(200),
  content: z.string().min(1),
  published: z.boolean().optional().default(false),
})

export type CreatePostRequest = z.infer<typeof CreatePostSchema>

// ✅ Fastify JSON Schema for route-level validation and Swagger docs
export const CreatePostRouteSchema = {
  body: {
    type: 'object' as const,
    required: ['title', 'content'],
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 200 },
      content: { type: 'string', minLength: 1 },
      published: { type: 'boolean', default: false },
    },
  },
  response: {
    201: {
      description: 'Post created successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            authorId: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  },
}
```

**In the controller**, validate with Zod:

```ts
async createPost(request: FastifyRequest, reply: FastifyReply) {
  const parsed = CreatePostSchema.safeParse(request.body)
  if (!parsed.success) {
    throw new ValidationError('Invalid post data')
  }
  
  const post = await this.service.createPost(request.user.id, parsed.data)
  reply.code(201).send(successResponse(toPostResponse(post)))
}
```

**In the route**, attach the JSON Schema:

```ts
fastify.post(
  '/',
  {
    preHandler: [fastify.authenticate],
    schema: CreatePostRouteSchema,  // ← JSON Schema for Fastify validation + Swagger
  },
  (request, reply) => controller.createPost(request, reply)
)
```

### Response DTO File

`src/modules/posts/dto/post.response.dto.ts`:

```ts
// Response mapper function
export function toPostResponse(entity: PostEntity) {
  return {
    id: entity.id,
    title: entity.title,
    content: entity.content,
    author: {
      id: entity.authorId,
      name: entity.authorName,  // assume PostEntity.authorName is hydrated by service
    },
    createdAt: entity.createdAt.toISOString(),
  }
}

// Fastify JSON Schema for response (optional, for Swagger docs)
export const PostResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    author: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
    },
    createdAt: { type: 'string' },
  },
}
```

### Query Parameter DTO

For `GET /posts?limit=10&offset=0`, create a query DTO:

`src/modules/posts/dto/post.query.dto.ts`:

```ts
import { z } from 'zod'

export const PostListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(10),
  offset: z.coerce.number().int().nonnegative().default(0),
})

export type PostListQuery = z.infer<typeof PostListQuerySchema>

export const PostListQueryRouteSchema = {
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'number', default: 10 },
      offset: { type: 'number', default: 0 },
    },
  },
}
```

In the controller:

```ts
async listPosts(request: FastifyRequest, reply: FastifyReply) {
  const parsed = PostListQuerySchema.safeParse(request.query)
  if (!parsed.success) {
    throw new ValidationError('Invalid query parameters')
  }
  
  const { limit, offset } = parsed.data
  const posts = await this.service.listPosts(limit, offset)
  reply.send(successResponse(posts.map(toPostResponse), { limit, offset }))
}
```

## DTO File Naming

| Purpose | Filename | Example |
|---|---|---|
| Create request | `{action}.request.dto.ts` | `create-post.request.dto.ts` |
| Update request | `{action}.request.dto.ts` | `update-post.request.dto.ts` |
| Response mapping | `{name}.response.dto.ts` | `post.response.dto.ts` |
| Query parameters | `{name}.query.dto.ts` | `post.query.dto.ts` |

All DTO files live under `src/modules/{name}/dto/`.

## Zod Common Patterns

| Validation | Code |
|---|---|
| Required string | `z.string()` |
| Optional string | `z.string().optional()` |
| Number from query string | `z.coerce.number()` |
| Positive integer | `z.coerce.number().int().positive()` |
| Email | `z.string().email()` |
| URL | `z.string().url()` |
| Enum | `z.enum(['published', 'draft'])` |
| Array | `z.array(z.string())` |
| Min/max length | `z.string().min(3).max(200)` |
| Regex | `z.string().regex(/^[a-z]+$/)` |
| Custom error message | `z.string({ required_error: 'Title is required' })` |
| Default value | `z.boolean().default(false)` |
| "At least one field" (for PATCH) | `.refine(data => Object.values(data).some(v => v !== undefined))` |

## Response Envelope

All responses use a uniform envelope from `src/core/utils/response.ts`:

```ts
// Success response
{
  success: true,
  data: { ... },
  meta: { ... }  // optional: pagination, counts, etc.
}

// Error response (handled by error-handler.ts)
{
  success: false,
  message: "..."
}
```

Helper functions:

```ts
export function successResponse<T>(data: T, meta?: Record<string, any>) {
  return { success: true, data, meta }
}

export function errorResponse(message: string) {
  return { success: false, message }
}
```

For complete tutorials and code samples, see `tutorial/06-menambah-dto-validasi.md` (DTO pattern) and `tutorial/07-menambah-custom-error.md` (error types).
